import type { KeyboardEvent } from 'react'
import type { CanvasHandle, Shape, Tool } from './editor-types'

type KeyboardOptions = {
  actions: CanvasHandle
  readOnly?: boolean
  onUndo?(): void
  onRedo?(): void
  selectAll(): void
  clear(): void
  setTool(tool: Tool): void
  setShape(shape: Shape): void
  setSpace(held: boolean): void
  zoomBy(factor: number): void
}

export function handleCanvasKey(event: KeyboardEvent<HTMLCanvasElement>, options: KeyboardOptions) {
  const {actions,readOnly,onUndo,onRedo,selectAll,clear,setTool,setShape,setSpace,zoomBy} = options
  const key = event.key.toLowerCase()
  const shortcut = event.metaKey || event.ctrlKey
  const commands: Record<string,()=>void> = {
    escape:clear,
    h:()=>setTool('hand'),
    v:()=>setTool('select'),
    ' ':()=>setSpace(true),
    '0':actions.fit,
    '1':()=>actions.zoomTo(1),
    '+':()=>zoomBy(1.2),
    '=':()=>zoomBy(1.2),
    '-':()=>zoomBy(1/1.2),
  }
  if (!readOnly) Object.assign(commands,{
    r:()=>setShape('rectangle'),o:()=>setShape('ellipse'),d:()=>setShape('diamond'),
    t:()=>setTool('text'),c:()=>setTool('connector'),delete:actions.deleteSelected,
    backspace:actions.deleteSelected,enter:actions.renameSelected,f2:actions.renameSelected,
  })
  const shortcuts: Record<string,()=>void> = {a:selectAll}
  if (!readOnly) Object.assign(shortcuts,{
    d:actions.duplicate,z:event.shiftKey ? onRedo : onUndo,y:onRedo,
  })
  const action = shortcut ? shortcuts[key] : commands[key]
  if (!action || event.altKey) return
  event.preventDefault()
  action()
}
