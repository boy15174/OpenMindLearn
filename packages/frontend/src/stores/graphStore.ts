import { create } from 'zustand'
import type { Node, Graph } from '../types'

interface GraphStore {
  nodes: Node[]
  addNode: (node: Node) => void
  updateNode: (id: string, content: string) => void
}

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  updateNode: (id, content) => set((state) => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, content } : n)
  }))
}))
