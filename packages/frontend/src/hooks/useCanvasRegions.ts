import { useState, useEffect, useMemo, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useToastStore } from '../stores/toastStore'
import type { Region } from '../types'
import type { CanvasMode, RegionBox, RegionDragState } from '../types/canvas'
import {
  REGION_DEFAULT_WIDTH, REGION_DEFAULT_HEIGHT,
  REGION_MIN_WIDTH, REGION_MIN_HEIGHT,
} from '../types/canvas'
import { normalizeRegionsForRuntime, pointInRegion, resizeRegionFromHandle, inferRegionRectFromNodeIds } from '../utils/region'
import { getNodeWidth, getNodeHeight } from '../utils/nodeDimension'

export function useCanvasRegions(
  nodes: any[],
  setNodes: (updater: any) => void,
  canvasMode: CanvasMode,
  selectedNodeIds: string[],
  getCanvasCenterFlowPosition: () => { x: number; y: number }
) {
  const [regions, setRegions] = useState<Region[]>([])
  const [regionDrag, setRegionDrag] = useState<RegionDragState | null>(null)
  const [regionTitleEdit, setRegionTitleEdit] = useState<{ regionId: string; draft: string } | null>(null)
  const [showRegionPanel, setShowRegionPanel] = useState(false)
  const [newRegionName, setNewRegionName] = useState('')
  const [newRegionColor, setNewRegionColor] = useState('#22c55e')
  const [newRegionDescription, setNewRegionDescription] = useState('')
  const [manualRegionNodeIds, setManualRegionNodeIds] = useState('')

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

  const handleCreateRegion = useCallback(() => {
    const parsedManualIds = manualRegionNodeIds
      .split(/[,，\n]/g)
      .map((item) => item.trim())
      .filter(Boolean)

    const sourceIds = parsedManualIds.length > 0 ? parsedManualIds : selectedNodeIds
    const validNodeIdSet = new Set(nodes.map((node: any) => node.id))
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
    if (canvasMode !== 'learn') return
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
  }, [canvasMode, nodes, screenToFlowPosition])

  const handleStartRegionResize = useCallback(
    (event: React.MouseEvent, box: RegionBox, handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w') => {
      if (canvasMode !== 'learn') return
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
    [canvasMode, screenToFlowPosition]
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

  return {
    regions,
    setRegions,
    regionDrag,
    setRegionDrag,
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
    manualRegionNodeIds,
    setManualRegionNodeIds,
    regionBoxes,
    regionCoveredNodeCount,
    handleCreateRegion,
    handleUpdateRegion,
    handleDeleteRegion,
    startRegionTitleEdit,
    commitRegionTitleEdit,
    handleStartRegionDrag,
    handleStartRegionResize
  }
}
