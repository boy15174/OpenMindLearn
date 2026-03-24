import { useCallback, useState, useEffect, useRef } from 'react'
import { ReactFlow, Background, Controls, addEdge, useNodesState, useEdgesState, useReactFlow, BackgroundVariant } from '@xyflow/react'
import type { Node as RFNode } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NodeCard } from './NodeCard'
import { Toolbar } from './Toolbar'
import { generateNode, expandNode, saveFile, loadFile } from '../services/api'
import { useGraphStore } from '../stores/graphStore'
import { useToastStore } from '../stores/toastStore'
import { getExpansionColor } from '../utils/colors'
import { Plus, X, Eye, Pencil, RefreshCw, ClipboardPaste, Sparkles } from 'lucide-react'
import { cn } from '../utils/cn'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Node, SourceReference } from '../types'
import { calculateChildNodePosition, calculateInitialNodePosition } from '../utils/nodePosition'

const nodeTypes = { custom: NodeCard }

interface SourceHighlight extends SourceReference {
  color: string
}

function buildNodeSnapshots(rfNodes: any[], rfEdges: any[]): Node[] {
  return rfNodes.map(n => ({
    id: n.id,
    content: n.data.content || '',
    position: n.position,
    parentIds: rfEdges.filter(e => e.target === n.id).map(e => e.source),
    createdAt: new Date().toISOString(),
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

type MenuType = 'pane' | 'node'

interface ContextMenuState {
  x: number
  y: number
  type: MenuType
  flowPosition?: { x: number; y: number }
  nodeId?: string
  nodeContent?: string
}

export function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([])
  const [detailContent, setDetailContent] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [initialInput, setInitialInput] = useState('')
  const [initialGenerating, setInitialGenerating] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow()
  const { fileName, setDirty, loadGraph, clearGraph } = useGraphStore()
  const { showToast } = useToastStore()

  // Monitor changes to set dirty flag
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      setDirty(true)
    }
  }, [nodes, edges, setDirty])

  // Close context menu on any click
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

  const handleGenerate = useCallback(async (nodeId: string, content: string) => {
    const result = await generateNode(content)
    setNodes((nds) => nds.map(n =>
      n.id === nodeId ? {
        ...n,
        data: {
          ...n.data,
          content: result.content
        }
      } : n
    ))
  }, [setNodes])

  const handleExpand = useCallback(async (
    text: string,
    parentId: string,
    selectedNodeIds?: string[],
    sourceRef?: SourceReference
  ) => {
    const currentNodes = getNodes()
    const currentEdges = getEdges()

    const allNodes: Node[] = buildNodeSnapshots(currentNodes, currentEdges)

    // Create a placeholder node immediately
    const newNodeId = `node-${Date.now()}`
    const relationshipId = `${parentId}-${Date.now()}`
    const expansionColor = getExpansionColor(relationshipId)
    const parentNode = currentNodes.find(n => n.id === parentId)
    const placeholderNode = {
      id: newNodeId,
      type: 'custom',
      position: calculateChildNodePosition(parentNode, currentNodes),
      data: {
        content: '生成中...',
        nodeId: newNodeId,
        isGenerating: true,
        expansionColor,
        sourceRef,
        onGenerate: (c: string) => handleGenerate(newNodeId, c),
        onExpand: (nextText: string, selectedIds?: string[], nextSourceRef?: SourceReference) =>
          handleExpand(nextText, newNodeId, selectedIds, nextSourceRef),
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

    // Add placeholder node and edge immediately
    setNodes((nds) => {
      const nextNodes = [...nds, placeholderNode]
      const nextSnapshots = buildNodeSnapshots(nextNodes, edgesWithNewEdge)
      const highlightMap = buildSourceHighlightMap(nextSnapshots)
      return nextNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          allNodes: nextSnapshots,
          sourceHighlights: highlightMap.get(node.id) || []
        }
      }))
    })
    setEdges((eds) => addEdge(newEdge, eds))

    // Call API and update node content
    try {
      const result = await expandNode(text, parentId, allNodes, selectedNodeIds, sourceRef)
      setNodes((nds) => {
        const updatedNodes = nds.map(n =>
          n.id === newNodeId ? {
            ...n,
            data: {
              ...n.data,
              content: result.content,
              isGenerating: false,
              sourceRef: result.sourceRef || sourceRef
            }
          } : n
        )
        const snapshots = buildNodeSnapshots(updatedNodes, edgesWithNewEdge)
        const highlightMap = buildSourceHighlightMap(snapshots)
        return updatedNodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            allNodes: snapshots,
            sourceHighlights: highlightMap.get(node.id) || []
          }
        }))
      })
    } catch (error) {
      console.error('Failed to expand node:', error)
      setNodes((nds) => {
        const updatedNodes = nds.map(n =>
          n.id === newNodeId ? {
            ...n,
            data: {
              ...n.data,
              content: '生成失败，请重试',
              isGenerating: false,
              sourceRef
            }
          } : n
        )
        const snapshots = buildNodeSnapshots(updatedNodes, edgesWithNewEdge)
        const highlightMap = buildSourceHighlightMap(snapshots)
        return updatedNodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            allNodes: snapshots,
            sourceHighlights: highlightMap.get(node.id) || []
          }
        }))
      })
    }
  }, [getNodes, getEdges, setNodes, setEdges, handleGenerate])

  const createNodeAtPosition = useCallback((position: { x: number; y: number }, content: string, isEditing: boolean) => {
    const nodeId = Date.now().toString()
    const currentEdges = getEdges()
    const newNode = {
      id: nodeId,
      type: 'custom',
      position,
      data: {
        content,
        isEditing,
        nodeId,
        onGenerate: (c: string) => handleGenerate(nodeId, c),
        onExpand: (text: string, selectedIds?: string[], sourceRef?: SourceReference) =>
          handleExpand(text, nodeId, selectedIds, sourceRef),
        allNodes: [] as Node[],
        sourceHighlights: [] as SourceHighlight[]
      }
    }
    setNodes((nds) => {
      const nextNodes = [...nds, newNode]
      const nextSnapshots = buildNodeSnapshots(nextNodes, currentEdges)
      const highlightMap = buildSourceHighlightMap(nextSnapshots)
      return nextNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          allNodes: nextSnapshots,
          sourceHighlights: highlightMap.get(node.id) || []
        }
      }))
    })
  }, [getEdges, handleGenerate, handleExpand, setNodes])

  const createFirstNode = useCallback((content: string, isEditing: boolean) => {
    const center = getCanvasCenterFlowPosition()
    const position = calculateInitialNodePosition(getNodes(), center)
    createNodeAtPosition(position, content, isEditing)
  }, [getCanvasCenterFlowPosition, getNodes, createNodeAtPosition])

  // File operations
  const handleSave = async () => {
    try {
      const graphNodes: Node[] = nodes.map(n => ({
        id: n.id,
        content: n.data.content || '',
        position: n.position,
        parentIds: edges.filter(e => e.target === n.id).map(e => e.source),
        createdAt: new Date().toISOString(),
        expansionColor: n.data.expansionColor,
        sourceRef: n.data.sourceRef
      }))

      const result = await saveFile(graphNodes, edges, fileName)

      // Trigger browser download
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

        // Update store
        loadGraph({ nodes: result.nodes, name: result.name })

        // Convert to ReactFlow format
        const highlightMap = buildSourceHighlightMap(result.nodes)
        const rfNodes = result.nodes.map((n: Node) => ({
          id: n.id,
          type: 'custom',
          position: n.position,
          data: {
            content: n.content,
            nodeId: n.id,
            expansionColor: n.expansionColor,
            sourceRef: n.sourceRef,
            sourceHighlights: highlightMap.get(n.id) || [],
            onGenerate: (c: string) => handleGenerate(n.id, c),
            onExpand: (text: string, selectedIds?: string[], sourceRef?: SourceReference) =>
              handleExpand(text, n.id, selectedIds, sourceRef),
            allNodes: result.nodes
          }
        }))

        setNodes(rfNodes)
        setEdges(result.edges)
        showToast('文件加载成功！', 'success')
      } catch (error) {
        console.error('加载失败:', error)
        showToast('加载失败，请检查文件格式', 'error')
      }
    }
    input.click()
  }

  const handleNew = () => {
    if (nodes.length > 0 || edges.length > 0) {
      if (!confirm('当前文件未保存，确定要新建吗？')) return
    }
    clearGraph()
    setNodes([])
    setEdges([])
    setInitialInput('')
    setInitialGenerating(false)
  }

  const handleCreateFirstFromText = useCallback(() => {
    const text = initialInput.trim()
    if (!text) return
    createFirstNode(text, false)
    setInitialInput('')
    showToast('首节点已创建', 'success')
  }, [initialInput, createFirstNode, showToast])

  const handleGenerateFirstFromPrompt = useCallback(async () => {
    const prompt = initialInput.trim()
    if (!prompt) return

    setInitialGenerating(true)
    try {
      const result = await generateNode(prompt)
      createFirstNode(result.content || '', false)
      setInitialInput('')
      showToast('首节点生成成功', 'success')
    } catch (error) {
      console.error('首节点生成失败:', error)
      showToast('首节点生成失败，请重试', 'error')
    } finally {
      setInitialGenerating(false)
    }
  }, [initialInput, createFirstNode, showToast])

  const createNode = useCallback((position: { x: number; y: number }) => {
    createNodeAtPosition(position, '', true)
  }, [createNodeAtPosition])

  // Right-click on blank area
  const handlePaneContextMenu = useCallback((event: any) => {
    event.preventDefault()
    const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setContextMenu({ x: event.clientX, y: event.clientY, type: 'pane', flowPosition })
  }, [screenToFlowPosition])

  // Right-click on node
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: RFNode) => {
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'node',
      nodeId: node.id,
      nodeContent: node.data.content as string
    })
  }, [])

  // Trigger edit mode on a node
  const triggerNodeEdit = useCallback((nodeId: string) => {
    setNodes((nds) => nds.map(n => {
      if (n.id === nodeId) {
        const data = n.data as any
        data._setIsEditing?.(true)
      }
      return n
    }))
  }, [setNodes])

  return (
    <div className="w-screen h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <Toolbar onSave={handleSave} onLoad={handleLoad} onNew={handleNew} />

      {/* Canvas and Detail Panel */}
      <div className="flex-1 flex">
        {/* Canvas */}
        <div ref={canvasRef} className={cn('flex-1 transition-all duration-300 relative', detailContent && 'flex-[2]')}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onPaneContextMenu={handlePaneContextMenu}
            onNodeContextMenu={handleNodeContextMenu}
            fitView
          >
            <Background gap={16} size={1} color="hsl(214 32% 85%)" variant={BackgroundVariant.Dots} />
            <Controls className="!shadow-md !border-border !rounded-lg" />
          </ReactFlow>

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

          {/* Context Menu */}
          {contextMenu && (
            <div
              data-state="open"
              className="fixed z-[9999] min-w-[180px] rounded-lg border bg-white shadow-lg py-1"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.type === 'pane' && (
                <MenuItem
                  icon={<Plus className="w-4 h-4" />}
                  label="创建知识节点"
                  onClick={() => { createNode(contextMenu.flowPosition!); setContextMenu(null) }}
                />
              )}
              {contextMenu.type === 'node' && (
                <>
                  <MenuItem
                    icon={<Eye className="w-4 h-4" />}
                    label="查看详情"
                    onClick={() => { setDetailContent(contextMenu.nodeContent || ''); setContextMenu(null) }}
                  />
                  <MenuItem
                    icon={<Pencil className="w-4 h-4" />}
                    label="编辑内容"
                    onClick={() => { triggerNodeEdit(contextMenu.nodeId!); setContextMenu(null) }}
                  />
                  <div className="h-px bg-border mx-2 my-1" />
                  <MenuItem
                    icon={<RefreshCw className="w-4 h-4" />}
                    label="重新生成"
                    onClick={() => { triggerNodeEdit(contextMenu.nodeId!); setContextMenu(null) }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Detail Panel */}
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
