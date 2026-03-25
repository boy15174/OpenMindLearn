import type { Node } from '../types'
import {
  NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, NODE_MIN_WIDTH, NODE_MIN_HEIGHT,
} from '../types/canvas'

export function parseNodeDimension(value: unknown, fallback: number, minimum: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(minimum, numeric)
}

export function getNodeWidth(node: any): number {
  return parseNodeDimension(
    node?.width ?? node?.data?.width ?? node?.style?.width,
    NODE_DEFAULT_WIDTH,
    NODE_MIN_WIDTH
  )
}

export function getNodeHeight(node: any): number {
  return parseNodeDimension(
    node?.height ?? node?.data?.height ?? node?.style?.height,
    NODE_DEFAULT_HEIGHT,
    NODE_MIN_HEIGHT
  )
}

export function toPlacementNode(node: any): { id: string; position: { x: number; y: number }; width: number; height: number } {
  return {
    id: node.id,
    position: node.position,
    width: getNodeWidth(node),
    height: getNodeHeight(node)
  }
}

export function normalizeNodeForRuntime(node: Node): Node {
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
