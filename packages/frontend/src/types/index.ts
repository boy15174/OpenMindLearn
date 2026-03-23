export interface Node {
  id: string
  content: string
  position: { x: number; y: number }
  parentIds: string[]
  createdAt: string
}

export interface Graph {
  nodes: Node[]
  name: string
}
