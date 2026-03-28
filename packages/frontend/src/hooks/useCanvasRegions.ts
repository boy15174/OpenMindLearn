import { useState, useEffect, useMemo, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useToastStore } from '../stores/toastStore'
import type { Region } from '../types'
import type { CanvasMode, RegionBox, RegionDragState } from '../types/canvas'
import {
  REGION_MIN_WIDTH, REGION_MIN_HEIGHT,
} from '../types/canvas'
import { normalizeRegionsForRuntime, pointInRegion, resizeRegionFromHandle } from '../utils/region'
import { getNodeWidth, getNodeHeight } from '../utils/nodeDimension'
import { tFromSettings } from './useI18n'

interface RegionCreateDraft {
  startPointer: { x: number; y: number }
  currentPointer: { x: number; y: number }
  startClient: { x: number; y: number }
  currentClient: { x: number; y: number }
}

function buildRegionRectFromDrag(
  start: { x: number; y: number },
  current: { x: number; y: number }
): { x: number; y: number; width: number; height: number } {
  const draggingRight = current.x >= start.x
  const draggingDown = current.y >= start.y
  const width = Math.max(REGION_MIN_WIDTH, Math.abs(current.x - start.x))
  const height = Math.max(REGION_MIN_HEIGHT, Math.abs(current.y - start.y))

  return {
    x: draggingRight ? start.x : start.x - width,
    y: draggingDown ? start.y : start.y - height,
    width,
    height
  }
}

