import type { Node, SourceReference } from './index'
import type { SourceHighlight } from './canvas'
import type { ExpandMode } from '../stores/settingsStore'

export interface SelectionMenuState {
  x: number
  y: number
  text: string
  sourceRef: SourceReference
}

export interface NodeCardData {
  content: string
  isEditing?: boolean
  mode?: 'learn' | 'view'
  nodeId: string
  tags?: string[]
  note?: string
  searchMatched?: boolean
  searchActive?: boolean
  onGenerate: (content: string) => void
  onSaveContent: (content: string) => void
  onExpand: (text: string, selectedNodeIds?: string[], sourceRef?: SourceReference, expandMode?: ExpandMode) => void
  allNodes?: Node[]
  expansionColor?: string
  sourceHighlights?: SourceHighlight[]
}

export interface NodeCardProps {
  data: NodeCardData
  selected?: boolean
}
