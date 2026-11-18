import { elementsEqual, type BoardChange, type BoardElement, type BoardRole, type Point } from '../shared/model';
import { parseServerMessage, type ClientMessage, type Presence, type ServerMessage } from '../shared/protocol';
import { isChanges } from '../shared/validation';
import { applyChanges, changesMatch, TransactionHistory, type Transaction } from './transactions';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'forbidden';

export interface BoardSessionState {
  elements: BoardElement[];
  presence: Presence[];
  status: ConnectionStatus;
  canUndo: boolean;
  canRedo: boolean;
  error: string | null;
}

const initialState: BoardSessionState = {
  elements: [],
  presence: [],
  status: 'connecting',
  canUndo: false,
  canRedo: false,
  error: null,
};

export class BoardSession {
  private state = initialState;
  private listeners = new Set<() => void>();
  private authoritative = new Map<string, BoardElement>();
  private optimistic = new Map<string, BoardElement>();
  private pending: Transaction[] = [];
  private history = new TransactionHistory();
  private revision = -1;
  private socket?: WebSocket;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private cursorTimer?: ReturnType<typeof setTimeout>;
  private inFlight?: string;
  private attempt = 0;
  private active = false;
  private cursor: Point | null = null;
  private ownConnectionId?: string;

  constructor(private readonly boardId: string, private readonly role: BoardRole) {}

  getSnapshot = () => this.state;
  getServerSnapshot = () => initialState;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(): void {
    if (this.active) return;
    this.active = true;
    this.connect();
  }

  stop(): void {
    this.active = false;
    clearTimeout(this.retryTimer);
    clearTimeout(this.cursorTimer);
    this.cursorTimer = undefined;
    const socket = this.socket;
    this.socket = undefined;
    this.inFlight = undefined;
    socket?.close();
  }

  commit = (changes: BoardChange[]) => this.enqueue(changes, 'edit');

  undo = () => {
    const changes = this.history.candidate('undo', this.optimistic);
    return !!changes && !this.pending.length && this.enqueue(changes, 'undo');
  };

  redo = () => {
    const changes = this.history.candidate('redo', this.optimistic);
    return !!changes && !this.pending.length && this.enqueue(changes, 'redo');
  };

  setCursor = (point: Point | null) => {
    this.cursor = point;
    if (this.cursorTimer !== undefined || this.state.status !== 'connected') return;
    this.cursorTimer = setTimeout(() => {
      this.cursorTimer = undefined;
      this.send({ type: 'cursor', point: this.cursor });
    }, 40);
  };

  private connect(): void {
    if (!this.active) return;
    this.publish({ status: 'connecting' });
    const url = new URL('/api/boards/' + encodeURIComponent(this.boardId) + '/socket', window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener('message', event => {
      if (this.socket !== socket || typeof event.data !== 'string') return;
      let value: unknown;
      try { value = JSON.parse(event.data); } catch { return; }
      const message = parseServerMessage(value);
      if (message) this.receive(message);
    });

    socket.addEventListener('close', event => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.inFlight = undefined;
      if (event.code === 4401 || event.code === 4403 || event.code === 1008) {
        this.forbid();
        return;
      }
      this.publish({ status: 'disconnected', presence: [] });
      void this.retry();
    });
  }

