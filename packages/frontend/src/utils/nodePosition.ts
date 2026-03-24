interface PositionedNode {
  id: string
  position: { x: number; y: number }
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

function intersects(
  a: { x: number; y: number },
  b: { x: number; y: number },
  options: Required<NodePlacementOptions>
): boolean {
  const aLeft = a.x - options.collisionPadding
  const aTop = a.y - options.collisionPadding
  const aRight = a.x + options.nodeWidth + options.collisionPadding
  const aBottom = a.y + options.nodeHeight + options.collisionPadding

  const bLeft = b.x - options.collisionPadding
  const bTop = b.y - options.collisionPadding
  const bRight = b.x + options.nodeWidth + options.collisionPadding
  const bBottom = b.y + options.nodeHeight + options.collisionPadding

  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop
}

function buildColumnOrder(maxColumns: number): number[] {
  const order = [0]
  for (let i = 1; i <= maxColumns; i += 1) {
    order.push(i, -i)
  }
  return order
}

export function calculateChildNodePosition(
  parentNode: PositionedNode | undefined,
  nodes: PositionedNode[],
  overrides?: NodePlacementOptions
): { x: number; y: number } {
  if (!parentNode) return { x: 0, y: 0 }

  const options: Required<NodePlacementOptions> = { ...DEFAULT_OPTIONS, ...overrides }
  const columnStep = options.nodeWidth + options.horizontalGap
  const rowStep = options.nodeHeight + options.verticalGap
  const baseY = parentNode.position.y + rowStep
  const columnOrder = buildColumnOrder(options.maxColumns)

  for (let row = 0; row <= options.maxRows; row += 1) {
    const y = baseY + row * rowStep
    for (const column of columnOrder) {
      const x = parentNode.position.x + column * columnStep
      const candidate = { x, y }
      const hasCollision = nodes.some((node) => intersects(candidate, node.position, options))
      if (!hasCollision) return candidate
    }
  }

  return {
    x: parentNode.position.x,
    y: baseY + (options.maxRows + 1) * rowStep
  }
}
