import type { BoardRole, SharedRole } from './catalog'
import type { WorkerEnv } from './env'

type Invite = { id: string; role: SharedRole; createdAt: string }
type Member = { id: string; name: string; role: BoardRole }

async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('')
}

export async function listAccess(db: D1Database, boardId: string) {
  const [members, invites] = await db.batch([
    db.prepare(`
      SELECT u.id, u.name, 'owner' AS role FROM boards b JOIN "user" u ON u.id = b.owner_id
      WHERE b.id = ?1
      UNION ALL
      SELECT u.id, u.name, m.role FROM board_members m JOIN "user" u ON u.id = m.user_id
      WHERE m.board_id = ?1 ORDER BY role DESC, name, id
    `).bind(boardId),
    db.prepare(`
      SELECT id, role, created_at AS createdAt FROM board_invites WHERE board_id = ?
      ORDER BY created_at DESC, id
    `).bind(boardId),
  ])
  return { members: members.results as Member[], invites: invites.results as Invite[] }
}

export async function createInvite(db: D1Database, boardId: string, role: SharedRole) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) =>
    value.toString(16).padStart(2, '0')).join('')
  const invite: Invite = { id: crypto.randomUUID(), role, createdAt: new Date().toISOString() }
  await db.prepare(`
    INSERT INTO board_invites (id, board_id, token_hash, role, created_at) VALUES (?, ?, ?, ?, ?)
  `).bind(invite.id, boardId, await hashToken(token), role, invite.createdAt).run()
  return { invite, token }
}

export async function redeemInvite(db: D1Database, token: string, userId: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null
  const hash = await hashToken(token)
  // A link cannot lower an existing editor to viewer. Rechecking the link in the write avoids
  // a race where a read of a valid token is followed by redemption after the owner revokes it.
  const [, board] = await db.batch([
    db.prepare(`
      INSERT INTO board_members (board_id, user_id, role, created_at)
      SELECT b.id, ?2, i.role, ?3 FROM board_invites i JOIN boards b ON b.id = i.board_id
      WHERE i.token_hash = ?1 AND b.owner_id <> ?2
      ON CONFLICT(board_id, user_id) DO UPDATE SET role =
        CASE WHEN board_members.role = 'editor' THEN 'editor' ELSE excluded.role END
    `).bind(hash, userId, new Date().toISOString()),
    db.prepare(`
      SELECT b.id, b.title, b.updated_at AS updatedAt,
             CASE WHEN b.owner_id = ?2 THEN 'owner' ELSE m.role END AS role
      FROM board_invites i JOIN boards b ON b.id = i.board_id
      LEFT JOIN board_members m ON m.board_id = b.id AND m.user_id = ?2
      WHERE i.token_hash = ?1 AND (b.owner_id = ?2 OR m.user_id IS NOT NULL)
    `).bind(hash, userId),
  ])
  return board.results[0] ?? null
}

export function revokeInvite(db: D1Database, boardId: string, inviteId: string) {
  return db.prepare('DELETE FROM board_invites WHERE board_id = ? AND id = ?').bind(boardId, inviteId).run()
}

export async function revokeMember(env: WorkerEnv, boardId: string, userId: string) {
  await env.DB.prepare('DELETE FROM board_members WHERE board_id = ? AND user_id = ?').bind(boardId, userId).run()
  await env.BOARD_ROOMS.getByName(boardId).disconnectUser(userId)
}
