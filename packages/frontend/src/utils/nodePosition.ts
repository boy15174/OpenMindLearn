interface PositionedNode {
  id: string
  position: { x: number; y: number }
  width?: number
  height?: number
}

interface NodePlacementOptions {
  nodeWidth?: number
  nodeHeight?: number
  verticalGap?: number
  horizontalGap?: number
  collisionPadding?: number
  maxRows?: number
  maxColumns?: number
}

const DEFAULT_OPTIONS: Required<NodePlacementOptions> = {
  nodeWidth: 380,
  nodeHeight: 300,
  verticalGap: 80,
  horizontalGap: 48,
  collisionPadding: 24,
  maxRows: 8,
  maxColumns: 6
}

function mergeOptions(overrides?: NodePlacementOptions): Required<NodePlacementOptions> {
  return { ...DEFAULT_OPTIONS, ...overrides }
}

function intersects(
  a: { x: number; y: number },
  b: PositionedNode,
  options: Required<NodePlacementOptions>
): boolean {
  const aLeft = a.x - options.collisionPadding
  const aTop = a.y - options.collisionPadding
  const aRight = a.x + options.nodeWidth + options.collisionPadding
  const aBottom = a.y + options.nodeHeight + options.collisionPadding

  const bWidth = Number.isFinite(b.width) ? Number(b.width) : options.nodeWidth
  const bHeight = Number.isFinite(b.height) ? Number(b.height) : options.nodeHeight
  const bLeft = b.position.x - options.collisionPadding
  const bTop = b.position.y - options.collisionPadding
  const bRight = b.position.x + bWidth + options.collisionPadding
  const bBottom = b.position.y + bHeight + options.collisionPadding

  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop
}

function buildColumnOrder(maxColumns: number): number[] {
  const order = [0]
  for (let i = 1; i <= maxColumns; i += 1) {
    order.push(i, -i)
  }
  return order
}

function findAvailablePosition(
  anchor: { x: number; y: number },
  nodes: PositionedNode[],
  options: Required<NodePlacementOptions>
): { x: number; y: number } {
  const columnStep = options.nodeWidth + options.horizontalGap
  const rowStep = options.nodeHeight + options.verticalGap
  const columnOrder = buildColumnOrder(options.maxColumns)

  for (let row = 0; row <= options.maxRows; row += 1) {
    const y = anchor.y + row * rowStep
    for (const column of columnOrder) {
      const x = anchor.x + column * columnStep
      const candidate = { x, y }
      const hasCollision = nodes.some((node) => intersects(candidate, node, options))
      if (!hasCollision) return candidate
    }
  }

  return {
    x: anchor.x,
    y: anchor.y + (options.maxRows + 1) * rowStep
  }
}

export function calculateInitialNodePosition(
  nodes: PositionedNode[],
  viewportCenter: { x: number; y: number },
  overrides?: NodePlacementOptions
): { x: number; y: number } {
  const options = mergeOptions(overrides)
  const anchor = {
    x: viewportCenter.x - options.nodeWidth / 2,
    y: viewportCenter.y - options.nodeHeight / 2
  }

  if (nodes.length === 0) return anchor
  return findAvailablePosition(anchor, nodes, options)
}

export function calculateChildNodePosition(
  parentNode: PositionedNode | undefined,
  nodes: PositionedNode[],
  overrides?: NodePlacementOptions
): { x: number; y: number } {
  if (!parentNode) return { x: 0, y: 0 }

  const options = mergeOptions(overrides)
  const parentHeight = Number.isFinite(parentNode.height) ? Number(parentNode.height) : options.nodeHeight
  const baseY = parentNode.position.y + parentHeight + options.verticalGap
  return findAvailablePosition({ x: parentNode.position.x, y: baseY }, nodes, options)
}
