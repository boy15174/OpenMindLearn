import { create } from 'zustand'
import type { Node, Graph } from '../types'

interface GraphStore {
  nodes: Node[]
  fileName: string
  isDirty: boolean
  addNode: (node: Node) => void
  updateNode: (id: string, content: string) => void
  setFileName: (name: string) => void
  setDirty: (dirty: boolean) => void
  loadGraph: (graph: Graph) => void
  clearGraph: () => void
}

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  fileName: 'Untitled',
  isDirty: false,
  addNode: (node) => set((state) => ({
    nodes: [...state.nodes, node],
    isDirty: true
  })),
  updateNode: (id, content) => set((state) => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, content } : n),
    isDirty: true
  })),
  setFileName: (name) => set({ fileName: name }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  loadGraph: (graph) => set({
    nodes: graph.nodes,
    fileName: graph.name,
    isDirty: false
  }),
  clearGraph: () => set({
    nodes: [],
    fileName: 'Untitled',
    isDirty: false
  })
}))
