import type { BoardRoom } from './board-room'

export interface WorkerEnv {
  DB: D1Database
  BOARD_ROOMS: DurableObjectNamespace<BoardRoom>
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}
