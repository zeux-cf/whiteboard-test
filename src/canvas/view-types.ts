import type { RefObject } from 'react'
import type { Point } from '../shared/model'
import type { Presence } from '../shared/protocol'
import type { Bounds, NodeElement } from './geometry'
import type { Scene } from './scene'

export type Transient = {
  scene?: Scene
  marquee?: Bounds
  draft?: NodeElement
  connector?: readonly Point[]
}

export type PaintState = {
  scene: Scene
  transient: RefObject<Transient>
  selected: ReadonlySet<string>
  dark?: boolean
  presence?: readonly Presence[]
  editing?: string
}
