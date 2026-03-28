import type React from 'react'
import type { Viewport } from '@xyflow/react'
import { cn } from '../../utils/cn'
import type { RegionBox } from '../../types/canvas'

type RegionTitleEditState = { regionId: string; draft: string } | null

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w'

interface CanvasRegionInteractionLayerProps {
  visible: boolean
  regionBoxes: RegionBox[]
  viewport: Viewport
  regionTitleEdit: RegionTitleEditState
  setRegionTitleEdit: React.Dispatch<React.SetStateAction<RegionTitleEditState>>
  regionCoveredNodeCount: Map<string, number>
  handleStartRegionDrag: (event: React.MouseEvent, box: RegionBox) => void
  startRegionTitleEdit: (regionId: string, name: string) => void
  commitRegionTitleEdit: () => void
  handleStartRegionResize: (event: React.MouseEvent, box: RegionBox, handle: ResizeHandle) => void
}

export function CanvasRegionInteractionLayer({
  visible,
  regionBoxes,
  viewport,
  regionTitleEdit,
  setRegionTitleEdit,
  regionCoveredNodeCount,
  handleStartRegionDrag,
  startRegionTitleEdit,
  commitRegionTitleEdit,
  handleStartRegionResize
}: CanvasRegionInteractionLayerProps) {
  if (!visible || regionBoxes.length === 0) return null

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {regionBoxes.map((box) => (
        <div
          key={`interaction-${box.id}`}
          className="absolute pointer-events-none"
          style={{
            left: box.x * viewport.zoom + viewport.x,
            top: box.y * viewport.zoom + viewport.y,
            width: box.width * viewport.zoom,
            height: box.height * viewport.zoom
          }}
        >
          <div
            className={cn(
              'absolute -top-6 left-1 max-w-[240px] h-5 px-2 inline-flex items-center gap-2 text-[11px] pointer-events-auto select-none rounded-md',
              regionTitleEdit?.regionId === box.id ? 'cursor-text' : 'cursor-move'
            )}
            onMouseDown={(event) => {
              if (regionTitleEdit?.regionId === box.id) return
              handleStartRegionDrag(event, box)
            }}
            onDoubleClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              startRegionTitleEdit(box.id, box.name)
            }}
            style={{ backgroundColor: 'transparent', border: '1px solid transparent' }}
          >
            {regionTitleEdit?.regionId === box.id ? (
              <input
                autoFocus
                value={regionTitleEdit.draft}
                onChange={(event) =>
                  setRegionTitleEdit((prev) =>
                    prev
                      ? { ...prev, draft: event.target.value }
                      : prev
                  )
                }
                onMouseDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onBlur={commitRegionTitleEdit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitRegionTitleEdit()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setRegionTitleEdit(null)
                  }
                }}
                className="flex-1 h-4 px-1 rounded-sm bg-background/95 border border-border/70 text-[11px] text-foreground outline-none"
              />
            ) : (
              <span className="truncate opacity-0">{box.name}</span>
            )}
            <span className={cn('shrink-0', regionTitleEdit?.regionId === box.id ? 'opacity-85 text-white' : 'opacity-0')}>
              ({regionCoveredNodeCount.get(box.id) || 0})
            </span>
          </div>

          <div
            className="absolute top-0 left-3 right-3 h-4 -translate-y-2 pointer-events-auto cursor-ns-resize"
            onMouseDown={(event) => handleStartRegionResize(event, box, 'n')}
          />
          <div
            className="absolute bottom-0 left-3 right-3 h-4 translate-y-2 pointer-events-auto cursor-ns-resize"
            onMouseDown={(event) => handleStartRegionResize(event, box, 's')}
          />
          <div
            className="absolute left-0 top-3 bottom-3 w-4 -translate-x-2 pointer-events-auto cursor-ew-resize"
            onMouseDown={(event) => handleStartRegionResize(event, box, 'w')}
          />
          <div
            className="absolute right-0 top-3 bottom-3 w-4 translate-x-2 pointer-events-auto cursor-ew-resize"
            onMouseDown={(event) => handleStartRegionResize(event, box, 'e')}
          />

          <div
            className="absolute -left-2.5 -top-2.5 w-5 h-5 bg-transparent pointer-events-auto cursor-nwse-resize"
            onMouseDown={(event) => handleStartRegionResize(event, box, 'nw')}
          />
          <div
            className="absolute -right-2.5 -top-2.5 w-5 h-5 bg-transparent pointer-events-auto cursor-nesw-resize"
            onMouseDown={(event) => handleStartRegionResize(event, box, 'ne')}
          />
          <div
            className="absolute -left-2.5 -bottom-2.5 w-5 h-5 bg-transparent pointer-events-auto cursor-nesw-resize"
            onMouseDown={(event) => handleStartRegionResize(event, box, 'sw')}
          />
          <div
            className="absolute -right-2.5 -bottom-2.5 w-5 h-5 bg-transparent pointer-events-auto cursor-nwse-resize"
            onMouseDown={(event) => handleStartRegionResize(event, box, 'se')}
          />
        </div>
      ))}
    </div>
  )
}
