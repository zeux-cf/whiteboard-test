import {describe,expect,it} from 'vitest'
import type { BoardElement } from '../shared/model'
import {connectorPath,fitCamera,resizeBounds,scaleNode,toScreen,toWorld,zoomAt,type ConnectorElement,type NodeElement} from './geometry'
import {deleteChanges,duplicateChanges} from './editor-actions'
import {makeScene,selectBox} from './scene'

const source: NodeElement = {id:'source',type:'rectangle',x:10,y:20,width:100,height:50,label:'Source',color:'neutral'}
const target: NodeElement = {...source,id:'target',x:260,y:180,label:'Target'}
const connector: ConnectorElement = {
  id:'flow',type:'connector',sourceId:source.id,targetId:target.id,sourceSide:'right',targetSide:'top',label:'Flow',color:'neutral',
}
const elements: BoardElement[] = [source,target,connector]

describe('canvas geometry',()=>{
  it('resolves anchors against the latest positions and dimensions',()=>{
    const before = makeScene(elements)
    const resized = {...target,x:310,y:230,width:180}
    const after = makeScene([source,resized,connector])
    expect(connectorPath(connector,before.nodes)).toEqual([{x:110,y:45},{x:310,y:45},{x:310,y:180}])
    expect(connectorPath(connector,after.nodes)).toEqual([{x:110,y:45},{x:400,y:45},{x:400,y:230}])
  })

  it('holds the opposite resize corner and scales the selected group',()=>{
    const box = {x:10,y:20,width:350,height:210}
    const next = resizeBounds(box,'se',{x:710,y:440})
    expect(next).toEqual({x:10,y:20,width:700,height:420})
    expect(scaleNode(target,box,next)).toEqual({...target,x:510,y:340,width:200,height:100})
  })

  it('keeps the point under the cursor stationary while zooming and centers fitted bounds',()=>{
    const cursor = {x:330,y:210}
    const camera = {x:40,y:30,zoom:0.5}
    expect(toWorld(cursor,zoomAt(camera,cursor,2))).toEqual(toWorld(cursor,camera))
    const bounds = {x:200,y:100,width:1000,height:500}
    const size = {width:640,height:400}
    const fitted = fitCamera(bounds,size,40)
    expect(toScreen({x:700,y:350},fitted)).toEqual({x:320,y:200})
    expect(toScreen(bounds,fitted).x).toBeCloseTo(40)
  })

  it('uses more of a narrow viewport while retaining desktop fit padding',()=>{
    const bounds = {x:0,y:0,width:1000,height:480}
    expect(toScreen(bounds,fitCamera(bounds,{width:390,height:800})).x).toBeCloseTo(28)
    expect(toScreen(bounds,fitCamera(bounds,{width:1000,height:800})).x).toBeCloseTo(85)
  })
})

describe('canvas selection',()=>{
  const scene = makeScene(elements)

  it('selects lines crossed by the marquee even when both endpoint nodes are outside',()=>{
    expect(selectBox(scene,{x:140,y:30,width:80,height:40})).toEqual(new Set(['flow']))
  })

  it('deletes attached connectors when their selected endpoint is deleted',()=>{
    expect(deleteChanges(scene,new Set(['source'])).map(({id,after})=>({id,after})))
      .toEqual([{id:'source',after:null},{id:'flow',after:null}])
  })

  it('duplicates internal connectors against the new ids and offsets the nodes',()=>{
    const changes = duplicateChanges(scene,new Set(['source','target']))
    expect(changes).toHaveLength(3)
    expect(changes[0].after).toEqual({...source,id:changes[0].id,x:source.x+24,y:source.y+24})
    expect(changes[2].after).toEqual({...connector,id:changes[2].id,sourceId:changes[0].id,targetId:changes[1].id})
  })
})
