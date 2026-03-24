import { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { ReactFlow, Background, Controls, addEdge, useNodesState, useEdgesState, useReactFlow, BackgroundVariant } from '@xyflow/react'
import type { Node as RFNode, Viewport } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NodeCard } from './NodeCard'
import { Toolbar } from './Toolbar'
import { generateNode, expandNode, saveFile, loadFile } from '../services/api'
import { useGraphStore } from '../stores/graphStore'
import { useToastStore } from '../stores/toastStore'
import { useSettingsStore, type ExpandMode } from '../stores/settingsStore'
import { getExpansionColor } from '../utils/colors'
import { Plus, X, Eye, Pencil, RefreshCw, ClipboardPaste, Sparkles, Download, Tags, History, Search, Layers, Trash2 } from 'lucide-react'
import { cn } from '../utils/cn'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Node, SourceReference, Region, NodeVersion } from '../types'
import { calculateChildNodePosition, calculateInitialNodePosition } from '../utils/nodePosition'

const nodeTypes = { custom: NodeCard }
const NODE_DEFAULT_WIDTH = 380
const NODE_DEFAULT_HEIGHT = 300
const NODE_MIN_WIDTH = 280
const NODE_MIN_HEIGHT = 200
const REGION_PADDING = 24
const REGION_DEFAULT_WIDTH = 420
const REGION_DEFAULT_HEIGHT = 260
const REGION_MIN_WIDTH = 180
const REGION_MIN_HEIGHT = 120
const MAX_NODE_VERSIONS = 3

interface SourceHighlight extends SourceReference {
  color: string
}

interface SearchResult {
  nodeId: string
  score: number
}

type MenuType = 'pane' | 'node'

interface ContextMenuState {
  x: number
  y: number
  type: MenuType
  flowPosition?: { x: number; y: number }
  nodeId?: string
  nodeContent?: string
}

interface RegionBox {
  id: string
  name: string
  color: string
  x: number
  y: number
  width: number
  height: number
}

interface RegionDragState {
  regionId: string
  mode: 'move' | 'resize'
  resizeHandle?: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w'
  startPointer: { x: number; y: number }
  startRegion: { x: number; y: number; width: number; height: number }
  startNodePositions: Record<string, { x: number; y: number }>
}

interface MetaEditorState {
  nodeId: string
  tagsText: string
  note: string
}

interface VersionDialogState {
  nodeId: string
  versions: NodeVersion[]
  currentContent: string
}

interface DiffLine {
  type: 'same' | 'added' | 'removed'
  text: string
}

function parseNodeDimension(value: unknown, fallback: number, minimum: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(minimum, numeric)
}

function getNodeWidth(node: any): number {
  return parseNodeDimension(
    node?.width ?? node?.data?.width ?? node?.style?.width,
    NODE_DEFAULT_WIDTH,
    NODE_MIN_WIDTH
  )
}

function getNodeHeight(node: any): number {
  return parseNodeDimension(
    node?.height ?? node?.data?.height ?? node?.style?.height,
    NODE_DEFAULT_HEIGHT,
    NODE_MIN_HEIGHT
  )
}

function toPlacementNode(node: any): { id: string; position: { x: number; y: number }; width: number; height: number } {
  return {
    id: node.id,
    position: node.position,
    width: getNodeWidth(node),
    height: getNodeHeight(node)
  }
}

function normalizeNodeForRuntime(node: Node): Node {
  return {
    ...node,
    width: parseNodeDimension(node.width, NODE_DEFAULT_WIDTH, NODE_MIN_WIDTH),
    height: parseNodeDimension(node.height, NODE_DEFAULT_HEIGHT, NODE_MIN_HEIGHT),
    createdAt: node.createdAt || new Date().toISOString(),
    updatedAt: node.updatedAt || node.createdAt || new Date().toISOString(),
    tags: node.tags || [],
    note: node.note || '',
    versions: node.versions || []
  }
}

function normalizeRegionsForRuntime(regions?: Region[]): Region[] {
  return (regions || []).map((region) => ({
    ...region,
    x: Number.isFinite(region.x) ? region.x : 0,
    y: Number.isFinite(region.y) ? region.y : 0,
    width: Math.max(REGION_MIN_WIDTH, Number.isFinite(region.width) ? region.width : REGION_DEFAULT_WIDTH),
    height: Math.max(REGION_MIN_HEIGHT, Number.isFinite(region.height) ? region.height : REGION_DEFAULT_HEIGHT),
    createdAt: region.createdAt || new Date().toISOString(),
    description: region.description || ''
  }))
}

function pointInRegion(point: { x: number; y: number }, region: Pick<Region, 'x' | 'y' | 'width' | 'height'>): boolean {
  return (
    point.x >= region.x &&
    point.x <= region.x + region.width &&
    point.y >= region.y &&
    point.y <= region.y + region.height
  )
}

function resizeRegionFromHandle(
  start: { x: number; y: number; width: number; height: number },
  handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w',
  dx: number,
  dy: number
): { x: number; y: number; width: number; height: number } {
  const right = start.x + start.width
  const bottom = start.y + start.height

  if (handle === 'n') {
    const height = Math.max(REGION_MIN_HEIGHT, start.height - dy)
    return { x: start.x, y: bottom - height, width: start.width, height }
  }

  if (handle === 'e') {
    const width = Math.max(REGION_MIN_WIDTH, start.width + dx)
    return { x: start.x, y: start.y, width, height: start.height }
  }

  if (handle === 's') {
    const height = Math.max(REGION_MIN_HEIGHT, start.height + dy)
    return { x: start.x, y: start.y, width: start.width, height }
  }

  if (handle === 'w') {
    const width = Math.max(REGION_MIN_WIDTH, start.width - dx)
    return { x: right - width, y: start.y, width, height: start.height }
  }

  if (handle === 'nw') {
    const width = Math.max(REGION_MIN_WIDTH, start.width - dx)
    const height = Math.max(REGION_MIN_HEIGHT, start.height - dy)
    return { x: right - width, y: bottom - height, width, height }
  }

  if (handle === 'ne') {
    const width = Math.max(REGION_MIN_WIDTH, start.width + dx)
    const height = Math.max(REGION_MIN_HEIGHT, start.height - dy)
    return { x: start.x, y: bottom - height, width, height }
  }

  if (handle === 'sw') {
    const width = Math.max(REGION_MIN_WIDTH, start.width - dx)
    const height = Math.max(REGION_MIN_HEIGHT, start.height + dy)
    return { x: right - width, y: start.y, width, height }
  }

  const width = Math.max(REGION_MIN_WIDTH, start.width + dx)
  const height = Math.max(REGION_MIN_HEIGHT, start.height + dy)
  return { x: start.x, y: start.y, width, height }
}

