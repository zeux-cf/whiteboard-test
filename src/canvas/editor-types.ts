import type { BoardChange, BoardElement, Point } from '../shared/model'
import type { Presence } from '../shared/protocol'
import type { Bounds, Camera, ConnectorElement, Handle, NodeElement } from './geometry'

export type Tool = 'select' | 'hand' | 'shape' | 'text' | 'connector'
export type Shape = 'rectangle' | 'ellipse' | 'diamond'
export type CanvasHandle = {
  fit(): void
  zoomTo(zoom: number): void
  renameSelected(): void
  setColor(color: string): void
  duplicate(): void
  deleteSelected(): void
}

export type EditorProps = {
  elements: readonly BoardElement[]
  presence?: readonly Presence[]
  title?: string
  dark?: boolean
  readOnly?: boolean
  onCommit(changes: BoardChange[]): void
  onCursor?(point: Point | null): void
  onUndo?(): void
  onRedo?(): void
  canUndo?: boolean
  canRedo?: boolean
}

export type Gesture =
  | {type:'pan'; start:Point; camera:Camera}
  | {type:'move'; start:Point; nodes:NodeElement[]}
  | {type:'resize'; start:Point; nodes:NodeElement[]; bounds:Bounds; handle:Handle}
  | {type:'draw'; start:Point; kind:Shape}
  | {type:'box'; start:Point; selected:Set<string>}

export type Anchor = {id:string; side?:ConnectorElement['sourceSide']; point:Point}
