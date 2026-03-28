import { Trash2, X } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { Region } from '../../types'

interface CanvasRegionPanelProps {
  open: boolean
  regions: Region[]
  isFlowInteractive: boolean
  regionCreateMode: boolean
  newRegionName: string
  newRegionColor: string
  newRegionDescription: string
  regionCoveredNodeCount: Map<string, number>
  onClose: () => void
  onSetNewRegionName: (value: string) => void
  onSetNewRegionColor: (value: string) => void
  onSetNewRegionDescription: (value: string) => void
  onToggleCreateMode: () => void
  onUpdateRegion: (regionId: string, partial: Partial<Region>) => void
  onDeleteRegion: (regionId: string) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export function CanvasRegionPanel({
  open,
  regions,
  isFlowInteractive,
  regionCreateMode,
  newRegionName,
  newRegionColor,
  newRegionDescription,
  regionCoveredNodeCount,
  onClose,
  onSetNewRegionName,
  onSetNewRegionColor,
  onSetNewRegionDescription,
  onToggleCreateMode,
  onUpdateRegion,
  onDeleteRegion,
  t
}: CanvasRegionPanelProps) {
  if (!open) return null

  return (
    <div className="absolute top-16 right-3 z-40 w-[360px] max-h-[70vh] overflow-y-auto bg-background rounded-xl border border-border shadow-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('canvas.regions.panelTitle')}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2 rounded border border-border bg-muted/30 space-y-2">
        <input
          value={newRegionName}
          onChange={(e) => onSetNewRegionName(e.target.value)}
          className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
          placeholder={t('canvas.regions.newNamePlaceholder')}
          disabled={!isFlowInteractive}
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">{t('canvas.regions.color')}</label>
          <input
            type="color"
            value={newRegionColor}
            onChange={(e) => onSetNewRegionColor(e.target.value)}
            className="w-10 h-8 p-0 border border-border rounded"
            disabled={!isFlowInteractive}
          />
        </div>
        <textarea
          value={newRegionDescription}
          onChange={(e) => onSetNewRegionDescription(e.target.value)}
          rows={2}
          className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background resize-none"
          placeholder={t('canvas.regions.descriptionPlaceholder')}
          disabled={!isFlowInteractive}
        />
        <button
          onClick={onToggleCreateMode}
          disabled={!isFlowInteractive}
          className={cn(
            'w-full px-3 py-1.5 rounded text-sm transition-colors',
            regionCreateMode
              ? 'bg-amber-500 text-white hover:bg-amber-500/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
            !isFlowInteractive && 'opacity-45 cursor-not-allowed hover:bg-primary'
          )}
        >
          {regionCreateMode ? t('canvas.regions.cancelCreate') : t('canvas.regions.create')}
        </button>
        <div className="text-xs text-muted-foreground leading-relaxed">
          {regionCreateMode ? t('canvas.regions.dragHintActive') : t('canvas.regions.dragHint')}
        </div>
      </div>

      <div className="space-y-2">
        {regions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">{t('canvas.regions.none')}</p>
        )}

        {regions.map((region) => (
          <div key={region.id} className="p-2 rounded border border-border space-y-2">
            <input
              value={region.name}
              onChange={(e) => onUpdateRegion(region.id, { name: e.target.value })}
              className="w-full px-2 py-1 text-sm rounded border border-border"
              disabled={!isFlowInteractive}
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={region.color || '#22c55e'}
                onChange={(e) => onUpdateRegion(region.id, { color: e.target.value })}
                className="w-10 h-8 p-0 border border-border rounded"
                disabled={!isFlowInteractive}
              />
              <div className="flex-1 text-xs text-muted-foreground">
                {t('canvas.regions.coveredNodes', { count: regionCoveredNodeCount.get(region.id) || 0 })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={Math.round(region.x)}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (Number.isFinite(value)) onUpdateRegion(region.id, { x: value })
                }}
                className="w-full px-2 py-1 text-xs rounded border border-border"
                placeholder="X"
                disabled={!isFlowInteractive}
              />
              <input
                type="number"
                value={Math.round(region.y)}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (Number.isFinite(value)) onUpdateRegion(region.id, { y: value })
                }}
                className="w-full px-2 py-1 text-xs rounded border border-border"
                placeholder="Y"
                disabled={!isFlowInteractive}
              />
              <input
                type="number"
                value={Math.round(region.width)}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (Number.isFinite(value)) onUpdateRegion(region.id, { width: value })
                }}
                className="w-full px-2 py-1 text-xs rounded border border-border"
                placeholder={t('canvas.regions.width')}
                disabled={!isFlowInteractive}
              />
              <input
                type="number"
                value={Math.round(region.height)}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (Number.isFinite(value)) onUpdateRegion(region.id, { height: value })
                }}
                className="w-full px-2 py-1 text-xs rounded border border-border"
                placeholder={t('canvas.regions.height')}
                disabled={!isFlowInteractive}
              />
            </div>
            <textarea
              value={region.description || ''}
              onChange={(e) => onUpdateRegion(region.id, { description: e.target.value })}
              rows={2}
              className="w-full px-2 py-1 text-xs rounded border border-border resize-none"
              placeholder={t('canvas.regions.description')}
              disabled={!isFlowInteractive}
            />
            <button
              onClick={() => onDeleteRegion(region.id)}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
              disabled={!isFlowInteractive}
            >
              <Trash2 className="w-3 h-3" /> {t('canvas.regions.delete')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
