import {useRef,type PointerEvent} from 'react'
import type { BoardElement, Point } from '../shared/model'
import {getBounds,handles,hitTest,resizeBounds,scaleNode,toWorld,type NodeElement} from './geometry'
import {createAt,moveNodes,newNode,pickAnchor} from './editor-actions'
import {makeScene,selectBox,selectionBounds} from './scene'
import type { Anchor, EditorProps, Gesture, Shape, Tool } from './editor-types'
import type { useCanvasView } from './useCanvasView'
import type { PaintState } from './view-types'

type PointerOptions = Pick<EditorProps,'onCommit'|'onCursor'|'readOnly'> & {
  scene: PaintState['scene']
  transient: PaintState['transient']
  view: ReturnType<typeof useCanvasView>
  selected: Set<string>
  select(ids: Set<string>): void
  tool: Tool
  setTool(tool: Tool): void
  shape: Shape
  color: string
  edit(element: BoardElement): void
}

function distance(a: Point,b: Point) { return Math.hypot(a.x-b.x,a.y-b.y) }

export function usePointerEditor(options: PointerOptions) {
  const {view,scene,selected,select,tool,setTool,shape,color,edit,readOnly,onCommit,onCursor,transient} = options
  const gesture = useRef<Gesture | null>(null)
  const connector = useRef<Anchor | null>(null)
  const connectorStart = useRef<Point | null>(null)
  const space = useRef(false)
  const lastCursor = useRef(0)

  function points(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const screen = {x:event.clientX-rect.left,y:event.clientY-rect.top}
    return {screen,world:toWorld(screen,view.camera.current)}
  }

  function reset() {
    gesture.current = null
    connector.current = null
    connectorStart.current = null
    transient.current = {}
    view.redraw()
  }

  function insert(element: BoardElement) {
    onCommit([{id:element.id,before:null,after:element}])
    select(new Set([element.id]))
    setTool('select')
  }

  function connect(point: Point) {
    const anchor = pickAnchor(scene,point,view.camera.current.zoom)
    if (!anchor) return reset()
    const source = connector.current
    if (!source || source.id === anchor.id) {
      connector.current = anchor
      transient.current = {connector:[anchor.point,point]}
      select(new Set([anchor.id]))
      view.redraw()
      return
    }
    insert({id:crypto.randomUUID(),type:'connector',sourceId:source.id,targetId:anchor.id,
      ...(source.side ? {sourceSide:source.side} : {}),...(anchor.side ? {targetSide:anchor.side} : {}),label:'',color})
    reset()
  }

  function down(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 && event.button !== 1) return
    event.preventDefault()
    event.currentTarget.focus()
    const {screen,world} = points(event)
    if (tool === 'hand' || space.current || event.button === 1) {
      gesture.current = {type:'pan',start:screen,camera:view.camera.current}
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.style.cursor = 'grabbing'
      return
    }
    if (!readOnly && tool === 'connector') {
      const started = !!connector.current
      connect(world)
      if (!started && connector.current) {
        connectorStart.current = world
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      return
    }
    if (!readOnly && tool === 'text') {
      const element = createAt('text',world,color)
      insert(element)
      edit(element)
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (!readOnly && tool === 'shape') {
      gesture.current = {type:'draw',start:world,kind:shape}
      return
    }
    const zoom = view.camera.current.zoom
    const bounds = selectionBounds(scene,selected)
    const resize = !readOnly && bounds && handles(bounds).find(([,point]) => distance(point,world) <= 8/zoom)
    if (resize && bounds) {
      gesture.current = {type:'resize',start:world,bounds,handle:resize[0],nodes:selectedNodes(selected)}
      return
    }
    const hit = hitTest(scene.elements,scene.nodes,world,7/zoom)
    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    if (hit) {
      const ids = new Set(additive || selected.has(hit.id) ? selected : [])
      if (additive && ids.has(hit.id)) ids.delete(hit.id)
      else ids.add(hit.id)
      select(ids)
      if (!readOnly && hit.type !== 'connector' && ids.has(hit.id)) gesture.current = {type:'move',start:world,nodes:selectedNodes(ids)}
    } else {
      if (!additive) select(new Set())
      gesture.current = {type:'box',start:world,selected:additive ? selected : new Set()}
    }
  }

  function selectedNodes(ids: Set<string>): NodeElement[] {
    return [...ids].flatMap(id => {
      const node = scene.nodes.get(id)
      return node ? [node] : []
    })
  }

  function drawPreview(map: Map<string,NodeElement>) {
    // Keep temporary node positions in the same scene used to resolve connector anchors.
    transient.current.scene = makeScene(scene.elements.map(element => map.get(element.id) ?? element))
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const {screen,world} = points(event)
    const now = performance.now()
    if (onCursor && now-lastCursor.current >= 32) {
      lastCursor.current = now
      onCursor(world)
    }
    const active = gesture.current
    if (!active) {
      const anchor = connector.current
      if (anchor) {
        const target = pickAnchor(scene,world,view.camera.current.zoom)
        transient.current.connector = [anchor.point,target?.point ?? world]
        view.redraw()
      }
      const bounds = selectionBounds(scene,selected)
      const knob = bounds && handles(bounds).find(([,point]) => distance(point,world) <= 8/view.camera.current.zoom)
      event.currentTarget.style.cursor = knob && !readOnly && tool === 'select'
        ? knob[0]+'-resize' : space.current || tool === 'hand' ? 'grab' : ''
      return
    }
    const dx = world.x-active.start.x
    const dy = world.y-active.start.y
    switch (active.type) {
      case 'pan':
        view.setCamera({...active.camera,x:active.camera.x+screen.x-active.start.x,y:active.camera.y+screen.y-active.start.y})
        return
      case 'move':
        drawPreview(moveNodes(active.nodes,{x:dx,y:dy}))
        break
      case 'resize':
        drawPreview(resized(active,world))
        break
      case 'draw':
        transient.current.draft = {...getBounds(active.start,world),id:'draft',type:active.kind,label:'',color}
        break
      case 'box':
        transient.current.marquee = getBounds(active.start,world)
        break
    }
    view.redraw()
  }

  function resized(active: Extract<Gesture,{type:'resize'}>,world:Point) {
    const original = handles(active.bounds).find(([handle])=>handle === active.handle)![1]
    const point = {x:original.x+world.x-active.start.x,y:original.y+world.y-active.start.y}
    const next = resizeBounds(active.bounds,active.handle,point)
    return new Map(active.nodes.map(node => [node.id,scaleNode(node,active.bounds,next)]))
  }

  function end(event: PointerEvent<HTMLCanvasElement>) {
    const {world} = points(event)
    const start = connectorStart.current
    connectorStart.current = null
    if (start && distance(start,world)*view.camera.current.zoom > 8) {
      const target = pickAnchor(scene,world,view.camera.current.zoom)
      if (target && target.id !== connector.current?.id) connect(world)
    }
    if (!gesture.current) return
    const active = gesture.current
    reset()
    event.currentTarget.style.cursor = ''
    if (active.type === 'pan') return
    const moved = distance(active.start,world)*view.camera.current.zoom > 3
    if (active.type === 'draw') {
      const box = getBounds(active.start,world)
      const sized = moved && box.width >= 12 && box.height >= 12
      const node = sized ? newNode(active.kind,box,color) : createAt(active.kind,world,color)
      return insert(node)
    }
    if (active.type === 'box') {
      if (moved) select(new Set([...active.selected,...selectBox(scene,getBounds(active.start,world))]))
      return
    }
    if (!moved || readOnly) return
    const map = active.type === 'move'
      ? moveNodes(active.nodes,{x:world.x-active.start.x,y:world.y-active.start.y})
      : resized(active,world)
    // Preserve a peer's label/style changes that arrived during our local geometry gesture.
    const changes = active.nodes.flatMap(original => {
      const before = scene.nodes.get(original.id)
      const proposed = map.get(original.id)
      if (!before || !proposed) return []
      const after = {...before,x:before.x+proposed.x-original.x,y:before.y+proposed.y-original.y,
        width:Math.max(12,before.width+proposed.width-original.width),height:Math.max(12,before.height+proposed.height-original.height)}
      return [{id:before.id,before,after}]
    })
    if (changes.length) onCommit(changes)
  }

  function doubleClick(event: PointerEvent<HTMLCanvasElement>) {
    if (readOnly || tool !== 'select') return
    const hit = hitTest(scene.elements,scene.nodes,points(event).world,7/view.camera.current.zoom)
    if (hit) edit(hit)
  }

  return {down,move,end,reset,space,doubleClick,
    cancelGesture:()=>{if (gesture.current) reset()},cursorLeave:()=>onCursor?.(null)}
}
