import { z } from 'zod'
import { authFor, googleCredentials } from './auth'
import { createBoard, deleteBoard, getBoard, listBoards, renameBoard } from './catalog'
import type { WorkerEnv } from './env'
import { HttpError, json, readBody, sameOrigin } from './http'
import { handleAuth } from './session-access'
import { createInvite, listAccess, redeemInvite, revokeInvite, revokeMember } from './sharing'

const title = z.string().trim().min(1).max(120)
const boardInput = z.object({ title })
const newBoardInput = z.object({ title: title.optional() })
const inviteInput = z.object({ role: z.enum(['editor', 'viewer']) })

export async function handleApi(request: Request, env: WorkerEnv, url: URL, ctx: ExecutionContext): Promise<Response> {
  try {
    return await routeApi(request, env, url, ctx)
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status)
    console.error(JSON.stringify({ event: 'whiteboard_request_failed', error: error instanceof Error ? error.name : 'Unknown' }))
    return json({ error: 'Whiteboard could not complete the request.' }, 500)
  }
}

async function routeApi(request: Request, env: WorkerEnv, url: URL, ctx: ExecutionContext): Promise<Response> {
  const method = request.method
  const [, , resource, id, action, target, extra] = url.pathname.split('/')
  if (method !== 'GET' && method !== 'HEAD') sameOrigin(request, url)
  if (resource === 'config' && !id && method === 'GET') {
    return json({ googleEnabled: Boolean(googleCredentials(env)) })
  }

  const auth = authFor(env, url)
  if (resource === 'auth') return handleAuth(auth, request, env, id, ctx)
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) throw new HttpError(401, 'Sign in to continue.')
  const { user } = session

  if (resource === 'invites' && id && !action && method === 'POST') {
    const board = await redeemInvite(env.DB, id, user.id)
    if (!board) throw new HttpError(404, 'This invite is no longer available.')
    return json({ board })
  }
  if (resource !== 'boards' || extra) throw new HttpError(404, 'Page unavailable.')
  if (!id && method === 'GET') {
    const { results } = await listBoards(env.DB, user.id)
    const boards = await Promise.all(results.map(async (board, index) => {
      if (index >= 24) return board
      const preview = await env.BOARD_ROOMS.getByName(board.id).preview().catch(() => undefined)
      return { ...board, preview }
    }))
    return json({ boards })
  }
  if (!id && method === 'POST') {
    const input = await readBody(request, newBoardInput)
    return json({ board: await createBoard(env.DB, user.id, input.title ?? 'Untitled board') }, 201)
  }
  if (!id) throw new HttpError(405, 'Method unavailable.')
  const board = await getBoard(env.DB, id, user.id)
  if (!board) throw new HttpError(404, 'Board unavailable.')

  if (!action && method === 'GET') return json({ board })
  if (action === 'socket' && !target && method === 'GET') {
    sameOrigin(request, url, true)
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      throw new HttpError(426, 'This endpoint requires a WebSocket.')
    }
    const headers = new Headers({
      Upgrade: 'websocket',
      'X-Whiteboard-User': user.id,
      'X-Whiteboard-Name': encodeURIComponent(user.name.slice(0, 70)),
      'X-Whiteboard-Expiry': String(session.session.expiresAt.getTime()),
      'X-Whiteboard-Session': session.session.id,
    })
    // Only known identity fields cross into the room. The room re-reads current access.
    return env.BOARD_ROOMS.getByName(id).fetch(new Request(`https://whiteboard.internal/${id}`, { headers }))
  }

  if (board.role !== 'owner') throw new HttpError(403, 'Only the board owner can make this change.')
  if (!action && method === 'PATCH') {
    const input = await readBody(request, boardInput)
    const renamed = await renameBoard(env.DB, id, user.id, input.title)
    if (!renamed) throw new HttpError(404, 'Board unavailable.')
    return json({ board: renamed })
  }
  if (!action && method === 'DELETE') {
    await deleteBoard(env, id, user.id)
    return new Response(null, { status: 204 })
  }
  if (action === 'access' && !target && method === 'GET') return json(await listAccess(env.DB, id))
  if (action === 'invites' && !target && method === 'POST') {
    const { role } = await readBody(request, inviteInput)
    const { invite, token } = await createInvite(env.DB, id, role)
    const link = new URL(`/invite/${token}`, env.BETTER_AUTH_URL || url.origin).href
    return json({ invite, url: link }, 201)
  }
  if (action === 'invites' && target && method === 'DELETE') {
    await revokeInvite(env.DB, id, target)
    return new Response(null, { status: 204 })
  }
  if (action === 'members' && target && method === 'DELETE') {
    await revokeMember(env, id, target)
    return new Response(null, { status: 204 })
  }
  throw new HttpError(404, 'Page unavailable.')
}
