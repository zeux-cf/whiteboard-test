import type { authFor } from './auth'
import { listBoards } from './catalog'
import type { WorkerEnv } from './env'

const invalidatesSession = new Set(['sign-out', 'revoke-session', 'revoke-sessions', 'revoke-other-sessions'])

export async function handleAuth(
  auth: ReturnType<typeof authFor>,
  request: Request,
  env: WorkerEnv,
  path: string | undefined,
  ctx: ExecutionContext,
) {
  if (request.method !== 'POST' || !path || !invalidatesSession.has(path)) {
    return auth.handler(request)
  }

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return auth.handler(request)

  const { id: userId } = session.user
  const before = path === 'sign-out'
    ? [session.session.id]
    : await listSessions(env.DB, userId)
  const response = await auth.handler(request)
  if (response.ok) {
    ctx.waitUntil(disconnectRevokedSessions(env, userId, before).catch(() => {
      console.error(JSON.stringify({ event: 'whiteboard_session_disconnect_failed' }))
    }))
  }
  return response
}

async function listSessions(db: D1Database, userId: string) {
  const { results } = await db.prepare('SELECT id FROM "session" WHERE userId = ?')
    .bind(userId).all<{ id: string }>()
  return results.map(({ id }) => id)
}

async function disconnectRevokedSessions(env: WorkerEnv, userId: string, before: string[]) {
  // Target deleted IDs specifically. A session created while the cleanup runs is still valid.
  const active = new Set(await listSessions(env.DB, userId))
  const revoked = before.filter((id) => !active.has(id))
  if (!revoked.length) return

  const { results } = await listBoards(env.DB, userId)
  for (let offset = 0; offset < results.length; offset += 16) {
    await Promise.all(results.slice(offset, offset + 16).map(({ id }) =>
      env.BOARD_ROOMS.getByName(id).disconnectSessions(userId, revoked),
    ))
  }
}
