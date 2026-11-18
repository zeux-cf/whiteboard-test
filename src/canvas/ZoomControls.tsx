import {CornersOutIcon,MinusIcon,PlusIcon} from '@phosphor-icons/react'

export function ZoomControls({zoom,zoomTo,fit}: {zoom:number;zoomTo(value:number):void;fit():void}) {
  return (
    <div className="wb-zoom" role="group" aria-label="Zoom controls">
      <button type="button" className="wb-icon-button" onClick={()=>zoomTo(zoom/1.2)} aria-label="Zoom out" title="Zoom out"><MinusIcon size={17}/></button>
      <button type="button" className="wb-zoom-value" onClick={()=>zoomTo(1)} aria-label="Reset zoom" title="Reset zoom">{Math.round(zoom*100)}%</button>
      <button type="button" className="wb-icon-button" onClick={()=>zoomTo(zoom*1.2)} aria-label="Zoom in" title="Zoom in"><PlusIcon size={17}/></button>
      <button type="button" className="wb-icon-button wb-fit" onClick={fit} aria-label="Zoom to fit" title="Zoom to fit"><CornersOutIcon size={19}/></button>
    </div>
  )
}
