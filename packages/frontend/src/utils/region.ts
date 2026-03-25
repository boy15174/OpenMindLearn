import type { Region } from '../types'
import {
  REGION_PADDING, REGION_DEFAULT_WIDTH, REGION_DEFAULT_HEIGHT,
  REGION_MIN_WIDTH, REGION_MIN_HEIGHT,
} from '../types/canvas'
import { getNodeWidth, getNodeHeight } from './nodeDimension'

export function normalizeRegionsForRuntime(regions?: Region[]): Region[] {
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

export function pointInRegion(point: { x: number; y: number }, region: Pick<Region, 'x' | 'y' | 'width' | 'height'>): boolean {
  return (
    point.x >= region.x &&
    point.x <= region.x + region.width &&
    point.y >= region.y &&
    point.y <= region.y + region.height
  )
}

export function resizeRegionFromHandle(
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

export function inferRegionRectFromNodeIds(nodeIds: string[], nodes: any[]): { x: number; y: number; width: number; height: number } | null {
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

export function normalizeRegionsWithNodeFallback(regions: Region[] | undefined, nodes: any[]): Region[] {
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
