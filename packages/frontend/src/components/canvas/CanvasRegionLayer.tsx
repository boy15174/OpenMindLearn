import type { Viewport } from '@xyflow/react'
import { cn } from '../../utils/cn'
import type { RegionBox, RegionDragState } from '../../types/canvas'

interface CanvasRegionLayerProps {
  regionBoxes: RegionBox[]
  regionDrag: RegionDragState | null
  regionTitleEdit: { regionId: string; draft: string } | null
  regionCoveredNodeCount: Map<string, number>
  viewport: Viewport
}

export function CanvasRegionLayer({
  regionBoxes,
  regionDrag,
  regionTitleEdit,
  regionCoveredNodeCount,
  viewport
}: CanvasRegionLayerProps) {
  if (regionBoxes.length === 0) return null

  return (
    <div className="absolute inset-0 z-[5] pointer-events-none">
      {regionBoxes.map((box) => (
        <div
          key={`fill-${box.id}`}
          className={cn('absolute rounded-md', regionDrag?.regionId === box.id && 'ring-1 ring-primary/40')}
          style={{
            left: box.x * viewport.zoom + viewport.x,
            top: box.y * viewport.zoom + viewport.y,
            width: box.width * viewport.zoom,
            height: box.height * viewport.zoom,
            border: `1.5px dashed ${box.color}`,
            backgroundColor: `${box.color}12`
          }}
        >
          {regionTitleEdit?.regionId !== box.id && (
            <div
              className="absolute -top-6 left-1 max-w-[240px] h-5 px-2 inline-flex items-center gap-2 text-[11px] text-white rounded-md shadow-sm pointer-events-none select-none"
              style={{
                backgroundColor: `${box.color}d9`,
                border: `1px solid ${box.color}`
              }}
            >
              <span className="truncate">{box.name}</span>
              <span className="opacity-85 shrink-0">({regionCoveredNodeCount.get(box.id) || 0})</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
