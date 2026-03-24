import { memo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position } from '@xyflow/react'
import ReactMarkdown from 'react-markdown'
import { Sparkles, Loader2, Save } from 'lucide-react'
import { cn } from '../utils/cn'
import { ContextPanel } from './ContextPanel'
import { useToastStore } from '../stores/toastStore'
import type { Node, SourceReference } from '../types'
import { fingerprintBase64 } from '../utils/textMeta'

interface SourceHighlight extends SourceReference {
  color: string
}

interface SelectionMenuState {
  x: number
  y: number
  text: string
  sourceRef: SourceReference
}

function getSelectionOffsets(container: HTMLElement, range: Range): { start: number; end: number } {
  const preRange = range.cloneRange()
  preRange.selectNodeContents(container)
  preRange.setEnd(range.startContainer, range.startOffset)
  const start = preRange.toString().length
  const end = start + range.toString().length
  return { start, end }
}

function getContainerPlainText(container: HTMLElement): string {
  const range = document.createRange()
  range.selectNodeContents(container)
  return range.toString()
}

function clearSourceHighlightMarks(container: HTMLElement) {
  const marks = container.querySelectorAll('mark[data-source-highlight="true"]')
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark)
    }
    parent.removeChild(mark)
    parent.normalize()
  })
}

function applySourceHighlightByRanges(container: HTMLElement, highlights: SourceHighlight[]) {
  if (highlights.length === 0) return

  const sortedHighlights = [...highlights].sort((a, b) => a.rangeStart - b.rangeStart)
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text
    if (!textNode.nodeValue) continue
    if (textNode.parentElement?.closest('mark[data-source-highlight="true"]')) continue
    textNodes.push(textNode)
  }

  let nodeStartOffset = 0
  textNodes.forEach((textNode) => {
    const originalText = textNode.nodeValue || ''
    const nodeEndOffset = nodeStartOffset + originalText.length
    const active = sortedHighlights.filter(
      h => h.rangeStart < nodeEndOffset && h.rangeEnd > nodeStartOffset
    )

    if (active.length === 0) {
      nodeStartOffset = nodeEndOffset
      return
    }

    const fragment = document.createDocumentFragment()
    let cursor = 0

    active.forEach((highlight) => {
      const localStart = Math.max(0, highlight.rangeStart - nodeStartOffset)
      const localEnd = Math.min(originalText.length, highlight.rangeEnd - nodeStartOffset)
      if (localEnd <= localStart) return
      if (localStart > cursor) {
        fragment.appendChild(document.createTextNode(originalText.slice(cursor, localStart)))
      }

      const mark = document.createElement('mark')
      mark.setAttribute('data-source-highlight', 'true')
      mark.style.backgroundColor = `${highlight.color}33`
      mark.style.color = 'inherit'
      mark.style.padding = '0 1px'
      mark.style.borderRadius = '2px'
      mark.textContent = originalText.slice(localStart, localEnd)
      fragment.appendChild(mark)
      cursor = Math.max(cursor, localEnd)
    })

    if (cursor < originalText.length) {
      fragment.appendChild(document.createTextNode(originalText.slice(cursor)))
    }

    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode)
    }

    nodeStartOffset = nodeEndOffset
  })
}

interface NodeCardProps {
  data: {
    content: string
    isEditing?: boolean
    nodeId: string
    onGenerate: (content: string) => void
    onExpand: (text: string, selectedNodeIds?: string[], sourceRef?: SourceReference) => void
    allNodes?: Node[]
    expansionColor?: string
    sourceHighlights?: SourceHighlight[]
  }
}

