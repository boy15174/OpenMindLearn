import { useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { updateLLMConfig } from '../services/api'
import { useToastStore } from '../stores/toastStore'
import { X } from 'lucide-react'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { llmSettings, updateLLMSettings } = useSettingsStore()
  const { showToast } = useToastStore()
  const [apiKey, setApiKey] = useState(llmSettings.apiKey)
  const [baseURL, setBaseURL] = useState(llmSettings.baseURL)
  const [model, setModel] = useState(llmSettings.model)

  if (!open) return null

  const handleSave = async () => {
    try {
      updateLLMSettings({ apiKey, baseURL, model })
      await updateLLMConfig({ apiKey, baseURL, model })
      showToast('配置保存成功！', 'success')
      onClose()
    } catch (error) {
      showToast('配置保存失败', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg w-[480px] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">LLM 配置</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">API 密钥</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="输入 API Key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Base URL</label>
            <input
              type="text"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="https://mg.aid.pub/v1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">模型名称</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Gemini-3.1-Pro"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">
            取消
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
