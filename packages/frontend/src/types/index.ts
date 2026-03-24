export interface SourceReference {
  upstreamFingerprintBase64: string
  rangeStart: number
  rangeEnd: number
}

export interface Node {
  id: string
  content: string
  position: { x: number; y: number }
  parentIds: string[]
  createdAt: string
  expansionColor?: string
  sourceRef?: SourceReference
}

export interface Graph {
  nodes: Node[]
  name: string
}
