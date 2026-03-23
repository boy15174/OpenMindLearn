import { memo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position } from '@xyflow/react'
import ReactMarkdown from 'react-markdown'
import { Sparkles, Loader2, Save } from 'lucide-react'
import { cn } from '../utils/cn'
import { ContextPanel } from './ContextPanel'
import type { Node } from '../types'

interface NodeCardProps {
  data: {
    content: string
    isEditing?: boolean
    nodeId: string
    onGenerate: (content: string) => void
    onExpand: (text: string, selectedNodeIds?: string[]) => void
    allNodes?: Node[]
  }
}

export const NodeCard = memo(({ data }: NodeCardProps) => {
  const [isEditing, setIsEditing] = useState(data.isEditing || false)
  const [content, setContent] = useState(data.content)
  const [loading, setLoading] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(!!data.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number; text: string } | null>(null)
  const [showPromptInput, setShowPromptInput] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const [showContextPanel, setShowContextPanel] = useState(false)

  useEffect(() => {
    if (data.content && data.content !== content) {
      setContent(data.content)
      setHasGenerated(true)
      setIsEditing(false)
    }
  }, [data.content])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  // Handle text selection in preview mode
  const handleTextSelection = () => {
    if (isEditing) return

    const selection = window.getSelection()
    const selectedText = selection?.toString().trim()

    console.log('Text selected:', selectedText)

    if (selectedText && selectedText.length > 0) {
      const range = selection?.getRangeAt(0)
      const rect = range?.getBoundingClientRect()

      console.log('Selection rect:', rect)

      if (rect) {
        setSelectionMenu({
          x: rect.left + rect.width / 2,
          y: rect.bottom + 8,
          text: selectedText
        })
      }
    }
  }

  // Close selection menu on click outside
  useEffect(() => {
    if (!selectionMenu) return

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
  }, [selectionMenu])

  const handleGenerate = async () => {
    if (!content.trim()) return
    setLoading(true)
    try {
      await data.onGenerate(content)
      setHasGenerated(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    setIsEditing(false)
    setHasGenerated(true)
  }

  const handleDirectExpand = async () => {
    if (!selectionMenu) return
    setSelectionMenu(null)
    window.getSelection()?.removeAllRanges()
    await data.onExpand(selectionMenu.text)
  }

  const handleCustomPrompt = () => {
    if (!selectionMenu) return
    setCustomPrompt(selectionMenu.text)
    setShowPromptInput(true)
  }

  const handleContextExpand = () => {
    if (!selectionMenu) return
    if (!data.allNodes || data.allNodes.length === 0) {
      alert('无法获取节点上下文，请重试')
      return
    }
    setShowContextPanel(true)
  }

  const handleSubmitCustomPrompt = async () => {
    if (!customPrompt.trim()) return
    setSelectionMenu(null)
    setShowPromptInput(false)
    window.getSelection()?.removeAllRanges()
    await data.onExpand(customPrompt)
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
            if (selectionMenu) {
              data.onExpand(selectionMenu.text, selectedNodeIds)
            }
            setShowContextPanel(false)
            setSelectionMenu(null)
            window.getSelection()?.removeAllRanges()
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
