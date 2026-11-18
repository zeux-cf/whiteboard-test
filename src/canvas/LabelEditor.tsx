import {useEffect,useRef,useState} from 'react'
import type {BoardElement} from '../shared/model'
import {toScreen,type Bounds,type Camera} from './geometry'

export function LabelEditor({element,box,camera,onFinish}: {element:BoardElement;box:Bounds; camera:Camera;onFinish(label?:string):void}) {
  const [value,setValue] = useState(element.label)
  const finished = useRef(false)
  const field = useRef<HTMLTextAreaElement>(null)
  const position = toScreen(box,camera)
  const width = Math.max(30,box.width*camera.zoom)
  const height = Math.max(28,box.height*camera.zoom)

  useEffect(()=>{
    field.current?.focus()
    field.current?.select()
  },[])

  function finish(label?: string) {
    if (finished.current) return
    finished.current = true
    onFinish(label)
  }

  return (
    <div className="wb-label-editor" style={{
      left:position.x+(box.width*camera.zoom-width)/2,top:position.y+(box.height*camera.zoom-height)/2,
      width,height,fontSize:Math.max(11,Math.min(36,17*camera.zoom)),
    }}>
      <textarea ref={field} aria-label="Edit label" rows={Math.max(1,Math.floor(height / Math.max(18,20*camera.zoom)))}
        maxLength={2000} value={value} onChange={event=>setValue(event.target.value)}
        onBlur={()=>finish(value)}
        onKeyDown={event=>{
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
            event.preventDefault()
            finish(event.key === 'Escape' ? undefined : value)
          }
        }} />
    </div>
  )
}
