import type { BoardChange, BoardElement, Point, Side } from './model';

const sides = new Set<Side>(['top', 'right', 'bottom', 'left']);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[\w-]+$/.test(id);
}

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e7;
}

export function isPoint(value: unknown): value is Point {
  return isRecord(value) && isCoordinate(value.x) && isCoordinate(value.y);
}

export function isElement(value: unknown): value is BoardElement {
  if (!isRecord(value) || !isId(value.id) || typeof value.label !== 'string' ||
    value.label.length > 2000 || typeof value.color !== 'string' ||
    !/^(#[\da-f]{3,8}|[a-z]{1,32})$/i.test(value.color)) return false;

  if (value.type === 'connector') {
    return isId(value.sourceId) && isId(value.targetId) &&
      (value.sourceSide === undefined || sides.has(value.sourceSide as Side)) &&
      (value.targetSide === undefined || sides.has(value.targetSide as Side));
  }
  return (value.type === 'rectangle' || value.type === 'ellipse' ||
      value.type === 'diamond' || value.type === 'text') &&
    isPoint(value) && isCoordinate(value.width) && isCoordinate(value.height) &&
    value.width > 0 && value.height > 0;
}

function isChange(value: unknown): value is BoardChange {
  return isRecord(value) && isId(value.id) &&
    (value.before === null || (isElement(value.before) && value.before.id === value.id)) &&
    (value.after === null || (isElement(value.after) && value.after.id === value.id)) &&
    (value.before !== null || value.after !== null);
}

export function isChanges(value: unknown): value is BoardChange[] {
  // One transaction can include every element on a large board.
  return Array.isArray(value) && value.length > 0 && value.length <= 25_000 &&
    value.every(isChange) && new Set(value.map(change => change.id)).size === value.length;
}
