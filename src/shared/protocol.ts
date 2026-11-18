import type { BoardChange, BoardElement, Point } from './model';
import { isChanges, isElement, isId, isPoint, isRecord } from './validation';

export interface Presence {
  id: string;
  userId: string;
  name: string;
  color: string;
  point: Point | null;
}

export type ClientMessage =
  | { type: 'commit'; id: string; changes: BoardChange[] }
  | { type: 'cursor'; point: Point | null };

export type ServerMessage =
  | { type: 'snapshot'; revision: number; elements: BoardElement[]; presence: Presence[]; connectionId?: string }
  | { type: 'commit'; revision: number; id: string; changes: BoardChange[] }
  | { type: 'reject'; id: string; reason: string }
  | { type: 'ack'; id: string }
  | { type: 'presence'; presence: Presence[] };

export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!isRecord(value)) return null;
  if (value.type === 'commit' && isId(value.id) && isChanges(value.changes)) {
    return { type: 'commit', id: value.id, changes: value.changes };
  }
  if (value.type === 'cursor' && (value.point === null || isPoint(value.point))) {
    return { type: 'cursor', point: value.point };
  }
  return null;
}

function isPresence(value: unknown): value is Presence[] {
  return Array.isArray(value) && value.every(peer => isRecord(peer) &&
    typeof peer.id === 'string' && typeof peer.userId === 'string' &&
    typeof peer.name === 'string' && typeof peer.color === 'string' &&
    (peer.point === null || isPoint(peer.point)));
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function parseServerMessage(value: unknown): ServerMessage | null {
  if (!isRecord(value)) return null;
  switch (value.type) {
    case 'snapshot':
      return isRevision(value.revision) && Array.isArray(value.elements) &&
        value.elements.every(isElement) && isPresence(value.presence) &&
        (value.connectionId === undefined || isId(value.connectionId))
        ? { type: value.type, revision: value.revision, elements: value.elements, presence: value.presence, connectionId: value.connectionId }
        : null;
    case 'commit':
      return isRevision(value.revision) && isId(value.id) && isChanges(value.changes)
        ? { type: value.type, revision: value.revision, id: value.id, changes: value.changes }
        : null;
    case 'reject':
      return isId(value.id) && typeof value.reason === 'string'
        ? { type: value.type, id: value.id, reason: value.reason }
        : null;
    case 'ack':
      return isId(value.id) ? { type: value.type, id: value.id } : null;
    case 'presence':
      return isPresence(value.presence) ? { type: value.type, presence: value.presence } : null;
    default:
      return null;
  }
}
