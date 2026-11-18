export interface Point {
  x: number;
  y: number;
}

export type BoardRole = 'owner' | 'editor' | 'viewer';
export type Side = 'top' | 'right' | 'bottom' | 'left';

interface ElementStyle {
  id: string;
  label: string;
  color: string;
}

interface PositionedElement extends ElementStyle, Point {
  width: number;
  height: number;
}

export interface ShapeElement extends PositionedElement {
  type: 'rectangle' | 'ellipse' | 'diamond';
}

export interface TextElement extends PositionedElement {
  type: 'text';
}

export interface ConnectorElement extends ElementStyle {
  type: 'connector';
  sourceId: string;
  targetId: string;
  sourceSide?: Side;
  targetSide?: Side;
}

export type BoardElement = ShapeElement | TextElement | ConnectorElement;

export interface BoardChange {
  id: string;
  before: BoardElement | null;
  after: BoardElement | null;
}

export function elementsEqual(a: BoardElement | null, b: BoardElement | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.type !== b.type || a.id !== b.id || a.label !== b.label || a.color !== b.color) {
    return false;
  }
  if (a.type === 'connector' && b.type === 'connector') {
    return a.sourceId === b.sourceId && a.targetId === b.targetId &&
      a.sourceSide === b.sourceSide && a.targetSide === b.targetSide;
  }
  if (a.type === 'connector' || b.type === 'connector') return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
