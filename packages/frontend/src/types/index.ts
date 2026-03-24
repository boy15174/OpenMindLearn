export interface SourceReference {
  upstreamFingerprintBase64: string
  rangeStart: number
  rangeEnd: number
}

export interface NodeVersion {
  content: string
  timestamp: string
}

export interface Region {
  id: string
  name: string
  color: string
  description?: string
  nodeIds: string[]
  createdAt: string
}

export interface Node {
  id: string
  content: string
  question?: string
  position: { x: number; y: number }
  parentIds: string[]
  createdAt: string
  updatedAt?: string
  tags?: string[]
  note?: string
  versions?: NodeVersion[]
  expansionColor?: string
  sourceRef?: SourceReference
}

export interface Graph {
  nodes: Node[]
  regions?: Region[]
  name: string
}
