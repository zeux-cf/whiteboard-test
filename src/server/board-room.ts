import { DurableObject } from 'cloudflare:workers'
import { parseClientMessage } from '../shared/protocol'
import type { Presence, ServerMessage } from '../shared/protocol'
import { getBoard } from './catalog'
import type { BoardRole } from './catalog'
import type { WorkerEnv } from './env'
import { RoomStore } from './room-store'

interface Connection {
  presence: Presence
  role: BoardRole
  expiresAt: number
  sessionId: string
}

const cursorColors = ['#ad6f20', '#7553be', '#1e817a', '#b34b69', '#4176b2']
const maxMessageLength = 8 * 1024 * 1024
const accessLost = 4403

function connection(socket: WebSocket): Connection {
  return socket.deserializeAttachment() as Connection
}

function send(socket: WebSocket, data: string) {
  if (socket.readyState !== WebSocket.OPEN) return
  if (connection(socket).expiresAt <= Date.now()) {
    socket.close(accessLost, 'Sign in to reconnect.')
    return
  }
  socket.send(data)
}

export class BoardRoom extends DurableObject<WorkerEnv> {
  private readonly store: RoomStore
  private readonly lastCursor = new WeakMap<WebSocket, number>()
  private accessGeneration = 0

  constructor(ctx: DurableObjectState, env: WorkerEnv) {
    super(ctx, env)
    // Schema setup uses synchronous SQLite so the room is ready before its first event.
    this.store = new RoomStore(ctx.storage)
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket required', { status: 426 })
    }

    const boardId = new URL(request.url).pathname.slice(1)
    const userId = request.headers.get('X-Whiteboard-User')
    const sessionId = request.headers.get('X-Whiteboard-Session')
    const expiresAt = Number(request.headers.get('X-Whiteboard-Expiry'))
    if (!userId || !sessionId || !Number.isFinite(expiresAt) || expiresAt <= Date.now() || this.store.deleted) {
      return new Response('Board unavailable', { status: 404 })
    }

    const role = await this.connectionRole(boardId, userId, sessionId)
    if (!role || this.store.deleted) return new Response('Board unavailable', { status: 404 })
    const name = decodeURIComponent(request.headers.get('X-Whiteboard-Name') ?? 'Member')
    const id = crypto.randomUUID()
    const color = cursorColors[this.ctx.getWebSockets().length % cursorColors.length]
    const presence: Presence = { id, userId, name, color, point: null }
    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ presence, role, expiresAt, sessionId } satisfies Connection)
    this.send(server, { type: 'snapshot', connectionId: id, ...this.store.snapshot(), presence: this.presence() })
    this.broadcastPresence()
    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > maxMessageLength) {
      socket.close(1009, 'Message is too large.')
      return
    }
    const state = connection(socket)
    if (state.expiresAt <= Date.now()) {
      socket.close(accessLost, 'Sign in to reconnect.')
      return
    }
    let input: unknown
    try {
      input = JSON.parse(raw)
    } catch {
      socket.close(1007, 'Invalid board message.')
      return
    }
    const message = parseClientMessage(input)
    if (!message) {
      socket.close(1007, 'Invalid board message.')
      return
    }
    if (message.type === 'cursor') {
      const now = Date.now()
      if (message.point && now - (this.lastCursor.get(socket) ?? 0) < 24) return
      this.lastCursor.set(socket, now)
      state.presence.point = message.point
      socket.serializeAttachment(state)
      this.broadcastPresence()
      return
    }

    const { id, changes } = message
    if (state.role === 'viewer') {
      this.send(socket, { type: 'reject', id, reason: 'This board is view-only.' })
      return
    }

    const result = this.store.commit(state.presence.userId, id, changes)
    switch (result.status) {
      case 'duplicate':
        this.send(socket, { type: 'ack', id })
        break
      case 'rejected':
        this.send(socket, { type: 'reject', id, reason: result.reason })
        break
      case 'applied':
        this.broadcast({ type: 'commit', revision: result.revision, id, changes })
        break
    }
  }

  webSocketClose(socket: WebSocket, code: number, reason: string) {
    if (code === 1005) socket.close()
    else socket.close(code, reason)
    this.broadcastPresence(socket)
  }

  webSocketError(socket: WebSocket) {
    socket.close(1011, 'Connection interrupted.')
    this.broadcastPresence(socket)
  }

  preview() {
    return this.store.preview()
  }

  disconnectUser(userId: string) {
    this.disconnect(userId, 'Board access was removed.', () => true)
  }

  disconnectSessions(userId: string, revokedSessionIds: string[]) {
    const revoked = new Set(revokedSessionIds)
    this.disconnect(userId, 'Sign in to reconnect.', (state) => revoked.has(state.sessionId))
  }

  removeBoard() {
    this.store.remove()
    for (const socket of this.ctx.getWebSockets()) {
      socket.close(accessLost, 'This board was deleted.')
    }
  }

  private async connectionRole(boardId: string, userId: string, sessionId: string) {
    // D1 lookups can yield to an access change. Repeat a read whose result may be stale
    // so a racing handshake cannot recreate the connection a revocation just closed.
    for (;;) {
      const generation = this.accessGeneration
      const board = await getBoard(this.env.DB, boardId, userId)
      if (!board) return null
      const session = await this.env.DB.prepare('SELECT id FROM "session" WHERE id = ? AND userId = ?')
        .bind(sessionId, userId).first()
      if (generation === this.accessGeneration) return session ? board.role : null
    }
  }

  private disconnect(userId: string, reason: string, revoked: (state: Connection) => boolean) {
    this.accessGeneration += 1
    for (const socket of this.ctx.getWebSockets()) {
      const state = connection(socket)
      if (state.presence.userId === userId && revoked(state)) socket.close(accessLost, reason)
    }
    this.broadcastPresence()
  }

  private presence(except?: WebSocket) {
    return this.ctx.getWebSockets()
      .filter((socket) => socket !== except && socket.readyState === WebSocket.OPEN)
      .map(connection)
      .filter(({ expiresAt }) => expiresAt > Date.now())
      .map(({ presence }) => presence)
  }

  private broadcastPresence(except?: WebSocket) {
    this.broadcast({ type: 'presence', presence: this.presence(except) })
  }

  private send(socket: WebSocket, packet: ServerMessage) {
    send(socket, JSON.stringify(packet))
  }

  private broadcast(packet: ServerMessage) {
    const data = JSON.stringify(packet)
    for (const socket of this.ctx.getWebSockets()) send(socket, data)
  }
}
