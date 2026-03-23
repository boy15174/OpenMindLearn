import { useState } from 'react'
import { useGraphStore } from '../stores/graphStore'
import { FileText, Save, FolderOpen, FilePlus } from 'lucide-react'

interface ToolbarProps {
  onSave: () => void
  onLoad: () => void
  onNew: () => void
}

export function Toolbar({ onSave, onLoad, onNew }: ToolbarProps) {
  const { fileName, isDirty, setFileName } = useGraphStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(fileName)

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
    <div className="h-14 border-b bg-white flex items-center justify-between px-4">
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

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-2">
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
    </div>
  )
}
