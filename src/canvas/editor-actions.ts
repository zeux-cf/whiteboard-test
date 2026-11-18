import type { BoardChange, BoardElement, Point } from '../shared/model'
import type { Scene } from './scene'
import { center, ports, type Bounds, type NodeElement } from './geometry'
import type { Anchor, Shape } from './editor-types'

export function newNode(type: Shape | 'text', box: Bounds, color: string): NodeElement {
  return {id:crypto.randomUUID(),type,...box,label:'',color}
}

export function createAt(type: Shape | 'text', point: Point, color: string): NodeElement {
  const width = type === 'diamond' ? 154 : 160
  const height = type === 'text' ? 42 : type === 'diamond' ? 112 : 62
  return newNode(type,{x:point.x-width/2,y:point.y-height/2,width,height},color)
}

export function updateChanges(scene: Scene, selected: ReadonlySet<string>, update: (element: BoardElement) => BoardElement): BoardChange[] {
  return scene.elements.filter(element => selected.has(element.id)).flatMap(element => {
    const after = update(element)
    return after === element ? [] : [{id:element.id,before:element,after}]
  })
}

export function deleteChanges(scene: Scene, selected: ReadonlySet<string>): BoardChange[] {
  return scene.elements.filter(element => selected.has(element.id) || (element.type === 'connector' && (selected.has(element.sourceId) || selected.has(element.targetId))))
    .map(element => ({id:element.id,before:element,after:null}))
}

export function duplicateChanges(scene: Scene, selected: ReadonlySet<string>): BoardChange[] {
  const nodeIds = new Map<string,string>()
  const changes: BoardChange[] = []
  for (const node of scene.nodes.values()) {
    if (!selected.has(node.id)) continue
    const id = crypto.randomUUID()
    nodeIds.set(node.id,id)
    changes.push({id,before:null,after:{...node,id,x:node.x+24,y:node.y+24}})
  }
  for (const connector of scene.connectors) {
    const sourceId = nodeIds.get(connector.sourceId)
    const targetId = nodeIds.get(connector.targetId)
    // Internal connectors are copied automatically. Explicitly selected standalone edges retain their endpoints.
    if ((!sourceId || !targetId) && !selected.has(connector.id)) continue
    const id = crypto.randomUUID()
    changes.push({id,before:null,after:{...connector,id,sourceId:sourceId ?? connector.sourceId,targetId:targetId ?? connector.targetId}})
  }
  return changes
}

export function pickAnchor(scene: Scene, point: Point, zoom: number): Anchor | null {
  for (const node of Array.from(scene.nodes.values()).reverse()) {
    for (const [side,port] of ports(node)) {
      if (Math.hypot(point.x-port.x,point.y-port.y) <= 12/zoom) return {id:node.id,side,point:port}
    }
    if (point.x >= node.x && point.x <= node.x+node.width && point.y >= node.y && point.y <= node.y+node.height) {
      return {id:node.id,point:center(node)}
    }
  }
  return null
}

export function moveNodes(nodes: readonly NodeElement[], displacement: Point): Map<string,NodeElement> {
  return new Map(nodes.map(node => [node.id,{...node,x:node.x+displacement.x,y:node.y+displacement.y}]))
}
