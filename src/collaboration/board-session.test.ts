import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardChange, BoardElement } from '../shared/model';
import type { ClientMessage, ServerMessage } from '../shared/protocol';
import { BoardSession } from './board-session';

class FakeSocket extends EventTarget {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readonly readyState = FakeSocket.OPEN;
  sent: ClientMessage[] = [];

  constructor() {
    super();
    FakeSocket.instances.push(this);
  }

  send(message: string) {
    this.sent.push(JSON.parse(message));
  }

  close(code = 1000) {
    const event = Object.assign(new Event('close'), { code });
    this.dispatchEvent(event);
  }

  receive(message: ServerMessage) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
  }
}

function shape(id = 'shape', label = 'Start'): BoardElement {
  return { id, type: 'rectangle', x: 10, y: 10, width: 90, height: 48, label, color: 'neutral' };
}

function change(before: BoardElement | null, after: BoardElement | null): BoardChange {
  return { id: (before ?? after)!.id, before, after };
}

function activeSocket() {
  return FakeSocket.instances.at(-1)!;
}

function snapshot(elements: BoardElement[] = [], revision = 0): ServerMessage {
  return { type: 'snapshot', revision, elements, presence: [] };
}

function sentCommit(socket: FakeSocket) {
  const message = socket.sent.findLast(entry => entry.type === 'commit');
  if (!message) throw new Error('Expected pending commit');
  return message;
}

function accept(socket: FakeSocket, revision: number) {
  socket.receive({ ...sentCommit(socket), revision });
}

describe('board collaboration session', () => {
  let session: BoardSession;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('window', { location: { origin: 'http://localhost' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));
    session = new BoardSession('test-board', 'editor');
    session.start();
  });

  afterEach(() => {
    session.stop();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('preserves peers’ changes while undoing and redoing only local history', () => {
    const socket = activeSocket();
    const original = shape();
    const peer = shape('peer');
    socket.receive(snapshot());
    expect(session.commit([change(null, original)])).toBe(true);
    expect(session.getSnapshot().elements).toEqual([original]);
    accept(socket, 1);

    socket.receive({ type: 'commit', id: 'peer-create', revision: 2, changes: [change(null, peer)] });
    expect(session.undo()).toBe(true);
    expect(session.getSnapshot().elements).toEqual([peer]);
    accept(socket, 3);

    expect(session.redo()).toBe(true);
    accept(socket, 4);
    expect(session.getSnapshot().elements).toEqual([peer, original]);

    const edited = { ...original, label: 'Peer edit' };
    socket.receive({ type: 'commit', id: 'peer-edit', revision: 5, changes: [change(original, edited)] });
    expect(session.undo()).toBe(false);
    socket.receive({ type: 'commit', id: 'peer-restore', revision: 6, changes: [change(edited, original)] });
    expect(session.getSnapshot().canUndo).toBe(false);
  });

  it('resends an unacknowledged edit with the same id after an already-persisted snapshot', async () => {
    const socket = activeSocket();
    const first = shape();
    const second = shape('second');
    socket.receive(snapshot());
    session.commit([change(null, first)]);
    const unacknowledged = sentCommit(socket);
    session.commit([change(null, second)]);
    expect(socket.sent).toHaveLength(1);

    socket.close(1006);
    expect(session.getSnapshot().status).toBe('disconnected');
    await vi.advanceTimersByTimeAsync(500);
    const reconnected = activeSocket();
    expect(reconnected).not.toBe(socket);
    reconnected.receive(snapshot([first], 1));
    expect(sentCommit(reconnected)).toEqual(unacknowledged);
    expect(session.getSnapshot().elements).toEqual([first, second]);

    reconnected.receive({ type: 'ack', id: unacknowledged.id });
    expect(sentCommit(reconnected).id).not.toBe(unacknowledged.id);
    accept(reconnected, 2);
    expect(session.getSnapshot().elements).toEqual([first, second]);
    expect(session.undo()).toBe(true);
    accept(reconnected, 3);
    expect(session.undo()).toBe(true);
    accept(reconnected, 4);
    expect(session.getSnapshot().elements).toEqual([]);
  });

  it('rolls back a conditional write rejected after a peer edit', () => {
    const socket = activeSocket();
    const original = shape();
    const peer = { ...original, label: 'Peer edit' };
    socket.receive(snapshot([original]));
    session.commit([change(original, { ...original, label: 'Local edit' })]);
    const pending = sentCommit(socket);
    socket.receive({ type: 'commit', id: 'peer-edit', revision: 1, changes: [change(original, peer)] });
    socket.receive({ type: 'reject', id: pending.id, reason: 'The board changed' });
    expect(session.getSnapshot()).toMatchObject({ canUndo: false, elements: [peer], error: 'The board changed' });
  });

  it('clears persisted and optimistic state after membership revocation', () => {
    const socket = activeSocket();
    socket.receive(snapshot([shape()]));
    session.commit([change(null, shape('optimistic'))]);
    const observed = vi.fn(() => session.getSnapshot());
    session.subscribe(observed);

    socket.close(4403);
    expect(observed).toHaveBeenCalledTimes(1);
    expect(observed.mock.results[0].value).toMatchObject({
      status: 'forbidden', elements: [], presence: [], canUndo: false, canRedo: false,
    });
    expect(session.commit([change(null, shape('after-revocation'))])).toBe(false);
  });

  it('checks HTTP authorization when the WebSocket handshake closes without a code', async () => {
    const socket = activeSocket();
    socket.receive(snapshot([shape()]));
    vi.mocked(fetch).mockResolvedValueOnce({ status: 404 } as Response);
    socket.close(1006);
    await vi.advanceTimersByTimeAsync(8000);
    expect(session.getSnapshot()).toMatchObject({ status: 'forbidden', elements: [] });
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
