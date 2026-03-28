import { Background, BackgroundVariant, Controls, ReactFlow } from '@xyflow/react'
import type { Node as RFNode, Viewport } from '@xyflow/react'
import type { ComponentType } from 'react'

interface CanvasFlowProps {
  nodes: any[]
  edges: any[]
  nodeTypes: Record<string, ComponentType<any>>
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  onPaneContextMenu: (event: any) => void
  onPaneMouseDown: (event: any) => void
  onNodeContextMenu: (event: any, node: RFNode) => void
  onNodeClick: (event: any, node: RFNode) => void
  onMove: (viewport: Viewport) => void
  canvasMode: 'learn' | 'view'
  isFlowInteractive: boolean
  regionDragActive: boolean
  regionCreateMode: boolean
  theme: 'light' | 'dark'
  onInteractiveChange: (interactive: boolean) => void
}

export function CanvasFlow({
  nodes,
  edges,
  nodeTypes,
  onNodesChange,
  onEdgesChange,
  onPaneContextMenu,
  onPaneMouseDown,
  onNodeContextMenu,
  onNodeClick,
  onMove,
  canvasMode,
  isFlowInteractive,
  regionDragActive,
  regionCreateMode,
  theme,
  onInteractiveChange
}: CanvasFlowProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onPaneContextMenu={onPaneContextMenu}
      onMouseDown={onPaneMouseDown}
      onNodeContextMenu={onNodeContextMenu}
      onNodeClick={onNodeClick}
      onMove={(_, nextViewport) => onMove(nextViewport)}
      nodesDraggable={canvasMode === 'learn' && isFlowInteractive}
      nodesConnectable={false}
      nodesFocusable={canvasMode === 'learn' && isFlowInteractive}
      edgesFocusable={canvasMode === 'learn' && isFlowInteractive}
      elementsSelectable={isFlowInteractive}
      deleteKeyCode={canvasMode === 'learn' && isFlowInteractive ? ['Backspace', 'Delete'] : null}
      panOnDrag={!regionDragActive && !regionCreateMode}
      colorMode={theme}
      fitView
    >
      <Background gap={16} size={1} color="hsl(var(--canvas-dot))" variant={BackgroundVariant.Dots} />
      <Controls className="!shadow-md !border-border !rounded-lg" onInteractiveChange={onInteractiveChange} />
    </ReactFlow>
  )
}
