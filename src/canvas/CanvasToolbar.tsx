import {ArrowCounterClockwiseIcon,ArrowClockwiseIcon,CaretDownIcon,CursorIcon,HandPalmIcon,LineSegmentIcon,SquareIcon,CircleIcon,DiamondIcon,TextTIcon,PaletteIcon,CopyIcon,TrashIcon} from '@phosphor-icons/react'
import {DropdownMenu} from 'radix-ui'
import type {CanvasHandle,Shape,Tool} from './editor-types'

const tools = [
  {tool:'select',label:'Select',key:'V',Icon:CursorIcon},
  {tool:'hand',label:'Hand',key:'H',Icon:HandPalmIcon},
  {tool:'shape',label:'Shape',key:'R',Icon:SquareIcon},
  {tool:'text',label:'Text',key:'T',Icon:TextTIcon},
  {tool:'connector',label:'Connector',key:'C',Icon:LineSegmentIcon},
] as const
const shapes = [
  {type:'rectangle',label:'Rectangle',Icon:SquareIcon},
  {type:'ellipse',label:'Ellipse',Icon:CircleIcon},
  {type:'diamond',label:'Diamond',Icon:DiamondIcon},
] as const
const colors = ['neutral','blue','green','gold','rose','purple']
const colorSwatches = ['#9b9993','#8dafff','#9cb68c','#e3b85f','#db92a5','#bc96da']

type Props = {
  tool: Tool
  setTool(tool: Tool): void
  shape: Shape
  setShape(shape: Shape): void
  color: string
  actions: CanvasHandle
  selected: boolean
  readOnly?: boolean
  onUndo?(): void
  onRedo?(): void
  canUndo?: boolean
  canRedo?: boolean
}

export function CanvasToolbar({tool,setTool,shape,setShape,color,actions,selected,readOnly,onUndo,onRedo,canUndo,canRedo}: Props) {
  return (
    <div className="wb-toolbar">
      <div className="wb-tools" role="group" aria-label="Drawing tools">
        {tools.map(({tool:id,label,key,Icon}) => {
          const disabled = readOnly && id !== 'select' && id !== 'hand'
          return (
            <div key={id} className="wb-tool-group">
              <button type="button" className="wb-tool" aria-pressed={tool===id} disabled={disabled}
                title={label+' ('+key+')'} onClick={() => setTool(id)}>
                <Icon size={22} aria-hidden="true" />
                <span>{label}</span>
              </button>
              {id === 'shape' && !readOnly && (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="wb-tool-caret" type="button" aria-label="Choose shape"><CaretDownIcon size={11} /></button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="wb-tool-menu" sideOffset={8} align="start">
                      <DropdownMenu.RadioGroup value={shape} onValueChange={value=>setShape(value as Shape)}>
                        {shapes.map(({type,label:shapeLabel,Icon:ShapeIcon}) => (
                          <DropdownMenu.RadioItem className="wb-tool-menu-item" key={type} value={type}>
                            <ShapeIcon size={17} /> {shapeLabel}
                          </DropdownMenu.RadioItem>
                        ))}
                      </DropdownMenu.RadioGroup>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              )}
            </div>
          )
        })}
      </div>
      {!readOnly && (selected || tool === 'shape' || tool === 'text' || tool === 'connector') && (
        <div className="wb-tools wb-context-tools" role="group" aria-label="Element actions">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="wb-icon-button" aria-label="Element color" title="Element color"><PaletteIcon size={18}/></button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="wb-tool-menu" sideOffset={8}>
                <DropdownMenu.RadioGroup value={color} onValueChange={actions.setColor}>
                  {colors.map((name,i) => (
                    <DropdownMenu.RadioItem className="wb-tool-menu-item" key={name} value={name}>
                      <span className="wb-color-swatch" style={{background:colorSwatches[i]}} /> {name[0].toUpperCase()+name.slice(1)}
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          {selected && <button type="button" className="wb-icon-button" aria-label="Duplicate selection" title="Duplicate selection" onClick={actions.duplicate}><CopyIcon size={17}/></button>}
          {selected && <button type="button" className="wb-icon-button" aria-label="Delete selection" title="Delete selection" onClick={actions.deleteSelected}><TrashIcon size={17}/></button>}
          <button type="button" className="wb-icon-button" aria-label="Undo" title="Undo" disabled={!canUndo} onClick={onUndo}><ArrowCounterClockwiseIcon size={17} /></button>
          <button type="button" className="wb-icon-button" aria-label="Redo" title="Redo" disabled={!canRedo} onClick={onRedo}><ArrowClockwiseIcon size={17} /></button>
        </div>
      )}
    </div>
  )
}
