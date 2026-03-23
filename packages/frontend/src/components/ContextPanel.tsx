import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { Node } from '../types'

interface ContextPanelProps {
  currentNodeId: string
  allNodes: Node[]
  onConfirm: (selectedNodeIds: string[]) => void
  onClose: () => void
}

export function ContextPanel({ currentNodeId, allNodes, onConfirm, onClose }: ContextPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [ancestorNodes, setAncestorNodes] = useState<Node[]>([])

  useEffect(() => {
    // 构建祖先节点列表
    const ancestors: Node[] = []
    const nodeMap = new Map(allNodes.map(n => [n.id, n]))
    const visited = new Set<string>()

    const collectAncestors = (nodeId: string) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      const node = nodeMap.get(nodeId)
      if (!node) return

      ancestors.unshift(node)

      if (node.parentIds && node.parentIds.length > 0) {
        collectAncestors(node.parentIds[0])
      }
    }

    collectAncestors(currentNodeId)

    setAncestorNodes(ancestors)
    // 默认全部选中
    setSelectedIds(new Set(ancestors.map(n => n.id)))
  }, [currentNodeId, allNodes])

  const toggleNode = (nodeId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds))
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">选择上下文节点</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 节点列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {ancestorNodes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">没有找到祖先节点</p>
          ) : (
            <div className="space-y-2">
              {ancestorNodes.map((node, index) => {
                const isSelected = selectedIds.has(node.id)
                const summary = node.content.slice(0, 100) + (node.content.length > 100 ? '...' : '')

                return (
                  <div
                    key={node.id}
                    onClick={() => toggleNode(node.id)}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500">节点 {index + 1}</span>
                          <span className="text-xs text-gray-400">{node.id.slice(0, 8)}</span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">{summary}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <p className="text-sm text-gray-600">
            已选择 {selectedIds.size} / {ancestorNodes.length} 个节点
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded"
            >
              取消
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleConfirm()
              }}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
