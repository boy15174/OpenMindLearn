import { Search } from 'lucide-react'

interface CanvasSearchPanelProps {
  searchQuery: string
  activeSearchIndex: number
  searchResultsLength: number
  matchedPreview: { highlighted: string } | null
  onSearchQueryChange: (value: string) => void
  onNext: () => void
  onPrev: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export function CanvasSearchPanel({
  searchQuery,
  activeSearchIndex,
  searchResultsLength,
  matchedPreview,
  onSearchQueryChange,
  onNext,
  onPrev,
  t
}: CanvasSearchPanelProps) {
  return (
    <div className="w-[360px] bg-background/95 border border-border rounded-lg shadow-md p-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onNext()
          }}
          className="w-full text-sm outline-none bg-transparent"
          placeholder={t('canvas.search.placeholder')}
        />
      </div>

      {searchQuery.trim() && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('canvas.search.result', { current: searchResultsLength === 0 ? 0 : activeSearchIndex + 1, total: searchResultsLength })}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={onPrev}
                disabled={searchResultsLength === 0}
                className="px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40"
              >
                {t('canvas.search.prev')}
              </button>
              <button
                onClick={onNext}
                disabled={searchResultsLength === 0}
                className="px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40"
              >
                {t('canvas.search.next')}
              </button>
            </div>
          </div>

          {matchedPreview && (
            <div className="text-[11px] leading-relaxed text-muted-foreground border border-border rounded p-2 bg-muted/40 max-h-24 overflow-y-auto">
              {matchedPreview.highlighted.slice(0, 220)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
