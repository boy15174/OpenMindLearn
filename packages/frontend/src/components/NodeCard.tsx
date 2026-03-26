import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, NodeResizer } from '@xyflow/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sparkles, Loader2, Save, ImagePlus, X } from 'lucide-react'
import { cn } from '../utils/cn'
import { ImageLightbox } from './ImageLightbox'
import { ContextPanel } from './ContextPanel'
import { useToastStore } from '../stores/toastStore'
import { NODE_MIN_WIDTH, NODE_MIN_HEIGHT } from '../types/canvas'
import type { NodeCardProps } from '../types/nodeCard'

import { fingerprintBase64 } from '../utils/textMeta'
import { readFilesAsNodeImages, readClipboardImages } from '../utils/image'
import { getContainerPlainText, clearSourceHighlightMarks, applySourceHighlightByRanges } from '../utils/sourceHighlight'
import { useNodeCardSelection } from '../hooks/useNodeCardSelection'

export const NodeCard = memo(({ data, selected }: NodeCardProps) => {
  const isReadOnly = data.mode === 'view'
  const images = data.images || []
  const hasImages = images.length > 0
  const [isEditing, setIsEditing] = useState(data.isEditing || false)
  const [content, setContent] = useState(data.content)
  const [loading, setLoading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { showToast } = useToastStore()

  const selection = useNodeCardSelection()

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    readFilesAsNodeImages(files).then((newImages) => {
      data.onImagesChange?.([...(data.images || []), ...newImages])
    })
    e.target.value = ''
  }, [data])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (isReadOnly) return
    const items = e.clipboardData.items
    const hasImage = Array.from(items).some((item) => item.type.startsWith('image/'))
    if (!hasImage) return
    e.preventDefault()
    readClipboardImages(items).then((newImages) => {
      if (newImages.length > 0) {
        data.onImagesChange?.([...(data.images || []), ...newImages])
      }
    })
  }, [data, isReadOnly])

  useEffect(() => {
    if (data.content && data.content !== content) {
      setContent(data.content)
      setIsEditing(false)
    }
  }, [data.content])

  useEffect(() => {
    setIsEditing(!isReadOnly && Boolean(data.isEditing))
  }, [data.isEditing, isReadOnly])

  useEffect(() => {
    if (isReadOnly) {
      setIsEditing(false)
      selection.clearReadOnlyState()
    }
  }, [isReadOnly])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  useEffect(() => {
    const container = selection.contentRef.current
    if (!container || isEditing) return

    clearSourceHighlightMarks(container)
    const plainText = getContainerPlainText(container)
    const validHighlights = (data.sourceHighlights || []).filter((highlight) => {
      if (!highlight.upstreamFingerprintBase64) return false
      if (highlight.rangeStart < 0 || highlight.rangeEnd <= highlight.rangeStart) return false
      if (highlight.rangeEnd > plainText.length) return false
      return highlight.upstreamFingerprintBase64 === fingerprintBase64(plainText)
    })

    if (validHighlights.length > 0) {
      applySourceHighlightByRanges(container, validHighlights)
    }
  }, [content, isEditing, data.sourceHighlights])

  const handleGenerate = async () => {
    if (!content.trim()) return
    setLoading(true)
    try {
      await data.onGenerate(content)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    data.onSaveContent(content)
    setIsEditing(false)
  }

  return (
    <div
      onPaste={handlePaste}
      className={cn(
        'rounded-lg border bg-background text-foreground shadow-sm transition-all',
        'w-full h-full min-h-0 relative group flex flex-col',
        data.searchMatched && 'ring-2 ring-amber-400/80 shadow-md',
        data.searchActive && 'ring-2 ring-amber-500 shadow-lg',
        isEditing && 'ring-1 ring-primary/40 shadow-md'
      )}
      style={{
        borderColor: data.expansionColor || undefined,
        borderWidth: data.expansionColor ? '2px' : undefined
      }}
    >
      <NodeResizer
        minWidth={NODE_MIN_WIDTH}
        minHeight={NODE_MIN_HEIGHT}
        shouldResize={(_, params) => (
          params.width >= NODE_MIN_WIDTH &&
          params.height >= NODE_MIN_HEIGHT
        )}
        isVisible={Boolean(selected) && !isReadOnly}
        lineClassName="!border-primary/35"
        handleClassName="!w-2.5 !h-2.5 !rounded-sm !bg-background !border !border-primary/55"
      />

      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-primary/50 !border-2 !border-background"
      />

      <div className="p-2 flex-1 min-h-0 flex flex-col overflow-hidden">
        {!isEditing && (
          <div className="mb-1 flex flex-wrap gap-1">
            {(data.tags || []).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 text-[11px] rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/45 dark:text-blue-200 dark:border-blue-800">
                #{tag}
              </span>
            ))}
            {(data.note || '').trim() && (
              <span className="px-1.5 py-0.5 text-[11px] rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/45 dark:text-amber-200 dark:border-amber-800">
                备注
              </span>
            )}
          </div>
        )}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className={cn(
              'w-full flex-1 min-h-[180px] p-1.5 text-sm rounded border border-border/60 bg-background',
              'resize-none outline-none focus:border-primary/40',
              'placeholder:text-muted-foreground/50 nowheel nodrag'
            )}
            placeholder="输入内容或问题..."
          />
        ) : (
          <div className="space-y-1 flex-1 min-h-0 flex flex-col">
            <div
              ref={selection.contentRef}
              onMouseUp={() => selection.handleTextSelection(isReadOnly, isEditing)}
              className="prose prose-sm prose-slate dark:prose-invert max-w-none flex-1 min-h-0 overflow-y-auto text-sm leading-relaxed nowheel nodrag select-text
                prose-p:text-[13px] prose-li:text-[13px] prose-blockquote:text-[13px]
                prose-headings:my-2 prose-headings:font-semibold
                prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground
                prose-h1:text-[16px] prose-h2:text-[15px] prose-h3:text-[14px] prose-h4:text-[13px]
                prose-code:text-[12px] prose-pre:text-[12px]"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || '_空节点_'}</ReactMarkdown>
            </div>
            {(data.note || '').trim() && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-1.5 border border-border/60 line-clamp-3 shrink-0">
                {data.note}
              </div>
            )}
          </div>
        )}

        {hasImages && (
          <div className="mt-0 shrink-0 nowheel nodrag">
            <div className="flex gap-1 overflow-x-auto">
              {images.map((img) => (
                <div key={img.id} className="relative group/img shrink-0">
                  <button
                    type="button"
                    className="h-10 w-14 overflow-hidden rounded-sm border border-border/65 bg-background transition-colors hover:border-primary/45"
                    onClick={() => setPreviewImage(`data:${img.mimeType};base64,${img.base64}`)}
                    title={img.name || '附件图片'}
                  >
                    <img
                      src={`data:${img.mimeType};base64,${img.base64}`}
                      alt={img.name || '附件图片'}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  {!isReadOnly && isEditing && (
                    <button
                      onClick={() => {
                        const next = images.filter(i => i.id !== img.id)
                        data.onImagesChange?.(next)
                      }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                      title="移除图片"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isEditing && !isReadOnly && (
        <div className="flex items-center justify-end gap-1.5 px-2 py-1.5 bg-secondary/20 border-t">
          <label
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded border border-border/70 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="添加图片"
          >
            <ImagePlus className="w-3 h-3" />
            <span>图片{images.length > 0 ? `(${images.length})` : ''}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
              'text-muted-foreground hover:text-foreground hover:bg-secondary',
              'disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
            )}
            title="保存内容"
          >
            <Save className="w-3 h-3" />
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !content.trim()}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
            )}
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {loading ? '...' : '生成'}
          </button>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-primary/50 !border-2 !border-background"
      />

      {selection.selectionMenu && !selection.showPromptInput && !selection.showContextPanel && createPortal(
        <div
          className="selection-menu fixed z-[10000] bg-background text-foreground rounded-lg shadow-lg border border-border p-1 flex gap-1"
          style={{
            left: selection.selectionMenu.x,
            top: selection.selectionMenu.y,
            transform: 'translateX(-50%)'
          }}
        >
          <button
            onClick={() => selection.handleDirectExpand(data.onExpand)}
            className="px-3 py-1.5 text-xs font-medium rounded hover:bg-accent transition-colors whitespace-nowrap"
          >
            直接展开
          </button>
          <button
            onClick={() => selection.handleCustomPrompt()}
            className="px-3 py-1.5 text-xs font-medium rounded hover:bg-accent transition-colors whitespace-nowrap"
          >
            针对性提问
          </button>
          <button
            onClick={() => selection.handleContextExpand(data.allNodes, showToast)}
            className="px-3 py-1.5 text-xs font-medium rounded hover:bg-accent transition-colors whitespace-nowrap"
          >
            自定义上下文展开
          </button>
        </div>,
        document.body
      )}

      {selection.showPromptInput && selection.selectionMenu && createPortal(
        <div
          className="selection-menu fixed z-[10000] bg-background text-foreground rounded-lg shadow-lg border border-border p-3"
          style={{
            left: selection.selectionMenu.x,
            top: selection.selectionMenu.y,
            transform: 'translateX(-50%)',
            width: '320px'
          }}
        >
          <textarea
            value={selection.customPrompt}
            onChange={(e) => selection.setCustomPrompt(e.target.value)}
            rows={3}
            className="w-full p-2 text-sm rounded border border-border/60 bg-background resize-none outline-none focus:border-primary/40 mb-2"
            placeholder="修改或输入新的问题..."
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => selection.clearSelection()}
              className="px-3 py-1 text-xs font-medium rounded hover:bg-accent transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => selection.handleSubmitCustomPrompt(data.onExpand)}
              disabled={!selection.customPrompt.trim()}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              确认展开
            </button>
          </div>
        </div>,
        document.body
      )}

      {selection.showContextPanel && selection.selectionMenu && data.allNodes && createPortal(
        <ContextPanel
          currentNodeId={data.nodeId}
          allNodes={data.allNodes}
          onConfirm={(selectedNodeIds) => {
            const text = selection.selectionMenu?.text
            const sourceRef = selection.selectionMenu?.sourceRef
            selection.clearSelection()
            if (text) {
              data.onExpand(text, selectedNodeIds, sourceRef, 'custom_context')
            }
          }}
          onClose={() => selection.clearSelection()}
        />,
        document.body
      )}

      {previewImage && (
        <ImageLightbox src={previewImage} onClose={() => setPreviewImage(null)} />
      )}
    </div>
  )
})
