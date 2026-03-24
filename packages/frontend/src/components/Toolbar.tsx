import { useState } from 'react'
import { useGraphStore } from '../stores/graphStore'
import { FileText, Save, FolderOpen, FilePlus, Settings, Eye, GraduationCap } from 'lucide-react'
import { SettingsDialog } from './SettingsDialog'

type CanvasMode = 'learn' | 'view'

interface ToolbarProps {
  onSave: () => void
  onLoad: () => void
  onNew: () => void
  mode: CanvasMode
  onModeChange: (mode: CanvasMode) => void
}

export function Toolbar({ onSave, onLoad, onNew, mode, onModeChange }: ToolbarProps) {
  const { fileName, isDirty, setFileName } = useGraphStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(fileName)
  const [showSettings, setShowSettings] = useState(false)

  const handleFileNameClick = () => {
    setIsEditing(true)
    setEditValue(fileName)
  }

  const handleFileNameBlur = () => {
    setIsEditing(false)
    if (editValue.trim()) {
      setFileName(editValue.trim())
    } else {
      setEditValue(fileName)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFileNameBlur()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(fileName)
    }
  }

  return (
    <div className="h-14 border-b bg-white relative flex items-center justify-between px-4">
      {/* 左侧：文件名和状态 */}
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-gray-500" />
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleFileNameBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <button
            onClick={handleFileNameClick}
            className="px-2 py-1 hover:bg-gray-100 rounded font-medium"
          >
            {fileName}
          </button>
        )}
        {isDirty && (
          <span className="text-gray-400 text-sm">• 未保存</span>
        )}
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center p-1 rounded-lg border border-border bg-slate-50 gap-1">
        <button
          onClick={() => onModeChange('learn')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
            mode === 'learn'
              ? 'bg-white shadow-sm text-foreground border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/60'
          }`}
          title="学习模式：可编辑和生成"
        >
          <GraduationCap className="w-4 h-4" />
          学习模式
        </button>
        <button
          onClick={() => onModeChange('view')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
            mode === 'view'
              ? 'bg-white shadow-sm text-foreground border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/60'
          }`}
          title="查看模式：只读画布，点击节点看详情"
        >
          <Eye className="w-4 h-4" />
          查看模式
        </button>
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded text-sm"
          title="设置"
        >
          <Settings className="w-4 h-4" />
          设置
        </button>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded text-sm"
          title="新建文件"
        >
          <FilePlus className="w-4 h-4" />
          新建
        </button>
        <button
          onClick={onLoad}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded text-sm"
          title="打开文件"
        >
          <FolderOpen className="w-4 h-4" />
          打开
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white hover:bg-blue-600 rounded text-sm"
          title="保存文件"
        >
          <Save className="w-4 h-4" />
          保存
        </button>
      </div>

      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
