import { elementsEqual } from '../shared/model'
import type { BoardChange, BoardElement } from '../shared/model'

type BoardRow = { data: string }
type RoomState = { revision: number; bytes: number; count: number; deleted: number }
type CommitResult =
  | { status: 'applied'; revision: number }
  | { status: 'duplicate' }
  | { status: 'rejected'; reason: string }

const byteLimit = 8 * 1024 * 1024
const elementLimit = 25_000
const encoder = new TextEncoder()

export class RoomStore {
  private readonly sql: SqlStorage

  constructor(private readonly storage: DurableObjectStorage) {
    this.sql = storage.sql
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS board_elements (
        id TEXT PRIMARY KEY, data TEXT NOT NULL, bytes INTEGER NOT NULL, source TEXT, target TEXT
      );
      CREATE INDEX IF NOT EXISTS connector_source ON board_elements(source);
      CREATE INDEX IF NOT EXISTS connector_target ON board_elements(target);
      CREATE TABLE IF NOT EXISTS commits (
        user_id TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY(user_id, id)
      );
      CREATE TABLE IF NOT EXISTS room_state (
        id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL,
        bytes INTEGER NOT NULL, count INTEGER NOT NULL, deleted INTEGER NOT NULL
      );
      INSERT OR IGNORE INTO room_state VALUES (1, 0, 0, 0, 0);
    `)
  }

  snapshot() {
    return { revision: this.state().revision, elements: this.readElements() }
  }

  preview() {
    return this.readElements(48)
  }

  get deleted() {
    return Boolean(this.state().deleted)
  }

  remove() {
    this.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM board_elements')
      this.sql.exec('DELETE FROM commits')
      this.sql.exec('UPDATE room_state SET deleted = 1, bytes = 0, count = 0 WHERE id = 1')
    })
  }

  commit(userId: string, id: string, changes: BoardChange[]): CommitResult {
    return this.storage.transactionSync(() => {
      if (this.sql.exec('SELECT 1 FROM commits WHERE user_id = ? AND id = ?', userId, id).toArray().length) {
        return { status: 'duplicate' }
      }
      const state = this.state()
      if (state.deleted) return { status: 'rejected', reason: 'This board was deleted.' }

      let { bytes, count } = state
      const future = new Map(changes.map((change) => [change.id, change.after]))
      const rows = changes.map(({ id, before, after }) => {
        const row = this.sql.exec<BoardRow & { bytes: number }>(
          'SELECT data, bytes FROM board_elements WHERE id = ?', id,
        ).toArray()[0]
        if (!elementsEqual(before, row ? parseElement(row.data) : null)) return null
        const data = after ? JSON.stringify(after) : ''
        const size = encoder.encode(data).byteLength
        bytes += size - (row?.bytes ?? 0)
        count += Number(Boolean(after)) - Number(Boolean(before))
        return { id, before, after, data, size }
      })
      if (rows.some((row) => row === null)) {
        return { status: 'rejected', reason: 'An element was changed by a collaborator.' }
      }
      if (bytes > byteLimit || count > elementLimit) {
        return { status: 'rejected', reason: 'This board reached its storage limit.' }
      }

      const futureElement = (elementId: string) => {
        if (future.has(elementId)) return future.get(elementId)
        const row = this.sql.exec<BoardRow>('SELECT data FROM board_elements WHERE id = ?', elementId).toArray()[0]
        return row ? parseElement(row.data) : null
      }

      for (const row of rows) {
        if (!row) continue
        const { id: elementId, before, after } = row
        if (after?.type === 'connector') {
          if (!isAnchor(futureElement(after.sourceId)) || !isAnchor(futureElement(after.targetId))) {
            return { status: 'rejected', reason: 'Both connector endpoints must exist.' }
          }
        }
        if (!isAnchor(before) || isAnchor(after)) continue
        // Deleting or replacing an anchor must account for unchanged edges too. Indexes avoid
        // scanning the board, and the future values allow bundled deletes or endpoint changes.
        const oldEdges = this.sql.exec<{ id: string }>(
          'SELECT id FROM board_elements WHERE source = ?1 OR target = ?1', elementId,
        )
        for (const edge of oldEdges) {
          const next = futureElement(edge.id)
          if (next?.type === 'connector' && (next.sourceId === elementId || next.targetId === elementId)) {
            return { status: 'rejected', reason: 'Remove or reconnect the attached connector first.' }
          }
        }
      }

      for (const row of rows) {
        if (!row) continue
        if (!row.after) {
          this.sql.exec('DELETE FROM board_elements WHERE id = ?', row.id)
          continue
        }
        const connector = row.after.type === 'connector' ? row.after : null
        this.sql.exec(`
          INSERT INTO board_elements (id, data, bytes, source, target) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            data = excluded.data, bytes = excluded.bytes, source = excluded.source, target = excluded.target
        `, row.id, row.data, row.size, connector?.sourceId ?? null, connector?.targetId ?? null)
      }
      const revision = state.revision + 1
      this.sql.exec('UPDATE room_state SET revision = ?, bytes = ?, count = ? WHERE id = 1', revision, bytes, count)
      this.sql.exec('INSERT INTO commits (user_id, id) VALUES (?, ?)', userId, id)
      return { status: 'applied', revision }
    })
  }

  private state() {
    return this.sql.exec<RoomState>('SELECT revision, bytes, count, deleted FROM room_state WHERE id = 1').one()
  }

  private readElements(limit?: number) {
    const rows = limit
      ? this.sql.exec<BoardRow>(
          'SELECT data FROM board_elements ORDER BY source IS NOT NULL, rowid LIMIT ?', limit,
        )
      : this.sql.exec<BoardRow>('SELECT data FROM board_elements ORDER BY rowid')
    return Array.from(rows, ({ data }) => parseElement(data))
  }
}

function isAnchor(element: BoardElement | null | undefined) {
  return element != null && element.type !== 'connector'
}

function parseElement(data: string): BoardElement {
  return JSON.parse(data) as BoardElement
}
