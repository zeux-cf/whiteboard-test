import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react'
import type { Point } from '../shared/model'
import {fitCamera,zoomAt,type Camera,type Size} from './geometry'
import {paint} from './paint'
import type { PaintState } from './view-types'

export function useCanvasView(state: PaintState) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const size = useRef<Size>({width:0,height:0})
  const camera = useRef<Camera>({x:0,y:0,zoom:1})
  const frame = useRef(0)
  const [zoom,setZoom] = useState(1)
  const [,refreshOverlay] = useState(0)
  const latest = useRef(state)
  useLayoutEffect(() => { latest.current = state },[state])
  const drawFrame = useCallback(() => {
    const state = latest.current
    frame.current = 0
    const ctx = canvasRef.current?.getContext('2d',{alpha:false})
    if (!ctx || !size.current.width || !size.current.height) return
    const transient = state.transient.current
    const scene = transient.scene ?? state.scene
    paint(ctx,size.current,camera.current,scene,{
      dark:state.dark,selected:state.selected,marquee:transient.marquee,draft:transient.draft,
      connector:transient.connector,presence:state.presence,editing:state.editing,pixelRatio:devicePixelRatio,
    })
  },[])
  const redraw = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(drawFrame)
  },[drawFrame])
  const setCamera = useCallback((value: Camera) => {
    const prior = camera.current
    camera.current = value
    if (prior.zoom !== value.zoom) setZoom(value.zoom)
    else if (latest.current.editing) refreshOverlay(version=>version+1)
    redraw()
  },[redraw])
  const zoomTo = useCallback((value: number, at?: Point) => {
    const center = {x:size.current.width/2,y:size.current.height/2}
    setCamera(zoomAt(camera.current,at ?? center,value))
  },[setCamera])
  const fit = useCallback(() => setCamera(fitCamera(state.scene.bounds,size.current)),[setCamera,state.scene])
  useEffect(() => {
    const view = viewRef.current!
    const observe = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      const height = entry.contentRect.height
      const previous = size.current
      size.current = {width,height}
      setCamera({...camera.current,x:camera.current.x+(previous.width ? (width-previous.width)/2 : 0),
        y:camera.current.y+(previous.height ? (height-previous.height)/2 : 0)})
    })
    observe.observe(view)
    return () => {
      observe.disconnect()
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  },[setCamera])
  useEffect(redraw,[redraw,state])
  useEffect(() => {
    const canvas = canvasRef.current!
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.current.height : 1
      const dx = event.deltaX*unit
      const dy = event.deltaY*unit
      if (event.ctrlKey || event.metaKey) {
        const rect = canvas.getBoundingClientRect()
        zoomTo(camera.current.zoom*Math.exp(-dy*0.004),{x:event.clientX-rect.left,y:event.clientY-rect.top})
      } else if (event.shiftKey && !dx) {
        setCamera({...camera.current,x:camera.current.x-dy})
      } else {
        setCamera({...camera.current,x:camera.current.x-dx,y:camera.current.y-dy})
      }
    }
    canvas.addEventListener('wheel',wheel,{passive:false})
    return () => canvas.removeEventListener('wheel',wheel)
  },[setCamera,zoomTo])
  return {canvasRef,viewRef,camera,zoom,zoomTo,fit,setCamera,redraw}
}