export function useCanvasRegions(
  nodes: any[],
  setNodes: (updater: any) => void,
  canvasMode: CanvasMode,
  interactionEnabled: boolean
) {
  const [regions, setRegions] = useState<Region[]>([])
  const [regionDrag, setRegionDrag] = useState<RegionDragState | null>(null)
  const [regionCreateMode, setRegionCreateMode] = useState(false)
  const [regionCreateDraft, setRegionCreateDraft] = useState<RegionCreateDraft | null>(null)
  const [regionTitleEdit, setRegionTitleEdit] = useState<{ regionId: string; draft: string } | null>(null)
  const [showRegionPanel, setShowRegionPanel] = useState(false)
  const [newRegionName, setNewRegionName] = useState('')
  const [newRegionColor, setNewRegionColor] = useState('#22c55e')
  const [newRegionDescription, setNewRegionDescription] = useState('')

  const { screenToFlowPosition } = useReactFlow()
  const { showToast } = useToastStore()

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

  const handleToggleRegionCreateMode = useCallback(() => {
    if (!interactionEnabled) return
    setRegionDrag(null)
    setRegionTitleEdit(null)
    setRegionCreateDraft(null)
    setRegionCreateMode((prev) => !prev)
  }, [interactionEnabled])

  const handlePaneMouseDownForRegionCreate = useCallback((event: MouseEvent | React.MouseEvent) => {
    if (canvasMode !== 'learn' || !interactionEnabled || !regionCreateMode) return false
    if (event.button !== 0) return false

    const target = event.target as HTMLElement | null
    if (!target) return false
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge') || target.closest('.react-flow__controls')) return false
    if (!target.closest('.react-flow__pane')) return false

    event.preventDefault()
    event.stopPropagation()

    const startPointer = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    })
    setRegionDrag(null)
    setRegionTitleEdit(null)
    setRegionCreateDraft({
      startPointer,
      currentPointer: startPointer,
      startClient: { x: event.clientX, y: event.clientY },
      currentClient: { x: event.clientX, y: event.clientY }
    })
    return true
  }, [canvasMode, interactionEnabled, regionCreateMode, screenToFlowPosition])

  const handleUpdateRegion = useCallback((regionId: string, patch: Partial<Region>) => {
    if (!interactionEnabled) return
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
  }, [interactionEnabled])

  const handleDeleteRegion = useCallback((regionId: string) => {
    if (!interactionEnabled) return
    setRegions((prev) => prev.filter((region) => region.id !== regionId))
  }, [interactionEnabled])

  const startRegionTitleEdit = useCallback((regionId: string, currentName: string) => {
    if (!interactionEnabled) return
    setRegionDrag(null)
    setRegionTitleEdit({
      regionId,
      draft: currentName
    })
  }, [interactionEnabled])

  const commitRegionTitleEdit = useCallback(() => {
    if (!interactionEnabled) {
      setRegionTitleEdit(null)
      return
    }
    if (!regionTitleEdit) return
    const nextName = regionTitleEdit.draft.trim()
    if (nextName) {
      handleUpdateRegion(regionTitleEdit.regionId, { name: nextName })
    }
    setRegionTitleEdit(null)
  }, [handleUpdateRegion, interactionEnabled, regionTitleEdit])

  useEffect(() => {
    if (!regionTitleEdit) return
    const exists = regions.some((region) => region.id === regionTitleEdit.regionId)
    if (!exists) setRegionTitleEdit(null)
  }, [regionTitleEdit, regions])

  const handleStartRegionDrag = useCallback((event: React.MouseEvent, box: RegionBox) => {
    if (canvasMode !== 'learn' || !interactionEnabled) return
    event.preventDefault()
    event.stopPropagation()

    const startPointer = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    })

    const startNodePositions: Record<string, { x: number; y: number }> = {}
    nodes.forEach((node: any) => {
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
  }, [canvasMode, interactionEnabled, nodes, screenToFlowPosition])

  const handleStartRegionResize = useCallback(
    (event: React.MouseEvent, box: RegionBox, handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w') => {
      if (canvasMode !== 'learn' || !interactionEnabled) return
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
    [canvasMode, interactionEnabled, screenToFlowPosition]
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

        setNodes((nds: any[]) =>
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

  useEffect(() => {
    if (!regionCreateDraft) return

    const onMouseMove = (event: MouseEvent) => {
      const currentPointer = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })
      setRegionCreateDraft((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          currentPointer,
          currentClient: { x: event.clientX, y: event.clientY }
        }
      })
    }

    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 0) return
      const dragDeltaX = Math.abs(event.clientX - regionCreateDraft.startClient.x)
      const dragDeltaY = Math.abs(event.clientY - regionCreateDraft.startClient.y)
      if (dragDeltaX < 6 && dragDeltaY < 6) {
        setRegionCreateDraft(null)
        return
      }
      const endPointer = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })
      const nextRect = buildRegionRectFromDrag(regionCreateDraft.startPointer, endPointer)

      const region: Region = {
        id: `region-${Date.now()}`,
        name: newRegionName.trim() || `${tFromSettings('canvas.regions.button')} ${regions.length + 1}`,
        color: newRegionColor,
        description: newRegionDescription.trim(),
        x: nextRect.x,
        y: nextRect.y,
        width: nextRect.width,
        height: nextRect.height,
        createdAt: new Date().toISOString()
      }

      setRegions((prev) => [...prev, region])
      setNewRegionName('')
      setNewRegionDescription('')
      setRegionCreateDraft(null)
      setRegionCreateMode(false)
      showToast(tFromSettings('toast.regionCreated'), 'success')
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [newRegionColor, newRegionDescription, newRegionName, regionCreateDraft, regions.length, screenToFlowPosition, showToast])

  useEffect(() => {
    if (!regionCreateMode) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setRegionCreateDraft(null)
      setRegionCreateMode(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [regionCreateMode])

  useEffect(() => {
    if (interactionEnabled) return
    setRegionDrag(null)
    setRegionCreateDraft(null)
    setRegionCreateMode(false)
    setRegionTitleEdit(null)
  }, [interactionEnabled])

  useEffect(() => {
    if (canvasMode === 'learn') return
    setRegionCreateDraft(null)
    setRegionCreateMode(false)
  }, [canvasMode])

  return {
    regions,
    setRegions,
    regionDrag,
    setRegionDrag,
    regionCreateMode,
    setRegionCreateMode,
    regionCreateDraft,
    regionTitleEdit,
    setRegionTitleEdit,
    showRegionPanel,
    setShowRegionPanel,
    newRegionName,
    setNewRegionName,
    newRegionColor,
    setNewRegionColor,
    newRegionDescription,
    setNewRegionDescription,
    regionBoxes,
    regionCoveredNodeCount,
    handleToggleRegionCreateMode,
    handlePaneMouseDownForRegionCreate,
    handleUpdateRegion,
    handleDeleteRegion,
    startRegionTitleEdit,
    commitRegionTitleEdit,
    handleStartRegionDrag,
    handleStartRegionResize
  }
}