function inferRegionRectFromNodeIds(nodeIds: string[], nodes: any[]): { x: number; y: number; width: number; height: number } | null {
  if (nodeIds.length === 0) return null
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const linkedNodes = nodeIds
    .map((nodeId) => nodeMap.get(nodeId))
    .filter((node): node is any => Boolean(node))

  if (linkedNodes.length === 0) return null

  const xs = linkedNodes.map((node) => node.position.x)
  const ys = linkedNodes.map((node) => node.position.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...linkedNodes.map((node) => node.position.x + getNodeWidth(node)))
  const maxY = Math.max(...linkedNodes.map((node) => node.position.y + getNodeHeight(node)))

  return {
    x: minX - REGION_PADDING,
    y: minY - REGION_PADDING,
    width: maxX - minX + REGION_PADDING * 2,
    height: maxY - minY + REGION_PADDING * 2
  }
}

function normalizeRegionsWithNodeFallback(regions: Region[] | undefined, nodes: any[]): Region[] {
  return (regions || []).map((item) => {
    const raw = item as Region & { nodeIds?: string[] }
    const hasGeometry = Number.isFinite(raw.x) && Number.isFinite(raw.y) && Number.isFinite(raw.width) && Number.isFinite(raw.height)
    const inferred = hasGeometry ? null : inferRegionRectFromNodeIds(raw.nodeIds || [], nodes)

    return {
      ...item,
      x: hasGeometry ? raw.x : inferred?.x ?? 0,
      y: hasGeometry ? raw.y : inferred?.y ?? 0,
      width: Math.max(REGION_MIN_WIDTH, hasGeometry ? raw.width : inferred?.width ?? REGION_DEFAULT_WIDTH),
      height: Math.max(REGION_MIN_HEIGHT, hasGeometry ? raw.height : inferred?.height ?? REGION_DEFAULT_HEIGHT),
      createdAt: item.createdAt || new Date().toISOString(),
      description: item.description || ''
    }
  })
}

function parseTags(tagsText: string): string[] {
  const values = tagsText
    .split(/[,，\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
  return Array.from(new Set(values)).slice(0, 30)
}

function getNextVersions(versions: NodeVersion[], previousContent: string): NodeVersion[] {
  const trimmed = previousContent.trim()
  if (!trimmed) return versions
  const latest = versions[versions.length - 1]
  if (latest?.content === previousContent) return versions
  const next = [...versions, { content: previousContent, timestamp: new Date().toISOString() }]
  return next.slice(-MAX_NODE_VERSIONS)
}

function buildNodeSnapshots(rfNodes: any[], rfEdges: any[]): Node[] {
  const now = new Date().toISOString()
  return rfNodes.map((n) => ({
    id: n.id,
    content: n.data.content || '',
    question: n.data.question || '',
    position: n.position,
    width: getNodeWidth(n),
    height: getNodeHeight(n),
    parentIds: rfEdges.filter((e) => e.target === n.id).map((e) => e.source),
    createdAt: n.data.createdAt || now,
    updatedAt: n.data.updatedAt || n.data.createdAt || now,
    tags: n.data.tags || [],
    note: n.data.note || '',
    versions: n.data.versions || [],
    expansionColor: n.data.expansionColor,
    sourceRef: n.data.sourceRef
  }))
}

function buildSourceHighlightMap(nodes: Node[]): Map<string, SourceHighlight[]> {
  const map = new Map<string, SourceHighlight[]>()
  nodes.forEach((node) => {
    const parentId = node.parentIds[0]
    if (!parentId || !node.sourceRef) return
    const current = map.get(parentId) || []
    current.push({
      ...node.sourceRef,
      color: node.expansionColor || '#3b82f6'
    })
    map.set(parentId, current)
  })
  return map
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildDiffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split(/\r?\n/)
  const b = newText.split(/\r?\n/)
  const n = a.length
  const m = b.length

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ type: 'same', text: a[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: 'removed', text: a[i] })
      i += 1
    } else {
      lines.push({ type: 'added', text: b[j] })
      j += 1
    }
  }

  while (i < n) {
    lines.push({ type: 'removed', text: a[i] })
    i += 1
  }
  while (j < m) {
    lines.push({ type: 'added', text: b[j] })
    j += 1
  }

  return lines
}

