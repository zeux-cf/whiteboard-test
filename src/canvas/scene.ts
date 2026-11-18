import type { BoardElement } from '../shared/model'
import { connectorPath, intersects, pathBounds, union, type Bounds, type ConnectorElement, type NodeElement } from './geometry'

export function makeScene(elements: readonly BoardElement[]) {
  const byId = new Map<string,BoardElement>()
  const nodes = new Map<string,NodeElement>()
  const connectors: ConnectorElement[] = []
  let bounds: Bounds | null = null
  for (const element of elements) {
    byId.set(element.id,element)
    if (element.type === 'connector') {
      connectors.push(element)
    } else {
      nodes.set(element.id,element)
      bounds = union(bounds,element)
    }
  }
  return {elements,byId,nodes,connectors,bounds}
}
export type Scene = ReturnType<typeof makeScene>

export function selectBox(scene: Scene, bounds: Bounds): Set<string> {
  const ids = new Set<string>()
  for (const node of scene.nodes.values()) {
    if (intersects(node,bounds)) ids.add(node.id)
  }
  for (const connector of scene.connectors) {
    const path = connectorPath(connector,scene.nodes)
    if (path && path.slice(1).some((end,i) => intersects(pathBounds([path[i],end]),bounds))) ids.add(connector.id)
  }
  return ids
}

export function selectionBounds(scene: Scene, selection: ReadonlySet<string>): Bounds | null {
  let bounds: Bounds | null = null
  for (const id of selection) {
    const node = scene.nodes.get(id)
    if (node) bounds = union(bounds,node)
  }
  return bounds
}
