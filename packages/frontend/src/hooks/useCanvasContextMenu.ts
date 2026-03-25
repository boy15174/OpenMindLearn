import { useState, useEffect, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Node as RFNode } from '@xyflow/react'
import type { CanvasMode, ContextMenuState } from '../types/canvas'

export function useCanvasContextMenu(canvasMode: CanvasMode) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  const handlePaneContextMenu = useCallback((event: any) => {
    if (canvasMode !== 'learn') return
    event.preventDefault()
    const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setContextMenu({ x: event.clientX, y: event.clientY, type: 'pane', flowPosition })
  }, [canvasMode, screenToFlowPosition])

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: RFNode) => {
    if (canvasMode !== 'learn') return
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'node',
      nodeId: node.id,
      nodeContent: String(node.data.content || '')
    })
  }, [canvasMode])

  return {
    contextMenu,
    setContextMenu,
    handlePaneContextMenu,
    handleNodeContextMenu
  }
}
