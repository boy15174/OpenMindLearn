import { useCallback, useState, useEffect } from 'react'
import { ReactFlow, Background, Controls, addEdge, useNodesState, useEdgesState, useReactFlow } from '@xyflow/react'
import type { Node as RFNode } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NodeCard } from './NodeCard'
import { generateNode, expandNode } from '../services/api'
import { Plus, X, Eye, Pencil, RefreshCw } from 'lucide-react'
import { cn } from '../utils/cn'
import ReactMarkdown from 'react-markdown'

const nodeTypes = { custom: NodeCard }

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
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [detailContent, setDetailContent] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  // Close context menu on any click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  const handleGenerate = useCallback(async (nodeId: string, content: string) => {
    const result = await generateNode(content)
    setNodes((nds) => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, content: result.content } } : n
    ))
  }, [setNodes])

  const handleExpand = useCallback(async (text: string, parentId: string) => {
    // Create a placeholder node immediately
    const newNodeId = `node-${Date.now()}`
    const parentNode = nodes.find(n => n.id === parentId)
    const placeholderNode = {
      id: newNodeId,
      type: 'custom',
      position: {
        x: (parentNode?.position.x || 0) + 400,
        y: (parentNode?.position.y || 0) + 50
      },
      data: {
        content: '生成中...',
        nodeId: newNodeId,
        isGenerating: true,
        onGenerate: (c: string) => handleGenerate(newNodeId, c),
        onExpand: (text: string) => handleExpand(text, newNodeId),
      }
    }

    // Add placeholder node and edge immediately
    setNodes((nds) => [...nds, placeholderNode])
    setEdges((eds) => addEdge({ id: `e${parentId}-${newNodeId}`, source: parentId, target: newNodeId }, eds))

    // Call API and update node content
    try {
      const result = await expandNode(text, parentId)
      setNodes((nds) => nds.map(n =>
        n.id === newNodeId ? { ...n, data: { ...n.data, content: result.content, isGenerating: false } } : n
      ))
    } catch (error) {
      console.error('Failed to expand node:', error)
      setNodes((nds) => nds.map(n =>
        n.id === newNodeId ? { ...n, data: { ...n.data, content: '生成失败，请重试', isGenerating: false } } : n
      ))
    }
  }, [nodes, setNodes, setEdges, handleGenerate])

  const createNode = useCallback((position: { x: number; y: number }) => {
    const nodeId = Date.now().toString()
    const newNode = {
      id: nodeId,
      type: 'custom',
      position,
      data: {
        content: '',
        isEditing: true,
        nodeId,
        onGenerate: (c: string) => handleGenerate(nodeId, c),
        onExpand: (text: string) => handleExpand(text, nodeId),
      }
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes, handleGenerate, handleExpand])

  // Right-click on blank area
  const handlePaneContextMenu = useCallback((event: React.MouseEvent) => {
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
    <div className="w-screen h-screen flex bg-background">
      {/* Canvas */}
      <div className={cn('flex-1 transition-all duration-300', detailContent && 'flex-[2]')}>
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
          <Background gap={16} size={1} color="hsl(214 32% 85%)" variant="dots" />
          <Controls className="!shadow-md !border-border !rounded-lg" />
        </ReactFlow>

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
              <ReactMarkdown>{detailContent}</ReactMarkdown>
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
