import { useEffect, useMemo, useRef } from 'react'
import type { BoardElement } from '../shared/model'
import { fitCamera } from './geometry'
import { paint } from './paint'
import { makeScene } from './scene'
import './canvas.css'

export function BoardPreview({elements,dark}: {elements: readonly BoardElement[]; dark?: boolean}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const scene = useMemo(() => makeScene(elements),[elements])
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const draw = () => {
      const size = {width:canvas.clientWidth,height:canvas.clientHeight}
      if (!size.width || !size.height) return
      paint(ctx,size,fitCamera(scene.bounds,size,18,1.2),scene,{dark,preview:true,pixelRatio:devicePixelRatio})
    }
    const resize = new ResizeObserver(draw)
    resize.observe(canvas)
    draw()
    return () => resize.disconnect()
  },[scene,dark])
  return <canvas aria-hidden="true" ref={ref} className="wb-preview" />
}
