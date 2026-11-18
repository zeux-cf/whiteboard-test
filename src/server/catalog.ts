import type { WorkerEnv } from './env'

export type SharedRole = 'editor' | 'viewer'
export type BoardRole = 'owner' | SharedRole
type BoardRow = { id: string; title: string; role: BoardRole; updatedAt: string }

export function listBoards(db: D1Database, userId: string) {
  return db.prepare(`
    SELECT id, title, 'owner' AS role, updated_at AS updatedAt
      FROM boards WHERE owner_id = ?1
    UNION ALL
    SELECT b.id, b.title, m.role, b.updated_at
      FROM board_members m JOIN boards b ON b.id = m.board_id
      WHERE m.user_id = ?1 AND b.owner_id <> ?1
    ORDER BY updatedAt DESC, id
  `).bind(userId).all<BoardRow>()
}

export function getBoard(db: D1Database, id: string, userId: string) {
  return db.prepare(`
    SELECT b.id, b.title, b.updated_at AS updatedAt,
           CASE WHEN b.owner_id = ?2 THEN 'owner' ELSE m.role END AS role
      FROM boards b LEFT JOIN board_members m ON m.board_id = b.id AND m.user_id = ?2
      WHERE b.id = ?1 AND (b.owner_id = ?2 OR m.user_id IS NOT NULL)
  `).bind(id, userId).first<BoardRow>()
}

export async function createBoard(db: D1Database, ownerId: string, title: string): Promise<BoardRow> {
  const id = crypto.randomUUID()
  const updatedAt = new Date().toISOString()
  await db.prepare(`
    INSERT INTO boards (id, title, owner_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)
  `).bind(id, title, ownerId, updatedAt).run()
  return { id, title, updatedAt, role: 'owner' }
}

export function renameBoard(db: D1Database, boardId: string, userId: string, title: string) {
  return db.prepare(`
    UPDATE boards SET title = ?3, updated_at = ?4 WHERE id = ?1 AND owner_id = ?2
    RETURNING id, title, updated_at AS updatedAt, 'owner' AS role
  `).bind(boardId, userId, title, new Date().toISOString()).first<BoardRow>()
}

export async function deleteBoard(env: WorkerEnv, boardId: string, userId: string) {
  await env.DB.prepare('DELETE FROM boards WHERE id = ? AND owner_id = ?').bind(boardId, userId).run()
  await env.BOARD_ROOMS.getByName(boardId).removeBoard()
}
