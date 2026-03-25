import type { SourceReference, NodeVersion } from './index'

// ── 常量 ──────────────────────────────────────────────
export const NODE_DEFAULT_WIDTH = 380
export const NODE_DEFAULT_HEIGHT = 300
export const NODE_MIN_WIDTH = 280
export const NODE_MIN_HEIGHT = 200
export const REGION_PADDING = 24
export const REGION_DEFAULT_WIDTH = 420
export const REGION_DEFAULT_HEIGHT = 260
export const REGION_MIN_WIDTH = 180
export const REGION_MIN_HEIGHT = 120
export const MAX_NODE_VERSIONS = 3

// ── 类型 ──────────────────────────────────────────────
export type CanvasMode = 'learn' | 'view'

export interface SourceHighlight extends SourceReference {
  color: string
}

export interface SearchResult {
  nodeId: string
  score: number
}

export type MenuType = 'pane' | 'node'

export interface ContextMenuState {
  x: number
  y: number
  type: MenuType
  flowPosition?: { x: number; y: number }
  nodeId?: string
  nodeContent?: string
}

export interface RegionBox {
  id: string
  name: string
  color: string
  x: number
  y: number
  width: number
  height: number
}

export interface RegionDragState {
  regionId: string
  mode: 'move' | 'resize'
  resizeHandle?: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w'
  startPointer: { x: number; y: number }
  startRegion: { x: number; y: number; width: number; height: number }
  startNodePositions: Record<string, { x: number; y: number }>
}

export interface MetaEditorState {
  nodeId: string
  tagsText: string
  note: string
}

export interface VersionDialogState {
  nodeId: string
  versions: NodeVersion[]
  currentContent: string
}

export interface DetailPanelState {
  nodeId: string
  content: string
  question: string
}

export interface DiffLine {
  type: 'same' | 'added' | 'removed'
  text: string
}