export function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [detailContent, setDetailContent] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [initialInput, setInitialInput] = useState('')
  const [initialGenerating, setInitialGenerating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1)
  const [showRegionPanel, setShowRegionPanel] = useState(false)
  const [metaEditor, setMetaEditor] = useState<MetaEditorState | null>(null)
  const [versionDialog, setVersionDialog] = useState<VersionDialogState | null>(null)
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0)
  const [newRegionName, setNewRegionName] = useState('')
  const [newRegionColor, setNewRegionColor] = useState('#22c55e')
  const [newRegionDescription, setNewRegionDescription] = useState('')
  const [manualRegionNodeIds, setManualRegionNodeIds] = useState('')
  const [regionDrag, setRegionDrag] = useState<RegionDragState | null>(null)
  const [regionTitleEdit, setRegionTitleEdit] = useState<{ regionId: string; draft: string } | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const skipDirtyFlagRef = useRef(false)

  const { screenToFlowPosition, getNodes, getEdges, setCenter } = useReactFlow()
  const { fileName, setDirty, loadGraph, clearGraph } = useGraphStore()
  const { showToast } = useToastStore()
  const { llmSettings } = useSettingsStore()

  const refreshNodeRuntimeData = useCallback((rfNodes: any[], edgeList: any[]) => {
    const snapshots = buildNodeSnapshots(rfNodes, edgeList)
    const highlightMap = buildSourceHighlightMap(snapshots)
    return rfNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        allNodes: snapshots,
        sourceHighlights: highlightMap.get(node.id) || []
      }
    }))
  }, [])

  useEffect(() => {
    if (skipDirtyFlagRef.current) {
      skipDirtyFlagRef.current = false
      return
    }

    if (nodes.length === 0 && edges.length === 0 && regions.length === 0) {
      return
    }

    setDirty(true)
  }, [nodes, edges, regions, setDirty])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  const getCanvasCenterFlowPosition = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 200, y: 120 }
    return screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    })
  }, [screenToFlowPosition])

  const handleSaveNodeContent = useCallback((nodeId: string, nextContent: string) => {
    setNodes((nds) => {
      let changed = false
      const now = new Date().toISOString()
      const nextNodes = nds.map((node) => {
        if (node.id !== nodeId) return node
        const previousContent = node.data.content || ''
        if (previousContent === nextContent) return node
        changed = true
        return {
          ...node,
          data: {
            ...node.data,
            content: nextContent,
            isEditing: false,
            updatedAt: now,
            versions: getNextVersions(node.data.versions || [], previousContent)
          }
        }
      })

      if (!changed) return nds
      return refreshNodeRuntimeData(nextNodes, getEdges())
    })
  }, [getEdges, refreshNodeRuntimeData, setNodes])

  const handleGenerate = useCallback(async (nodeId: string, content: string) => {
    const result = await generateNode(content)
    setNodes((nds) => {
      const now = new Date().toISOString()
      const nextNodes = nds.map((node) => {
        if (node.id !== nodeId) return node
        const previousContent = node.data.content || ''
        return {
          ...node,
          data: {
            ...node.data,
            content: result.content,
            isEditing: false,
            updatedAt: now,
            versions: getNextVersions(node.data.versions || [], previousContent)
          }
        }
      })
      return refreshNodeRuntimeData(nextNodes, getEdges())
    })
  }, [getEdges, refreshNodeRuntimeData, setNodes])

  const handleExpand = useCallback(async (
    text: string,
    parentId: string,
    selectedNodeIds?: string[],
    sourceRef?: SourceReference,
    expandMode: ExpandMode = 'direct'
  ) => {
    const currentNodes = getNodes()
    const currentEdges = getEdges()
    const allNodes: Node[] = buildNodeSnapshots(currentNodes, currentEdges)

    const newNodeId = `node-${Date.now()}`
    const relationshipId = `${parentId}-${Date.now()}`
    const expansionColor = getExpansionColor(relationshipId)
    const parentNode = currentNodes.find((n) => n.id === parentId)
    const now = new Date().toISOString()

    const placeholderNode = {
      id: newNodeId,
      type: 'custom',
      position: calculateChildNodePosition(
        parentNode ? toPlacementNode(parentNode) : undefined,
        currentNodes.map(toPlacementNode),
        { nodeWidth: NODE_DEFAULT_WIDTH, nodeHeight: NODE_DEFAULT_HEIGHT }
      ),
      style: {
        width: NODE_DEFAULT_WIDTH,
        height: NODE_DEFAULT_HEIGHT
      },
      data: {
        content: '生成中...',
        question: text,
        nodeId: newNodeId,
        width: NODE_DEFAULT_WIDTH,
        height: NODE_DEFAULT_HEIGHT,
        isGenerating: true,
        createdAt: now,
        updatedAt: now,
        tags: [],
        note: '',
        versions: [] as NodeVersion[],
        expansionColor,
        sourceRef,
        onGenerate: (c: string) => handleGenerate(newNodeId, c),
        onSaveContent: (c: string) => handleSaveNodeContent(newNodeId, c),
        onExpand: (nextText: string, selectedIds?: string[], nextSourceRef?: SourceReference, nextExpandMode?: ExpandMode) =>
          handleExpand(nextText, newNodeId, selectedIds, nextSourceRef, nextExpandMode),
        allNodes,
        sourceHighlights: [] as SourceHighlight[]
      }
    }

    const newEdge = {
      id: `e${parentId}-${newNodeId}`,
      source: parentId,
      target: newNodeId,
      style: { stroke: expansionColor, strokeWidth: 2 }
    }

    const edgesWithNewEdge = [...currentEdges, newEdge]

    setNodes((nds) => {
      const nextNodes = [...nds, placeholderNode]
      return refreshNodeRuntimeData(nextNodes, edgesWithNewEdge)
    })
    setEdges((eds) => addEdge(newEdge, eds))

    try {
      const result = await expandNode(
        text,
        parentId,
        allNodes,
        selectedNodeIds,
        sourceRef,
        expandMode,
        llmSettings.contextMaxDepth
      )
      setNodes((nds) => {
        const nowUpdated = new Date().toISOString()
        const updatedNodes = nds.map((node) =>
          node.id === newNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  content: result.content,
                  question: text,
                  updatedAt: nowUpdated,
                  isGenerating: false,
                  sourceRef: result.sourceRef || sourceRef
                }
              }
            : node
        )
        return refreshNodeRuntimeData(updatedNodes, edgesWithNewEdge)
      })
    } catch (error) {
      console.error('Failed to expand node:', error)
      setNodes((nds) => {
        const nowUpdated = new Date().toISOString()
        const updatedNodes = nds.map((node) =>
          node.id === newNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  content: '生成失败，请重试',
                  question: text,
                  updatedAt: nowUpdated,
                  isGenerating: false,
                  sourceRef
                }
              }
            : node
        )
        return refreshNodeRuntimeData(updatedNodes, edgesWithNewEdge)
      })
    }
  }, [getNodes, getEdges, handleGenerate, handleSaveNodeContent, llmSettings.contextMaxDepth, refreshNodeRuntimeData, setEdges, setNodes])

  const createNodeAtPosition = useCallback(
    (position: { x: number; y: number }, content: string, isEditing: boolean, question?: string) => {
    const nodeId = Date.now().toString()
    const currentEdges = getEdges()
    const now = new Date().toISOString()

    const newNode = {
      id: nodeId,
      type: 'custom',
      position,
      style: {
        width: NODE_DEFAULT_WIDTH,
        height: NODE_DEFAULT_HEIGHT
      },
      data: {
        content,
        question: question || '',
        isEditing,
        nodeId,
        width: NODE_DEFAULT_WIDTH,
        height: NODE_DEFAULT_HEIGHT,
        createdAt: now,
        updatedAt: now,
        tags: [] as string[],
        note: '',
        versions: [] as NodeVersion[],
        onGenerate: (c: string) => handleGenerate(nodeId, c),
        onSaveContent: (c: string) => handleSaveNodeContent(nodeId, c),
        onExpand: (text: string, selectedIds?: string[], sourceRef?: SourceReference, expandMode?: ExpandMode) =>
          handleExpand(text, nodeId, selectedIds, sourceRef, expandMode),
        allNodes: [] as Node[],
        sourceHighlights: [] as SourceHighlight[]
      }
    }

    setNodes((nds) => {
      const nextNodes = [...nds, newNode]
      return refreshNodeRuntimeData(nextNodes, currentEdges)
    })
  }, [getEdges, handleGenerate, handleExpand, handleSaveNodeContent, refreshNodeRuntimeData, setNodes])

  const createFirstNode = useCallback((content: string, isEditing: boolean, question?: string) => {
    const center = getCanvasCenterFlowPosition()
    const position = calculateInitialNodePosition(
      getNodes().map(toPlacementNode),
      center,
      { nodeWidth: NODE_DEFAULT_WIDTH, nodeHeight: NODE_DEFAULT_HEIGHT }
    )
    createNodeAtPosition(position, content, isEditing, question)
  }, [createNodeAtPosition, getCanvasCenterFlowPosition, getNodes])

  const searchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []

    const results: SearchResult[] = []
    nodes.forEach((node) => {
      const content = String(node.data.content || '').toLowerCase()
      const note = String(node.data.note || '').toLowerCase()
      const tags = (node.data.tags || []).join(' ').toLowerCase()

      const indexes = [content.indexOf(query), note.indexOf(query), tags.indexOf(query)].filter((idx) => idx >= 0)
      if (indexes.length > 0) {
        results.push({ nodeId: node.id, score: Math.min(...indexes) })
      }
    })

    return results.sort((a, b) => a.score - b.score)
  }, [nodes, searchQuery])

  useEffect(() => {
    if (searchResults.length === 0) {
      setActiveSearchIndex(-1)
      return
    }

    setActiveSearchIndex((prev) => {
      if (prev >= 0 && prev < searchResults.length) return prev
      return 0
    })
  }, [searchResults.length])

  const activeSearchNodeId = activeSearchIndex >= 0 ? searchResults[activeSearchIndex]?.nodeId : undefined

  const highlightedNodeSet = useMemo(() => {
    return new Set(searchResults.map((item) => item.nodeId))
  }, [searchResults])

  const renderedNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        searchMatched: highlightedNodeSet.has(node.id),
        searchActive: activeSearchNodeId === node.id
      }
    }))
  }, [nodes, highlightedNodeSet, activeSearchNodeId])

  const selectedNodeIds = useMemo(() => {
    return nodes.filter((node) => node.selected).map((node) => node.id)
  }, [nodes])

  const regionBoxes = useMemo<RegionBox[]>(() => {
    return normalizeRegionsForRuntime(regions).map((region) => ({
      id: region.id,
      name: region.name,
      color: region.color,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height
    }))
  }, [regions])

  const regionCoveredNodeCount = useMemo(() => {
    const map = new Map<string, number>()
    regionBoxes.forEach((box) => {
      const count = nodes.filter((node) => {
        const width = getNodeWidth(node)
        const height = getNodeHeight(node)
        const center = {
          x: node.position.x + width / 2,
          y: node.position.y + height / 2
        }
        return pointInRegion(center, box)
      }).length
      map.set(box.id, count)
    })
    return map
  }, [nodes, regionBoxes])

  const focusSearchResult = useCallback((nextIndex: number) => {
    if (searchResults.length === 0) return
    const normalized = ((nextIndex % searchResults.length) + searchResults.length) % searchResults.length
    setActiveSearchIndex(normalized)

    const targetNodeId = searchResults[normalized].nodeId
    const targetNode = nodes.find((node) => node.id === targetNodeId)
    if (!targetNode) return

    setCenter(targetNode.position.x + getNodeWidth(targetNode) / 2, targetNode.position.y + getNodeHeight(targetNode) / 2, {
      zoom: Math.max(viewport.zoom, 0.9),
      duration: 280
    })
  }, [nodes, searchResults, setCenter, viewport.zoom])

  const handleCreateRegion = useCallback(() => {
    const parsedManualIds = manualRegionNodeIds
      .split(/[,，\n]/g)
      .map((item) => item.trim())
      .filter(Boolean)

    const sourceIds = parsedManualIds.length > 0 ? parsedManualIds : selectedNodeIds
    const validNodeIdSet = new Set(nodes.map((node) => node.id))
    const validIds = Array.from(new Set(sourceIds)).filter((id) => validNodeIdSet.has(id))
    const inferredRect = inferRegionRectFromNodeIds(validIds, nodes)
    const center = getCanvasCenterFlowPosition()

    const region: Region = {
      id: `region-${Date.now()}`,
      name: newRegionName.trim() || `区域 ${regions.length + 1}`,
      color: newRegionColor,
      description: newRegionDescription.trim(),
      x: inferredRect?.x ?? center.x - REGION_DEFAULT_WIDTH / 2,
      y: inferredRect?.y ?? center.y - REGION_DEFAULT_HEIGHT / 2,
      width: inferredRect?.width ?? REGION_DEFAULT_WIDTH,
      height: inferredRect?.height ?? REGION_DEFAULT_HEIGHT,
      createdAt: new Date().toISOString()
    }

    setRegions((prev) => [...prev, region])
    setNewRegionName('')
    setNewRegionDescription('')
    setManualRegionNodeIds('')
    showToast('区域已创建', 'success')
  }, [getCanvasCenterFlowPosition, manualRegionNodeIds, newRegionColor, newRegionDescription, newRegionName, nodes, regions.length, selectedNodeIds, showToast])

  const handleUpdateRegion = useCallback((regionId: string, patch: Partial<Region>) => {
    setRegions((prev) =>
      prev.map((region) => {
        if (region.id !== regionId) return region
        const next = { ...region, ...patch }
        return {
          ...next,
          x: Number.isFinite(next.x) ? next.x : region.x,
          y: Number.isFinite(next.y) ? next.y : region.y,
          width: Math.max(REGION_MIN_WIDTH, Number.isFinite(next.width) ? next.width : region.width),
          height: Math.max(REGION_MIN_HEIGHT, Number.isFinite(next.height) ? next.height : region.height)
        }
      })
    )
  }, [])

  const handleDeleteRegion = useCallback((regionId: string) => {
    setRegions((prev) => prev.filter((region) => region.id !== regionId))
  }, [])

  const startRegionTitleEdit = useCallback((regionId: string, currentName: string) => {
    setRegionDrag(null)
    setRegionTitleEdit({
      regionId,
      draft: currentName
    })
  }, [])

  const commitRegionTitleEdit = useCallback(() => {
    if (!regionTitleEdit) return
    const nextName = regionTitleEdit.draft.trim()
    if (nextName) {
      handleUpdateRegion(regionTitleEdit.regionId, { name: nextName })
    }
    setRegionTitleEdit(null)
  }, [handleUpdateRegion, regionTitleEdit])

  useEffect(() => {
    if (!regionTitleEdit) return
    const exists = regions.some((region) => region.id === regionTitleEdit.regionId)
    if (!exists) setRegionTitleEdit(null)
  }, [regionTitleEdit, regions])

  const handleStartRegionDrag = useCallback((event: React.MouseEvent, box: RegionBox) => {
    event.preventDefault()
    event.stopPropagation()

    const startPointer = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    })

    const startNodePositions: Record<string, { x: number; y: number }> = {}
    nodes.forEach((node) => {
      const width = getNodeWidth(node)
      const height = getNodeHeight(node)
      const center = {
        x: node.position.x + width / 2,
        y: node.position.y + height / 2
      }
      if (pointInRegion(center, box)) {
        startNodePositions[node.id] = { ...node.position }
      }
    })

    setRegionDrag({
      regionId: box.id,
      mode: 'move',
      startPointer,
      startRegion: { x: box.x, y: box.y, width: box.width, height: box.height },
      startNodePositions
    })
  }, [nodes, screenToFlowPosition])

  const handleStartRegionResize = useCallback(
    (event: React.MouseEvent, box: RegionBox, handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w') => {
      event.preventDefault()
      event.stopPropagation()

      const startPointer = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })

      setRegionDrag({
        regionId: box.id,
        mode: 'resize',
        resizeHandle: handle,
        startPointer,
        startRegion: { x: box.x, y: box.y, width: box.width, height: box.height },
        startNodePositions: {}
      })
    },
    [screenToFlowPosition]
  )

  useEffect(() => {
    if (!regionDrag) return

    const onMouseMove = (event: MouseEvent) => {
      const pointer = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })
      const dx = pointer.x - regionDrag.startPointer.x
      const dy = pointer.y - regionDrag.startPointer.y

      if (regionDrag.mode === 'move') {
        setRegions((prev) =>
          prev.map((region) =>
            region.id === regionDrag.regionId
              ? { ...region, x: regionDrag.startRegion.x + dx, y: regionDrag.startRegion.y + dy }
              : region
          )
        )

        const movingNodeIds = new Set(Object.keys(regionDrag.startNodePositions))
        if (movingNodeIds.size === 0) return

        setNodes((nds) =>
          nds.map((node) => {
            const startPosition = regionDrag.startNodePositions[node.id]
            if (!startPosition) return node
            return {
              ...node,
              position: {
                x: startPosition.x + dx,
                y: startPosition.y + dy
              }
            }
          })
        )
        return
      }

      if (regionDrag.mode === 'resize' && regionDrag.resizeHandle) {
        const nextRegion = resizeRegionFromHandle(regionDrag.startRegion, regionDrag.resizeHandle, dx, dy)
        setRegions((prev) =>
          prev.map((region) =>
            region.id === regionDrag.regionId
              ? { ...region, ...nextRegion }
              : region
          )
        )
      }
    }

    const onMouseUp = () => {
      setRegionDrag(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [regionDrag, screenToFlowPosition, setNodes])

  const handleSave = async () => {
    try {
      const graphNodes: Node[] = nodes.map((node) => ({
        id: node.id,
        content: node.data.content || '',
        question: node.data.question || '',
        position: node.position,
        width: getNodeWidth(node),
        height: getNodeHeight(node),
        parentIds: edges.filter((edge) => edge.target === node.id).map((edge) => edge.source),
        createdAt: node.data.createdAt || new Date().toISOString(),
        updatedAt: node.data.updatedAt,
        tags: node.data.tags || [],
        note: node.data.note || '',
        versions: node.data.versions || [],
        expansionColor: node.data.expansionColor,
        sourceRef: node.data.sourceRef
      }))

      const result = await saveFile(graphNodes, edges, fileName, regions)
      const link = document.createElement('a')
      link.href = `data:application/zip;base64,${result.data}`
      link.download = `${fileName}.oml`
      link.click()

      setDirty(false)
      showToast('文件保存成功！', 'success')
    } catch (error) {
      console.error('保存失败:', error)
      showToast('保存失败，请重试', 'error')
    }
  }

  const handleLoad = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.oml'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        const result = await loadFile(base64)

        const loadedNodes: Node[] = (result.nodes || []).map((node: Node) => normalizeNodeForRuntime(node))
        const loadedRegions = normalizeRegionsWithNodeFallback(result.regions, loadedNodes)

        skipDirtyFlagRef.current = true
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
            onGenerate: (c: string) => handleGenerate(node.id, c),
            onSaveContent: (c: string) => handleSaveNodeContent(node.id, c),
            onExpand: (text: string, selectedIds?: string[], sourceRef?: SourceReference, expandMode?: ExpandMode) =>
              handleExpand(text, node.id, selectedIds, sourceRef, expandMode),
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

        setNodes(refreshNodeRuntimeData(rfNodes, loadedEdges))
        setEdges(loadedEdges)
        setRegions(loadedRegions)
        setSearchQuery('')
        setActiveSearchIndex(-1)
        setDirty(false)
        showToast('文件加载成功！', 'success')
      } catch (error) {
        console.error('加载失败:', error)
        showToast('加载失败，请检查文件格式', 'error')
      }
    }

    input.click()
  }

  const handleNew = () => {
    if (nodes.length > 0 || edges.length > 0 || regions.length > 0) {
      if (!confirm('当前文件未保存，确定要新建吗？')) return
    }

    skipDirtyFlagRef.current = true
    clearGraph()
    setNodes([])
    setEdges([])
    setRegions([])
    setInitialInput('')
    setInitialGenerating(false)
    setSearchQuery('')
    setActiveSearchIndex(-1)
    setMetaEditor(null)
    setVersionDialog(null)
    setShowRegionPanel(false)
  }

  const handleCreateFirstFromText = useCallback(() => {
    const text = initialInput.trim()
    if (!text) return
    createFirstNode(text, false, text)
    setInitialInput('')
    showToast('首节点已创建', 'success')
  }, [createFirstNode, initialInput, showToast])

  const handleGenerateFirstFromPrompt = useCallback(async () => {
    const prompt = initialInput.trim()
    if (!prompt) return

    setInitialGenerating(true)
    try {
      const result = await generateNode(prompt)
      createFirstNode(result.content || '', false, prompt)
      setInitialInput('')
      showToast('首节点生成成功', 'success')
    } catch (error) {
      console.error('首节点生成失败:', error)
      showToast('首节点生成失败，请重试', 'error')
    } finally {
      setInitialGenerating(false)
    }
  }, [createFirstNode, initialInput, showToast])

  const createNode = useCallback((position: { x: number; y: number }) => {
    createNodeAtPosition(position, '', true)
  }, [createNodeAtPosition])

  const handlePaneContextMenu = useCallback((event: any) => {
    event.preventDefault()
    const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setContextMenu({ x: event.clientX, y: event.clientY, type: 'pane', flowPosition })
  }, [screenToFlowPosition])

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: RFNode) => {
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'node',
      nodeId: node.id,
      nodeContent: String(node.data.content || '')
    })
  }, [])

  const triggerNodeEdit = useCallback((nodeId: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              isEditing: true
            }
          }
        }
        return node
      })
    )
  }, [setNodes])

  const openNodeMetaEditor = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return
    setMetaEditor({
      nodeId,
      tagsText: (node.data.tags || []).join(', '),
      note: node.data.note || ''
    })
  }, [nodes])

  const handleSaveNodeMeta = useCallback(() => {
    if (!metaEditor) return
    const tags = parseTags(metaEditor.tagsText)
    const note = metaEditor.note.trim()

    setNodes((nds) => {
      const now = new Date().toISOString()
      const nextNodes = nds.map((node) =>
        node.id === metaEditor.nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                tags,
                note,
                updatedAt: now
              }
            }
          : node
      )
      return refreshNodeRuntimeData(nextNodes, getEdges())
    })

    setMetaEditor(null)
    showToast('标签和备注已更新', 'success')
  }, [getEdges, metaEditor, refreshNodeRuntimeData, setNodes, showToast])

  const openVersionDialog = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return
    const versions = node.data.versions || []
    setVersionDialog({
      nodeId,
      versions,
      currentContent: node.data.content || ''
    })
    setSelectedVersionIndex(Math.max(0, versions.length - 1))
  }, [nodes])

  const handleRestoreVersion = useCallback(() => {
    if (!versionDialog) return
    const targetVersion = versionDialog.versions[selectedVersionIndex]
    if (!targetVersion) return

    setNodes((nds) => {
      const now = new Date().toISOString()
      const nextNodes = nds.map((node) => {
        if (node.id !== versionDialog.nodeId) return node
        const currentContent = node.data.content || ''
        return {
          ...node,
          data: {
            ...node.data,
            content: targetVersion.content,
            updatedAt: now,
            versions: getNextVersions(node.data.versions || [], currentContent)
          }
        }
      })
      return refreshNodeRuntimeData(nextNodes, getEdges())
    })

    setVersionDialog(null)
    showToast('已恢复到历史版本', 'success')
  }, [getEdges, refreshNodeRuntimeData, selectedVersionIndex, setNodes, showToast, versionDialog])

  const handleExportNode = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) {
      showToast('未找到节点', 'error')
      return
    }

    const tags = node.data.tags || []
    const note = (node.data.note || '').trim()
    const metadata = [
      `id: ${node.id}`,
      `updatedAt: ${node.data.updatedAt || ''}`,
      `tags: ${tags.join(', ')}`
    ].join('\n')

    let markdown = `<!--\n${metadata}\n-->\n\n${node.data.content || ''}`
    if (note) {
      markdown += `\n\n## 备注\n${note}\n`
    }

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${node.id}.md`
    link.click()
    URL.revokeObjectURL(link.href)

    showToast('节点已导出为 Markdown', 'success')
  }, [nodes, showToast])

  const matchedPreview = useMemo(() => {
    const query = searchQuery.trim()
    if (!query || !activeSearchNodeId) return null

    const node = nodes.find((item) => item.id === activeSearchNodeId)
    if (!node) return null

    const escaped = escapeRegExp(query)
    const regex = new RegExp(`(${escaped})`, 'ig')
    return {
      nodeId: node.id,
      highlighted: String(node.data.content || '').replace(regex, '[$1]')
    }
  }, [activeSearchNodeId, nodes, searchQuery])

  const selectedDiffLines = useMemo(() => {
    if (!versionDialog) return []
    const version = versionDialog.versions[selectedVersionIndex]
    if (!version) return []
    return buildDiffLines(version.content, versionDialog.currentContent)
  }, [selectedVersionIndex, versionDialog])

  return (
    <div className="w-screen h-screen flex flex-col bg-background">
      <Toolbar onSave={handleSave} onLoad={handleLoad} onNew={handleNew} />

      <div className="flex-1 flex">
        <div ref={canvasRef} className={cn('flex-1 transition-all duration-300 relative', detailContent && 'flex-[2]')}>
          <div className="absolute inset-0 z-20">
            <ReactFlow
              nodes={renderedNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onPaneContextMenu={handlePaneContextMenu}
              onNodeContextMenu={handleNodeContextMenu}
              onMove={(_, nextViewport) => setViewport(nextViewport)}
              panOnDrag={!regionDrag}
              fitView
            >
              <Background gap={16} size={1} color="hsl(214 32% 85%)" variant={BackgroundVariant.Dots} />
              <Controls className="!shadow-md !border-border !rounded-lg" />
            </ReactFlow>
          </div>

          <div className="absolute top-3 left-3 z-30 pointer-events-auto flex items-start gap-2">
            <div className="w-[360px] bg-white/95 border border-border rounded-lg shadow-md p-2">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      focusSearchResult(activeSearchIndex + 1)
                    }
                  }}
                  className="w-full text-sm outline-none bg-transparent"
                  placeholder="搜索内容 / 标签 / 备注..."
                />
              </div>

              {searchQuery.trim() && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>结果 {searchResults.length === 0 ? 0 : activeSearchIndex + 1} / {searchResults.length}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => focusSearchResult(activeSearchIndex - 1)}
                        disabled={searchResults.length === 0}
                        className="px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40"
                      >
                        上一个
                      </button>
                      <button
                        onClick={() => focusSearchResult(activeSearchIndex + 1)}
                        disabled={searchResults.length === 0}
                        className="px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40"
                      >
                        下一个
                      </button>
                    </div>
                  </div>

                  {matchedPreview && (
                    <div className="text-[11px] leading-relaxed text-muted-foreground border border-border rounded p-2 bg-muted/40 max-h-24 overflow-y-auto">
                      {matchedPreview.highlighted.slice(0, 220)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowRegionPanel((value) => !value)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-white/95 shadow-md text-sm hover:bg-accent"
            >
              <Layers className="w-4 h-4" />
              区域
            </button>
          </div>

          {regionBoxes.length > 0 && (
            <>
              <div className="absolute inset-0 z-[5] pointer-events-none">
                {regionBoxes.map((box) => (
                  <div
                    key={`fill-${box.id}`}
                    className={cn(
                      'absolute rounded-md',
                      regionDrag?.regionId === box.id && 'ring-1 ring-primary/40'
                    )}
                    style={{
                      left: box.x * viewport.zoom + viewport.x,
                      top: box.y * viewport.zoom + viewport.y,
                      width: box.width * viewport.zoom,
                      height: box.height * viewport.zoom,
                      border: `1.5px dashed ${box.color}`,
                      backgroundColor: `${box.color}12`
                    }}
                  >
                    {regionTitleEdit?.regionId !== box.id && (
                      <div
                        className="absolute -top-6 left-1 max-w-[240px] h-5 px-2 inline-flex items-center gap-2 text-[11px] text-white rounded-md shadow-sm pointer-events-none select-none"
                        style={{
                          backgroundColor: `${box.color}d9`,
                          border: `1px solid ${box.color}`
                        }}
                      >
                        <span className="truncate">{box.name}</span>
                        <span className="opacity-85 shrink-0">({regionCoveredNodeCount.get(box.id) || 0})</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="absolute inset-0 z-30 pointer-events-none">
                {regionBoxes.map((box) => (
                  <div
                    key={`interaction-${box.id}`}
                    className="absolute pointer-events-none"
                    style={{
                      left: box.x * viewport.zoom + viewport.x,
                      top: box.y * viewport.zoom + viewport.y,
                      width: box.width * viewport.zoom,
                      height: box.height * viewport.zoom
                    }}
                  >
                    <div
                      className={cn(
                        'absolute -top-6 left-1 max-w-[240px] h-5 px-2 inline-flex items-center gap-2 text-[11px] pointer-events-auto select-none rounded-md',
                        regionTitleEdit?.regionId === box.id ? 'cursor-text' : 'cursor-move'
                      )}
                      onMouseDown={(event) => {
                        if (regionTitleEdit?.regionId === box.id) return
                        handleStartRegionDrag(event, box)
                      }}
                      onDoubleClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        startRegionTitleEdit(box.id, box.name)
                      }}
                      style={{ backgroundColor: 'transparent', border: '1px solid transparent' }}
                    >
                      {regionTitleEdit?.regionId === box.id ? (
                        <input
                          autoFocus
                          value={regionTitleEdit.draft}
                          onChange={(event) =>
                            setRegionTitleEdit((prev) =>
                              prev
                                ? { ...prev, draft: event.target.value }
                                : prev
                            )
                          }
                          onMouseDown={(event) => event.stopPropagation()}
                          onDoubleClick={(event) => event.stopPropagation()}
                          onBlur={commitRegionTitleEdit}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              commitRegionTitleEdit()
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              setRegionTitleEdit(null)
                            }
                          }}
                          className="flex-1 h-4 px-1 rounded-sm bg-white/95 text-[11px] text-foreground outline-none"
                        />
                      ) : (
                        <span className="truncate opacity-0">{box.name}</span>
                      )}
                      <span className={cn('shrink-0', regionTitleEdit?.regionId === box.id ? 'opacity-85 text-white' : 'opacity-0')}>
                        ({regionCoveredNodeCount.get(box.id) || 0})
                      </span>
                    </div>

                    <div
                      className="absolute top-0 left-3 right-3 h-4 -translate-y-2 pointer-events-auto cursor-ns-resize"
                      onMouseDown={(event) => handleStartRegionResize(event, box, 'n')}
                    />
                    <div
                      className="absolute bottom-0 left-3 right-3 h-4 translate-y-2 pointer-events-auto cursor-ns-resize"
                      onMouseDown={(event) => handleStartRegionResize(event, box, 's')}
                    />
                    <div
                      className="absolute left-0 top-3 bottom-3 w-4 -translate-x-2 pointer-events-auto cursor-ew-resize"
                      onMouseDown={(event) => handleStartRegionResize(event, box, 'w')}
                    />
                    <div
                      className="absolute right-0 top-3 bottom-3 w-4 translate-x-2 pointer-events-auto cursor-ew-resize"
                      onMouseDown={(event) => handleStartRegionResize(event, box, 'e')}
                    />

                    <div
                      className="absolute -left-2.5 -top-2.5 w-5 h-5 bg-transparent pointer-events-auto cursor-nwse-resize"
                      onMouseDown={(event) => handleStartRegionResize(event, box, 'nw')}
                    />
                    <div
                      className="absolute -right-2.5 -top-2.5 w-5 h-5 bg-transparent pointer-events-auto cursor-nesw-resize"
                      onMouseDown={(event) => handleStartRegionResize(event, box, 'ne')}
                    />
                    <div
                      className="absolute -left-2.5 -bottom-2.5 w-5 h-5 bg-transparent pointer-events-auto cursor-nesw-resize"
                      onMouseDown={(event) => handleStartRegionResize(event, box, 'sw')}
                    />
                    <div
                      className="absolute -right-2.5 -bottom-2.5 w-5 h-5 bg-transparent pointer-events-auto cursor-nwse-resize"
                      onMouseDown={(event) => handleStartRegionResize(event, box, 'se')}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {showRegionPanel && (
            <div className="absolute top-16 right-3 z-40 w-[360px] max-h-[70vh] overflow-y-auto bg-white rounded-xl border border-border shadow-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">区域标注</h3>
                <button
                  onClick={() => setShowRegionPanel(false)}
                  className="p-1 rounded hover:bg-accent"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-2 rounded border border-border bg-muted/30 space-y-2">
                <input
                  value={newRegionName}
                  onChange={(e) => setNewRegionName(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded border border-border bg-white"
                  placeholder="区域标题"
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">颜色</label>
                  <input
                    type="color"
                    value={newRegionColor}
                    onChange={(e) => setNewRegionColor(e.target.value)}
                    className="w-10 h-8 p-0 border border-border rounded"
                  />
                </div>
                <textarea
                  value={newRegionDescription}
                  onChange={(e) => setNewRegionDescription(e.target.value)}
                  rows={2}
                  className="w-full px-2 py-1.5 text-sm rounded border border-border bg-white resize-none"
                  placeholder="区域说明（可选）"
                />
                <textarea
                  value={manualRegionNodeIds}
                  onChange={(e) => setManualRegionNodeIds(e.target.value)}
                  rows={2}
                  className="w-full px-2 py-1.5 text-xs rounded border border-border bg-white resize-none"
                  placeholder="初始化参考节点 ID（可选，逗号分隔；仅用于创建时计算区域大小）"
                />
                <div className="text-xs text-muted-foreground">
                  当前选中节点：{selectedNodeIds.length}（留空时会以选中节点初始化区域）
                </div>
                <button
                  onClick={handleCreateRegion}
                  className="w-full px-3 py-1.5 rounded bg-primary text-white text-sm hover:bg-primary/90"
                >
                  创建区域
                </button>
              </div>

              <div className="space-y-2">
                {regions.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">还没有区域</p>
                )}

                {regions.map((region) => (
                  <div key={region.id} className="p-2 rounded border border-border space-y-2">
                    <input
                      value={region.name}
                      onChange={(e) => handleUpdateRegion(region.id, { name: e.target.value })}
                      className="w-full px-2 py-1 text-sm rounded border border-border"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={region.color || '#22c55e'}
                        onChange={(e) => handleUpdateRegion(region.id, { color: e.target.value })}
                        className="w-10 h-8 p-0 border border-border rounded"
                      />
                      <div className="flex-1 text-xs text-muted-foreground">
                        覆盖节点：{regionCoveredNodeCount.get(region.id) || 0}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={Math.round(region.x)}
                        onChange={(e) => {
                          const value = Number(e.target.value)
                          if (Number.isFinite(value)) handleUpdateRegion(region.id, { x: value })
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-border"
                        placeholder="X"
                      />
                      <input
                        type="number"
                        value={Math.round(region.y)}
                        onChange={(e) => {
                          const value = Number(e.target.value)
                          if (Number.isFinite(value)) handleUpdateRegion(region.id, { y: value })
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-border"
                        placeholder="Y"
                      />
                      <input
                        type="number"
                        value={Math.round(region.width)}
                        onChange={(e) => {
                          const value = Number(e.target.value)
                          if (Number.isFinite(value)) handleUpdateRegion(region.id, { width: value })
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-border"
                        placeholder="宽度"
                      />
                      <input
                        type="number"
                        value={Math.round(region.height)}
                        onChange={(e) => {
                          const value = Number(e.target.value)
                          if (Number.isFinite(value)) handleUpdateRegion(region.id, { height: value })
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-border"
                        placeholder="高度"
                      />
                    </div>
                    <textarea
                      value={region.description || ''}
                      onChange={(e) => handleUpdateRegion(region.id, { description: e.target.value })}
                      rows={2}
                      className="w-full px-2 py-1 text-xs rounded border border-border resize-none"
                      placeholder="区域说明"
                    />
                    <button
                      onClick={() => handleDeleteRegion(region.id)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" /> 删除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nodes.length === 0 && (
            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-4">
              <div className="pointer-events-auto w-full max-w-[560px] bg-white/95 border border-border rounded-xl shadow-lg p-4 backdrop-blur">
                <h3 className="text-base font-semibold text-foreground">创建首个知识节点</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  粘贴文本可直接创建首节点，或输入 Prompt 后一键生成。
                </p>
                <textarea
                  value={initialInput}
                  onChange={(e) => setInitialInput(e.target.value)}
                  rows={6}
                  className="mt-3 w-full p-3 text-sm rounded border border-border/70 bg-background resize-none outline-none focus:border-primary/50"
                  placeholder="粘贴文本，或输入你希望生成的主题..."
                />
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={handleCreateFirstFromText}
                    disabled={!initialInput.trim() || initialGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    粘贴文本创建
                  </button>
                  <button
                    onClick={handleGenerateFirstFromPrompt}
                    disabled={!initialInput.trim() || initialGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" />
                    {initialGenerating ? '生成中...' : 'Prompt 生成'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {contextMenu && (
            <div
              data-state="open"
              className="fixed z-[9999] min-w-[220px] rounded-lg border bg-white shadow-lg py-1"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.type === 'pane' && (
                <MenuItem
                  icon={<Plus className="w-4 h-4" />}
                  label="创建知识节点"
                  onClick={() => {
                    createNode(contextMenu.flowPosition!)
                    setContextMenu(null)
                  }}
                />
              )}

              {contextMenu.type === 'node' && (
                <>
                  <MenuItem
                    icon={<Eye className="w-4 h-4" />}
                    label="查看详情"
                    onClick={() => {
                      setDetailContent(contextMenu.nodeContent || '')
                      setContextMenu(null)
                    }}
                  />
                  <MenuItem
                    icon={<Pencil className="w-4 h-4" />}
                    label="编辑内容"
                    onClick={() => {
                      triggerNodeEdit(contextMenu.nodeId!)
                      setContextMenu(null)
                    }}
                  />
                  <MenuItem
                    icon={<Tags className="w-4 h-4" />}
                    label="标签与备注"
                    onClick={() => {
                      openNodeMetaEditor(contextMenu.nodeId!)
                      setContextMenu(null)
                    }}
                  />
                  <MenuItem
                    icon={<History className="w-4 h-4" />}
                    label="版本历史"
                    onClick={() => {
                      openVersionDialog(contextMenu.nodeId!)
                      setContextMenu(null)
                    }}
                  />
                  <MenuItem
                    icon={<Download className="w-4 h-4" />}
                    label="导出为 Markdown"
                    onClick={() => {
                      handleExportNode(contextMenu.nodeId!)
                      setContextMenu(null)
                    }}
                  />
                  <div className="h-px bg-border mx-2 my-1" />
                  <MenuItem
                    icon={<RefreshCw className="w-4 h-4" />}
                    label="重新生成"
                    onClick={() => {
                      triggerNodeEdit(contextMenu.nodeId!)
                      setContextMenu(null)
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {detailContent && (
          <div className="w-[33%] bg-white border-l border-border flex flex-col shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-secondary/30">
              <span className="text-sm font-medium text-foreground">节点详情</span>
              <button
                onClick={() => setDetailContent(null)}
                className="p-1 rounded-md hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="prose prose-sm prose-slate max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{detailContent}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>

      {metaEditor && (
        <div
          className="fixed inset-0 bg-black/40 z-[10000] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMetaEditor(null)
          }}
        >
          <div className="w-full max-w-[520px] bg-white rounded-xl border border-border shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">编辑标签与备注</h3>
              <button onClick={() => setMetaEditor(null)} className="p-1 rounded hover:bg-accent">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">标签（逗号分隔）</label>
              <input
                value={metaEditor.tagsText}
                onChange={(e) => setMetaEditor({ ...metaEditor, tagsText: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded border border-border"
                placeholder="重要, 待复习, 已掌握"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">备注</label>
              <textarea
                value={metaEditor.note}
                onChange={(e) => setMetaEditor({ ...metaEditor, note: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 text-sm rounded border border-border resize-none"
                placeholder="记录你的理解、疑问或待办"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMetaEditor(null)}
                className="px-3 py-2 text-sm rounded border border-border hover:bg-accent"
              >
                取消
              </button>
              <button
                onClick={handleSaveNodeMeta}
                className="px-3 py-2 text-sm rounded bg-primary text-white hover:bg-primary/90"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {versionDialog && (
        <div
          className="fixed inset-0 bg-black/40 z-[10000] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setVersionDialog(null)
          }}
        >
          <div className="w-full max-w-[980px] max-h-[80vh] overflow-hidden bg-white rounded-xl border border-border shadow-xl flex">
            <div className="w-[280px] border-r border-border p-3 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">版本历史</h3>
                <button onClick={() => setVersionDialog(null)} className="p-1 rounded hover:bg-accent">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {versionDialog.versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无历史版本</p>
              ) : (
                <div className="space-y-1.5">
                  {versionDialog.versions.map((version, index) => (
                    <button
                      key={`${version.timestamp}-${index}`}
                      onClick={() => setSelectedVersionIndex(index)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 rounded border text-xs',
                        selectedVersionIndex === index ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-border hover:bg-accent'
                      )}
                    >
                      <div>版本 {index + 1}</div>
                      <div className="text-[11px] opacity-70 mt-0.5">{new Date(version.timestamp).toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Diff：历史版本 vs 当前内容</div>
                <button
                  onClick={handleRestoreVersion}
                  disabled={versionDialog.versions.length === 0}
                  className="px-3 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
                >
                  恢复选中版本
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-slate-50">
                {versionDialog.versions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">没有可对比内容</div>
                ) : (
                  <pre className="text-xs leading-relaxed">
                    {selectedDiffLines.map((line, index) => (
                      <div
                        key={`${line.type}-${index}`}
                        className={cn(
                          'px-2 py-0.5 rounded',
                          line.type === 'added' && 'bg-green-100 text-green-800',
                          line.type === 'removed' && 'bg-red-100 text-red-800',
                          line.type === 'same' && 'text-slate-700'
                        )}
                      >
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '} {line.text}
                      </div>
                    ))}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors text-left"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </button>
  )
}
