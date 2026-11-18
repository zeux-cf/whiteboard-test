import type { BoardElement, Point } from '../shared/model'

export type NodeElement = Exclude<BoardElement, {type: 'connector'}>
export type ConnectorElement = Extract<BoardElement, {type: 'connector'}>
export type Camera = Point & {zoom: number}
export type Size = {width: number; height: number}
export type Bounds = Point & Size
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export function toWorld(point: Point, camera: Camera): Point {
  return {x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom}
}

export function toScreen(point: Point, camera: Camera): Point {
  return {x: point.x * camera.zoom + camera.x, y: point.y * camera.zoom + camera.y}
}

export function zoomAt(camera: Camera, point: Point, value: number): Camera {
  const zoom = Math.min(4, Math.max(0.05, value))
  const world = toWorld(point, camera)
  return {x: point.x - world.x * zoom, y: point.y - world.y * zoom, zoom}
}

export function getBounds(a: Point, b: Point): Bounds {
  return {x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y)}
}

export function union(a: Bounds | null, b: Bounds): Bounds {
  if (!a) return b
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {x,y,width: Math.max(a.x+a.width,b.x+b.width)-x,height: Math.max(a.y+a.height,b.y+b.height)-y}
}

export function intersects(a: Bounds,b: Bounds): boolean {
  return a.x <= b.x+b.width && a.x+a.width >= b.x && a.y <= b.y+b.height && a.y+a.height >= b.y
}

export function contains(bounds: Bounds, point: Point, padding = 0): boolean {
  return point.x >= bounds.x-padding && point.x <= bounds.x+bounds.width+padding
    && point.y >= bounds.y-padding && point.y <= bounds.y+bounds.height+padding
}

export function center(node: Bounds): Point {
  return {x:node.x+node.width/2,y:node.y+node.height/2}
}

export function handles(bounds: Bounds): [Handle, Point][] {
  const {x,y,width,height} = bounds
  return [
    ['nw',{x,y}],['n',{x:x+width/2,y}],['ne',{x:x+width,y}],
    ['e',{x:x+width,y:y+height/2}],['se',{x:x+width,y:y+height}],
    ['s',{x:x+width/2,y:y+height}],['sw',{x,y:y+height}],['w',{x,y:y+height/2}],
  ]
}

export function resizeBounds(bounds: Bounds, handle: Handle, point: Point): Bounds {
  const x = handle.includes('w') ? Math.min(point.x,bounds.x+bounds.width-12) : bounds.x
  const y = handle.includes('n') ? Math.min(point.y,bounds.y+bounds.height-12) : bounds.y
  const right = handle.includes('e') ? Math.max(point.x,bounds.x+12) : bounds.x+bounds.width
  const bottom = handle.includes('s') ? Math.max(point.y,bounds.y+12) : bounds.y+bounds.height
  return {x,y,width:right-x,height:bottom-y}
}

export function scaleNode(node: NodeElement, before: Bounds, after: Bounds): NodeElement {
  const sx = after.width / before.width
  const sy = after.height / before.height
  return {...node,x:after.x+(node.x-before.x)*sx,y:after.y+(node.y-before.y)*sy,width:Math.max(12,node.width*sx),height:Math.max(12,node.height*sy)}
}

type Side = NonNullable<ConnectorElement['sourceSide']>

const vectors: Record<Side, Point> = {top:{x:0,y:-1},right:{x:1,y:0},bottom:{x:0,y:1},left:{x:-1,y:0}}

function facingSide(from: NodeElement, to: Point): Side {
  const mid = center(from)
  const dx = (to.x-mid.x)/from.width
  const dy = (to.y-mid.y)/from.height
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'top' : 'bottom'
}

export function ports(node: NodeElement): [Side, Point][] {
  return (Object.keys(vectors) as Side[]).map(side => [side, anchor(node,side)])
}

function anchor(node: NodeElement, side: Side): Point {
  const mid = center(node)
  const vector = vectors[side]
  return {x:mid.x+vector.x*node.width/2,y:mid.y+vector.y*node.height/2}
}

export function connectorPath(connector: ConnectorElement, nodes: ReadonlyMap<string,NodeElement>): Point[] | null {
  const source = nodes.get(connector.sourceId)
  const target = nodes.get(connector.targetId)
  if (!source || !target) return null
  const from = connector.sourceSide ?? facingSide(source,center(target))
  const to = connector.targetSide ?? facingSide(target,center(source))
  const a = anchor(source,from)
  const b = anchor(target,to)
  const av = vectors[from]
  const bv = vectors[to]
  if (Math.abs(a.x-b.x) < 0.01 || Math.abs(a.y-b.y) < 0.01) return [a,b]
  if (av.x && bv.y) return [a,{x:b.x,y:a.y},b]
  if (av.y && bv.x) return [a,{x:a.x,y:b.y},b]
  if (av.x) {
    const x = (a.x+b.x)/2
    return [a,{x,y:a.y},{x,y:b.y},b]
  }
  const y = (a.y+b.y)/2
  return [a,{x:a.x,y},{x:b.x,y},b]
}

export function connectorLabelPoint(path: readonly Point[]): Point {
  let start = path[0]
  let end = path[1]
  let best = -1
  for (let i = 1; i < path.length; i++) {
    const a = path[i-1]
    const b = path[i]
    const horizontal = Math.abs(b.x-a.x)
    // Prefer a horizontal run, where upright text can sit clear of the connector.
    const rank = horizontal ? horizontal : Math.abs(b.y-a.y)/1e8
    if (rank <= best) continue
    best = rank
    start = a
    end = b
  }
  return {x:(start.x+end.x)/2,y:(start.y+end.y)/2-13}
}

export function pathBounds(path: readonly Point[]): Bounds {
  return path.reduce<Bounds | null>((box,point) => union(box,{...point,width:0,height:0}),null)!
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x-a.x
  const dy = b.y-a.y
  const squared = dx*dx+dy*dy
  const t = squared ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/squared)) : 0
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)
}

function nodeContains(node: NodeElement, point: Point): boolean {
  if (!contains(node,point)) return false
  const mid = center(node)
  const dx = Math.abs(point.x-mid.x)/(node.width/2)
  const dy = Math.abs(point.y-mid.y)/(node.height/2)
  if (node.type === 'ellipse') return dx*dx+dy*dy <= 1
  if (node.type === 'diamond') return dx+dy <= 1
  return true
}

export function hitTest(elements: readonly BoardElement[], nodes: ReadonlyMap<string,NodeElement>, point: Point, tolerance: number): BoardElement | undefined {
  for (let i = elements.length-1; i >= 0; i--) {
    const element = elements[i]
    if (element.type !== 'connector' && nodeContains(element,point)) return element
  }
  for (let i = elements.length-1; i >= 0; i--) {
    const element = elements[i]
    if (element.type !== 'connector') continue
    const path = connectorPath(element,nodes)
    if (path?.some((end,index) => index > 0 && segmentDistance(point,path[index-1],end) <= tolerance)) return element
  }
}

export function fitCamera(bounds: Bounds | null, size: Size, padding = size.width <= 500 ? 28 : 85, limit = 1.5): Camera {
  const mid = {x:size.width/2,y:size.height/2}
  if (!bounds) return {...mid,zoom:1}
  const zoom = Math.max(0.05,Math.min(limit,(size.width-padding*2)/Math.max(1,bounds.width),(size.height-padding*2)/Math.max(1,bounds.height)))
  const target = center(bounds)
  return {x:mid.x-target.x*zoom,y:mid.y-target.y*zoom,zoom}
}
