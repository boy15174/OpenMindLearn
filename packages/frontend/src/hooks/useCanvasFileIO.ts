import { useCallback } from 'react'
import { useGraphStore } from '../stores/graphStore'
import { useToastStore } from '../stores/toastStore'
import { saveFile, loadFile } from '../services/api'
import type { Node, SourceReference, Region, NodeImage } from '../types'
import type { ExpandMode } from '../stores/settingsStore'
import type { SourceHighlight } from '../types/canvas'
import {
  NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, NODE_MIN_WIDTH, NODE_MIN_HEIGHT,
} from '../types/canvas'
import { parseNodeDimension, getNodeWidth, getNodeHeight, normalizeNodeForRuntime } from '../utils/nodeDimension'
import { normalizeRegionsWithNodeFallback } from '../utils/region'
import { fileToBase64, base64ToBlob } from '../utils/base64'
import { tFromSettings } from './useI18n'

export interface FileIODeps {
  nodes: any[]
  edges: any[]
  regions: Region[]
  setNodes: (nds: any) => void
  setEdges: (eds: any) => void
  setRegions: (regions: Region[]) => void
  skipDirtyFlagRef: React.MutableRefObject<boolean>
  refreshNodeRuntimeData: (rfNodes: any[], edgeList: any[]) => any[]
  handleGenerate: (nodeId: string, content: string) => Promise<void>
  handleSaveNodeContent: (nodeId: string, content: string) => void
  handleExpand: (...args: any[]) => Promise<void>
  handleImagesChange: (nodeId: string, images: NodeImage[]) => void
  resetSearch: () => void
  setDetailPanel: (v: null) => void
  setMetaEditor: (v: null) => void
  setVersionDialog: (v: null) => void
  setShowRegionPanel: (v: boolean) => void
  setInitialInput: (v: string) => void
  setInitialGenerating: (v: boolean) => void
  setInitialImages: (v: any[]) => void
}

export function useCanvasFileIO(deps: FileIODeps) {
  const { fileName, setDirty, loadGraph, clearGraph } = useGraphStore()
  const { showToast } = useToastStore()

  const handleSave = useCallback(async () => {
    try {
      const graphNodes: Node[] = deps.nodes.map((node) => ({
        id: node.id,
        content: node.data.content || '',
        thinking: node.data.thinking || '',
        question: node.data.question || '',
        position: node.position,
        width: getNodeWidth(node),
        height: getNodeHeight(node),
        parentIds: deps.edges.filter((edge) => edge.target === node.id).map((edge) => edge.source),
        createdAt: node.data.createdAt || new Date().toISOString(),
        updatedAt: node.data.updatedAt,
        tags: node.data.tags || [],
        note: node.data.note || '',
        versions: node.data.versions || [],
        expansionColor: node.data.expansionColor,
        sourceRef: node.data.sourceRef,
        images: node.data.images || []
      }))

      const result = await saveFile(graphNodes, deps.edges, fileName, deps.regions)
      if (!result?.data || typeof result.data !== 'string') {
        throw new Error(result?.error || 'Invalid save response')
      }

      const blob = base64ToBlob(result.data, 'application/zip')
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `${fileName}.oml`
      link.click()
      URL.revokeObjectURL(blobUrl)

      setDirty(false)
      showToast(tFromSettings('toast.fileSaved'), 'success')
    } catch (error) {
      console.error('保存失败:', error)
      const message = error instanceof Error ? error.message : ''
      showToast(tFromSettings('toast.fileSaveFailed', { message }), 'error')
    }
  }, [deps.nodes, deps.edges, deps.regions, fileName, setDirty, showToast])

  const handleLoad = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.oml'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const base64 = await fileToBase64(file)
        const result = await loadFile(base64)
        if (!result?.nodes || !Array.isArray(result.nodes)) {
          throw new Error(result?.error || 'Invalid load response')
        }

        const loadedNodes: Node[] = (result.nodes || []).map((node: Node) => normalizeNodeForRuntime(node))
        const loadedRegions = normalizeRegionsWithNodeFallback(result.regions, loadedNodes)

        deps.skipDirtyFlagRef.current = true
        loadGraph({ nodes: loadedNodes, name: result.name, regions: loadedRegions })

        const rfNodes = loadedNodes.map((node) => ({
          id: node.id,
          type: 'custom',
          position: node.position,
          style: {
            width: parseNodeDimension(node.width, NODE_DEFAULT_WIDTH, NODE_MIN_WIDTH),
            height: parseNodeDimension(node.height, NODE_DEFAULT_HEIGHT, NODE_MIN_HEIGHT)
          },
          data: {
            content: node.content,
            thinking: node.thinking || '',
            question: node.question || '',
            nodeId: node.id,
            width: parseNodeDimension(node.width, NODE_DEFAULT_WIDTH, NODE_MIN_WIDTH),
            height: parseNodeDimension(node.height, NODE_DEFAULT_HEIGHT, NODE_MIN_HEIGHT),
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            tags: node.tags || [],
            note: node.note || '',
            versions: node.versions || [],
            expansionColor: node.expansionColor,
            sourceRef: node.sourceRef,
            images: node.images || [],
            onImagesChange: (imgs: NodeImage[]) => deps.handleImagesChange(node.id, imgs),
            onGenerate: (c: string) => deps.handleGenerate(node.id, c),
            onSaveContent: (c: string) => deps.handleSaveNodeContent(node.id, c),
            onExpand: (text: string, selectedIds?: string[], sourceRef?: SourceReference, expandMode?: ExpandMode) =>
              deps.handleExpand(text, node.id, selectedIds, sourceRef, expandMode),
            allNodes: loadedNodes,
            sourceHighlights: [] as SourceHighlight[]
          }
        }))

        const loadedEdges = (result.edges || []).map((edge: any) => {
          if (edge.style) return edge
          const childNode = loadedNodes.find((node) => node.id === edge.target)
          return {
            ...edge,
            style: childNode?.expansionColor
              ? { stroke: childNode.expansionColor, strokeWidth: 2 }
              : undefined
          }
        })

        deps.setNodes(deps.refreshNodeRuntimeData(rfNodes, loadedEdges))
        deps.setEdges(loadedEdges)
        deps.setRegions(loadedRegions)
        deps.resetSearch()
        deps.setDetailPanel(null)
        setDirty(false)
        showToast(tFromSettings('toast.fileLoaded'), 'success')
      } catch (error) {
        console.error('加载失败:', error)
        const message = error instanceof Error ? error.message : ''
        showToast(tFromSettings('toast.fileLoadFailed', { message }), 'error')
      }
    }

    input.click()
  }, [deps, loadGraph, setDirty, showToast])

  const handleNew = useCallback(() => {
    if (deps.nodes.length > 0 || deps.edges.length > 0 || deps.regions.length > 0) {
      if (!confirm(tFromSettings('confirm.newUnsaved'))) return
    }

    deps.skipDirtyFlagRef.current = true
    clearGraph()
    deps.setNodes([])
    deps.setEdges([])
    deps.setRegions([])
    deps.setInitialInput('')
    deps.setInitialGenerating(false)
    deps.setInitialImages([])
    deps.resetSearch()
    deps.setDetailPanel(null)
    deps.setMetaEditor(null)
    deps.setVersionDialog(null)
    deps.setShowRegionPanel(false)
  }, [deps, clearGraph])

  return {
    handleSave,
    handleLoad,
    handleNew
  }
}