export const NodeCard = memo(({ data }: NodeCardProps) => {
  const [isEditing, setIsEditing] = useState(data.isEditing || false)
  const [content, setContent] = useState(data.content)
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null)
  const [showPromptInput, setShowPromptInput] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const [showContextPanel, setShowContextPanel] = useState(false)
  const { showToast } = useToastStore()

  useEffect(() => {
    if (data.content && data.content !== content) {
      setContent(data.content)
      setIsEditing(false)
    }
  }, [data.content])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  useEffect(() => {
    const container = contentRef.current
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

  // Handle text selection in preview mode
  const handleTextSelection = () => {
    if (isEditing || !contentRef.current) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (!contentRef.current.contains(range.commonAncestorContainer)) return

    const rawSelectedText = selection.toString()
    if (!rawSelectedText.trim()) return

    const leadingWhitespace = (rawSelectedText.match(/^\s*/) || [''])[0].length
    const trailingWhitespace = (rawSelectedText.match(/\s*$/) || [''])[0].length
    const { start, end } = getSelectionOffsets(contentRef.current, range)
    const normalizedStart = start + leadingWhitespace
    const normalizedEnd = Math.max(normalizedStart, end - trailingWhitespace)
    const plainText = getContainerPlainText(contentRef.current)
    const selectedText = plainText.slice(normalizedStart, normalizedEnd)
    if (!selectedText) return

    const rect = range.getBoundingClientRect()
    if (!rect) return

    const sourceRef: SourceReference = {
      upstreamFingerprintBase64: fingerprintBase64(plainText),
      rangeStart: normalizedStart,
      rangeEnd: normalizedEnd
    }

    setSelectionMenu({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
      text: selectedText,
      sourceRef
    })
  }

  // Close selection menu on click outside
  useEffect(() => {
    // ContextPanel 打开后由其自身处理关闭逻辑，避免全局捕获提前卸载面板
    if (!selectionMenu || showContextPanel) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element
      // Close if clicking outside the selection menu
      if (!target.closest('.selection-menu')) {
        setSelectionMenu(null)
        setShowPromptInput(false)
        setCustomPrompt('')
        window.getSelection()?.removeAllRanges()
      }
    }

    // Use capture phase to ensure we catch the event before other handlers
    document.addEventListener('mousedown', handleClickOutside, true)
    return () => document.removeEventListener('mousedown', handleClickOutside, true)
  }, [selectionMenu, showContextPanel])

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
    setIsEditing(false)
  }

  const handleDirectExpand = async () => {
    if (!selectionMenu) return
    setSelectionMenu(null)
    window.getSelection()?.removeAllRanges()
    await data.onExpand(selectionMenu.text, undefined, selectionMenu.sourceRef)
  }

  const handleCustomPrompt = () => {
    if (!selectionMenu) return
    setCustomPrompt(selectionMenu.text)
    setShowPromptInput(true)
  }

  const handleContextExpand = () => {
    if (!selectionMenu) return
    if (!data.allNodes || data.allNodes.length === 0) {
      showToast('无法获取节点上下文，请重试', 'error')
      return
    }
    setShowContextPanel(true)
  }

  const handleSubmitCustomPrompt = async () => {
    if (!customPrompt.trim()) return
    setSelectionMenu(null)
    setShowPromptInput(false)
    window.getSelection()?.removeAllRanges()
    await data.onExpand(customPrompt, undefined, selectionMenu?.sourceRef)
    setCustomPrompt('')
  }

  // Expose edit trigger via data
  useEffect(() => {
    (data as any)._setIsEditing = (v: boolean) => setIsEditing(v)
  })

  return (
    <div
      className={cn(
        'rounded-lg border bg-white shadow-sm transition-all',
        'w-[380px] relative group',
        isEditing && 'ring-1 ring-primary/40 shadow-md'
      )}
      style={{
        borderColor: data.expansionColor || undefined,
        borderWidth: data.expansionColor ? '2px' : undefined
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-primary/50 !border-2 !border-white"
      />

      {/* Content Area */}
      <div className="p-3">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className={cn(
              'w-full p-2 text-sm rounded border border-border/60 bg-background',
              'resize-none outline-none focus:border-primary/40',
              'placeholder:text-muted-foreground/50 nowheel nodrag'
            )}
            placeholder="输入内容或问题..."
          />
        ) : (
          <div
            ref={contentRef}
            onMouseUp={handleTextSelection}
            className="prose prose-sm prose-slate max-h-[220px] overflow-y-auto text-sm leading-relaxed nowheel nodrag select-text"
          >
            <ReactMarkdown>{content || '_空节点_'}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Action Bar - only show when editing */}
      {isEditing && (
        <div className="flex items-center justify-end gap-1.5 px-2 py-1.5 bg-secondary/20 border-t">
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
        className="!w-2 !h-2 !bg-primary/50 !border-2 !border-white"
      />

      {/* Selection Menu - rendered via Portal */}
      {selectionMenu && !showPromptInput && !showContextPanel && createPortal(
        <div
          className="selection-menu fixed z-[10000] bg-white rounded-lg shadow-lg border border-border p-1 flex gap-1"
          style={{
            left: selectionMenu.x,
            top: selectionMenu.y,
            transform: 'translateX(-50%)'
          }}
        >
          <button
            onClick={handleDirectExpand}
            className="px-3 py-1.5 text-xs font-medium rounded hover:bg-accent transition-colors whitespace-nowrap"
          >
            直接展开
          </button>
          <button
            onClick={handleCustomPrompt}
            className="px-3 py-1.5 text-xs font-medium rounded hover:bg-accent transition-colors whitespace-nowrap"
          >
            针对性提问
          </button>
          <button
            onClick={handleContextExpand}
            className="px-3 py-1.5 text-xs font-medium rounded hover:bg-accent transition-colors whitespace-nowrap"
          >
            自定义上下文展开
          </button>
        </div>,
        document.body
      )}

      {/* Custom Prompt Input - rendered via Portal */}
      {showPromptInput && selectionMenu && createPortal(
        <div
          className="selection-menu fixed z-[10000] bg-white rounded-lg shadow-lg border border-border p-3"
          style={{
            left: selectionMenu.x,
            top: selectionMenu.y,
            transform: 'translateX(-50%)',
            width: '320px'
          }}
        >
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
            className="w-full p-2 text-sm rounded border border-border/60 bg-background resize-none outline-none focus:border-primary/40 mb-2"
            placeholder="修改或输入新的问题..."
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowPromptInput(false)
                setSelectionMenu(null)
                window.getSelection()?.removeAllRanges()
              }}
              className="px-3 py-1 text-xs font-medium rounded hover:bg-accent transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmitCustomPrompt}
              disabled={!customPrompt.trim()}
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

      {/* Context Panel - rendered via Portal */}
      {showContextPanel && selectionMenu && data.allNodes && createPortal(
        <ContextPanel
          currentNodeId={data.nodeId}
          allNodes={data.allNodes}
          onConfirm={(selectedNodeIds) => {
            const text = selectionMenu?.text
            const sourceRef = selectionMenu?.sourceRef
            setShowContextPanel(false)
            setSelectionMenu(null)
            window.getSelection()?.removeAllRanges()
            if (text) {
              data.onExpand(text, selectedNodeIds, sourceRef)
            }
          }}
          onClose={() => {
            setShowContextPanel(false)
            setSelectionMenu(null)
            window.getSelection()?.removeAllRanges()
          }}
        />,
        document.body
      )}
    </div>
  )
})