  private async retry(): Promise<void> {
    // An HTTP-denied WebSocket handshake surfaces only a generic close event.
    try {
      const response = await fetch('/api/boards/' + encodeURIComponent(this.boardId), { cache: 'no-store', signal: AbortSignal.timeout(3000) });
      if (!this.active || this.socket) return;
      if ([401, 403, 404].includes(response.status)) {
        this.forbid();
        return;
      }
    } catch {
      // Offline edits and retry remain available when HTTP is unreachable.
    }
    if (!this.active || this.socket) return;
    const delay = Math.min(500 * 2 ** this.attempt++, 8000);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private forbid(): void {
    this.pending.length = 0;
    this.authoritative.clear();
    this.history = new TransactionHistory();
    this.rebuild({ status: 'forbidden', presence: [], error: 'You no longer have access to this board.' });
  }

  private enqueue(changes: BoardChange[], intent: Transaction['intent']): boolean {
    if (this.role === 'viewer' || this.state.status === 'forbidden' || this.revision < 0 ||
      !isChanges(changes) || !changesMatch(this.optimistic, changes)) return false;
    this.pending.push({ id: crypto.randomUUID(), changes, intent });
    this.rebuild({ error: null });
    this.flush();
    return true;
  }

  private receive(message: ServerMessage): void {
    switch (message.type) {
      case 'snapshot':
        this.revision = message.revision;
        this.attempt = 0;
        this.ownConnectionId = message.connectionId;
        this.applySnapshot(message.elements);
        this.rebuild({ status: 'connected', presence: this.otherPeers(message.presence) });
        this.flush();
        if (this.cursor) this.setCursor(this.cursor);
        break;
      case 'commit':
        if (message.revision <= this.revision) return;
        if (message.revision !== this.revision + 1) {
          this.socket?.close(4000, 'Revision gap');
          return;
        }
        this.revision = message.revision;
        applyChanges(this.authoritative, message.changes);
        if (!this.settle(message.id, true)) {
          this.history.invalidate(new Set(message.changes.map(change => change.id)));
        }
        this.rebuild();
        this.flush();
        break;
      case 'ack':
      case 'reject':
        if (!this.settle(message.id, message.type === 'ack')) return;
        this.rebuild(message.type === 'reject' ? { error: message.reason } : {});
        this.flush();
        break;
      case 'presence':
        this.publish({ presence: this.otherPeers(message.presence) });
        break;
    }
  }

  private applySnapshot(elements: BoardElement[]): void {
    const next = new Map(elements.map(element => [element.id, element]));
    const inFlightChanges = new Map(this.pending[0]?.changes.map(change => [change.id, change.after]));
    const changed = new Set<string>();
    for (const id of new Set([...this.authoritative.keys(), ...next.keys()])) {
      const previous = this.authoritative.get(id) ?? null;
      const current = next.get(id) ?? null;
      if (elementsEqual(previous, current)) continue;
      // An acknowledged commit can be present in the snapshot when its reply was lost.
      if (inFlightChanges.has(id) && elementsEqual(inFlightChanges.get(id) ?? null, current)) continue;
      changed.add(id);
    }
    if (changed.size) this.history.invalidate(changed);
    this.authoritative = next;
  }

  private otherPeers(presence: Presence[]): Presence[] {
    return presence.filter(peer => peer.id !== this.ownConnectionId);
  }

  private settle(id: string, accepted: boolean): boolean {
    const transaction = this.pending[0];
    if (!transaction || transaction.id !== id) return false;
    this.pending.shift();
    this.inFlight = undefined;
    if (accepted) this.history.accept(transaction);
    return true;
  }

  private rebuild(next: Partial<BoardSessionState> = {}): void {
    this.optimistic = new Map(this.authoritative);
    for (const { changes } of this.pending) {
      if (changesMatch(this.optimistic, changes)) applyChanges(this.optimistic, changes);
    }
    const canNavigate = this.pending.length === 0 && this.role !== 'viewer' && (next.status ?? this.state.status) !== 'forbidden';
    this.publish({
      ...next,
      elements: Array.from(this.optimistic.values()),
      canUndo: canNavigate && !!this.history.candidate('undo', this.optimistic),
      canRedo: canNavigate && !!this.history.candidate('redo', this.optimistic),
    });
  }

  private flush(): void {
    const transaction = this.pending[0];
    // Resend even when the local baseline differs after reconnect. The server can
    // distinguish a persisted duplicate from a conflicting, uncommitted operation.
    if (!transaction || this.inFlight || this.state.status !== 'connected') return;
    if (this.send({ type: 'commit', id: transaction.id, changes: transaction.changes })) {
      this.inFlight = transaction.id;
    }
  }

  private send(message: ClientMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  private publish(next: Partial<BoardSessionState>): void {
    this.state = { ...this.state, ...next };
    this.listeners.forEach(listener => listener());
  }
}
