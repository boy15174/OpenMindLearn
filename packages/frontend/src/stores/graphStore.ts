import { create } from 'zustand'
import type { Node, Graph, Region } from '../types'

interface GraphStore {
  nodes: Node[]
  regions: Region[]
  fileName: string
  currentFilePath: string | null
  isDirty: boolean
  addNode: (node: Node) => void
  setRegions: (regions: Region[]) => void
  updateNode: (id: string, content: string) => void
  setFileName: (name: string) => void
  setCurrentFilePath: (filePath: string | null) => void
  setDirty: (dirty: boolean) => void
  loadGraph: (graph: Graph, filePath?: string | null) => void
  clearGraph: () => void
}

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  regions: [],
  fileName: 'Untitled',
  currentFilePath: null,
  isDirty: false,
  addNode: (node) => set((state) => ({
    nodes: [...state.nodes, node],
    isDirty: true
  })),
  setRegions: (regions) => set({
    regions,
    isDirty: true
  }),
  updateNode: (id, content) => set((state) => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, content } : n),
    isDirty: true
  })),
  setFileName: (name) => set({ fileName: name }),
  setCurrentFilePath: (filePath) => set({ currentFilePath: filePath }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  loadGraph: (graph, filePath = null) => set({
    nodes: graph.nodes,
    regions: graph.regions || [],
    fileName: graph.name,
    currentFilePath: filePath,
    isDirty: false
  }),
  clearGraph: () => set({
    nodes: [],
    regions: [],
    fileName: 'Untitled',
    currentFilePath: null,
    isDirty: false
  })
}))
