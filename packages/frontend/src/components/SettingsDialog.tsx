import { useEffect, useState } from 'react'
import { DEFAULT_PROMPT_TEMPLATES, type ThemeMode, useSettingsStore } from '../stores/settingsStore'
import { updateLLMConfig } from '../services/api'
import { useToastStore } from '../stores/toastStore'
import { Moon, Sun, X } from 'lucide-react'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { llmSettings, uiSettings, updateLLMSettings, setTheme } = useSettingsStore()
  const { showToast } = useToastStore()
  const [activeTab, setActiveTab] = useState<'llm' | 'prompt' | 'appearance'>('llm')
  const [apiKey, setApiKey] = useState(llmSettings.apiKey)
  const [baseURL, setBaseURL] = useState(llmSettings.baseURL)
  const [model, setModel] = useState(llmSettings.model)
  const [temperature, setTemperature] = useState(String(llmSettings.temperature))
  const [maxTokens, setMaxTokens] = useState(String(llmSettings.maxTokens))
  const [contextMaxDepth, setContextMaxDepth] = useState(String(llmSettings.contextMaxDepth))
  const [systemPrompt, setSystemPrompt] = useState(llmSettings.systemPrompt)
  const [directExpandPrompt, setDirectExpandPrompt] = useState(llmSettings.promptTemplates.directExpand)
  const [targetedPrompt, setTargetedPrompt] = useState(llmSettings.promptTemplates.targetedQuestion)
  const [customContextPrompt, setCustomContextPrompt] = useState(llmSettings.promptTemplates.customContextExpand)
  const [contextEnvelopePrompt, setContextEnvelopePrompt] = useState(llmSettings.promptTemplates.contextEnvelope)
  const [themeMode, setThemeMode] = useState<ThemeMode>(uiSettings.theme)

  useEffect(() => {
    if (!open) return
    setActiveTab('llm')
    setApiKey(llmSettings.apiKey)
    setBaseURL(llmSettings.baseURL)
    setModel(llmSettings.model)
    setTemperature(String(llmSettings.temperature))
    setMaxTokens(String(llmSettings.maxTokens))
    setContextMaxDepth(String(llmSettings.contextMaxDepth))
    setSystemPrompt(llmSettings.systemPrompt)
    setDirectExpandPrompt(llmSettings.promptTemplates.directExpand)
    setTargetedPrompt(llmSettings.promptTemplates.targetedQuestion)
    setCustomContextPrompt(llmSettings.promptTemplates.customContextExpand)
    setContextEnvelopePrompt(llmSettings.promptTemplates.contextEnvelope)
    setThemeMode(uiSettings.theme)
  }, [llmSettings, open, uiSettings.theme])

  if (!open) return null

  const parseNumber = (
    value: string,
    fallback: number,
    min: number,
    max: number,
    integer: boolean = false
  ): number => {
    const parsed = integer ? parseInt(value, 10) : Number(value)
    if (!Number.isFinite(parsed)) return fallback
    const normalized = Math.max(min, Math.min(max, parsed))
    return integer ? Math.round(normalized) : normalized
  }

  const handleSave = async () => {
    const nextTemperature = parseNumber(temperature, llmSettings.temperature, 0, 2)
    const nextMaxTokens = parseNumber(maxTokens, llmSettings.maxTokens, 1, 32000, true)
    const nextContextMaxDepth = parseNumber(contextMaxDepth, llmSettings.contextMaxDepth, 1, 50, true)
    const nextSystemPrompt = systemPrompt.trim() || llmSettings.systemPrompt

    const nextPromptTemplates = {
      directExpand: directExpandPrompt.trim() || DEFAULT_PROMPT_TEMPLATES.directExpand,
      targetedQuestion: targetedPrompt.trim() || DEFAULT_PROMPT_TEMPLATES.targetedQuestion,
      customContextExpand: customContextPrompt.trim() || DEFAULT_PROMPT_TEMPLATES.customContextExpand,
      contextEnvelope: contextEnvelopePrompt.trim() || DEFAULT_PROMPT_TEMPLATES.contextEnvelope
    }

    updateLLMSettings({
      apiKey,
      baseURL,
      model,
      temperature: nextTemperature,
      maxTokens: nextMaxTokens,
      contextMaxDepth: nextContextMaxDepth,
      systemPrompt: nextSystemPrompt,
      promptTemplates: nextPromptTemplates
    })
    setTheme(themeMode)

    try {
      await updateLLMConfig({
        apiKey,
        baseURL,
        model,
        temperature: nextTemperature,
        maxTokens: nextMaxTokens,
        contextMaxDepth: nextContextMaxDepth,
        systemPrompt: nextSystemPrompt,
        promptTemplates: nextPromptTemplates
      })
      showToast('配置保存成功！', 'success')
    } catch (error) {
      showToast('本地配置已保存，远端同步失败', 'error')
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background text-foreground rounded-lg border border-border shadow-lg w-[760px] max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">设置</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 inline-flex rounded-lg border border-border bg-muted/30 p-1">
          <button
            onClick={() => setActiveTab('llm')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'llm' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            LLM 配置
          </button>
          <button
            onClick={() => setActiveTab('prompt')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'prompt' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Prompt 配置
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'appearance' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            外观
          </button>
        </div>

        <div className="space-y-5">
          {activeTab === 'llm' && (
            <>
              <div className="rounded border border-border p-3 space-y-3">
                <div className="text-sm font-medium">基础配置</div>
                <div>
                  <label className="block text-sm font-medium mb-1">API 密钥</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="输入 API Key"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Base URL</label>
                  <input
                    type="text"
                    value={baseURL}
                    onChange={(e) => setBaseURL(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="https://mg.aid.pub/v1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">模型名称</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Gemini-3.1-Pro"
                  />
                </div>
              </div>

              <div className="rounded border border-border p-3 space-y-3">
                <div className="text-sm font-medium">高级参数</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Temperature</label>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Max Tokens</label>
                    <input
                      type="number"
                      min={1}
                      max={32000}
                      step={1}
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'prompt' && (
            <>
              <div className="rounded border border-border p-3 space-y-2">
                <div className="text-sm font-medium">项目配置</div>
                <div>
                  <label className="block text-sm font-medium mb-1">上下文回溯深度</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={contextMaxDepth}
                    onChange={(e) => setContextMaxDepth(e.target.value)}
                    className="w-[220px] px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  用于自动回溯父节点链的最大层级，属于 OpenMindLearn 的上下文策略，不是 LLM 原生调用参数。
                </p>
              </div>

              <div className="rounded border border-border p-3 space-y-3">
                <div className="text-sm font-medium">Prompt 自定义</div>
                <div>
                  <label className="block text-sm font-medium mb-1">System Prompt</label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                    placeholder="系统提示词"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">直接展开模板（变量：{`{{text}}`}）</label>
                  <textarea
                    value={directExpandPrompt}
                    onChange={(e) => setDirectExpandPrompt(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">针对性提问模板（变量：{`{{text}}`}）</label>
                  <textarea
                    value={targetedPrompt}
                    onChange={(e) => setTargetedPrompt(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">自定义上下文展开模板（变量：{`{{text}}`}）</label>
                  <textarea
                    value={customContextPrompt}
                    onChange={(e) => setCustomContextPrompt(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    上下文包装模板（变量：{`{{contextXml}}`}、{`{{prompt}}`}）
                  </label>
                  <textarea
                    value={contextEnvelopePrompt}
                    onChange={(e) => setContextEnvelopePrompt(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y font-mono text-xs"
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'appearance' && (
            <div className="rounded border border-border p-3 space-y-3">
              <div className="text-sm font-medium">主题色</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setThemeMode('light')}
                  className={`px-3 py-3 rounded border text-sm text-left transition-colors ${
                    themeMode === 'light'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:bg-accent text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4" />
                    浅色模式
                  </div>
                </button>
                <button
                  onClick={() => setThemeMode('dark')}
                  className={`px-3 py-3 rounded border text-sm text-left transition-colors ${
                    themeMode === 'dark'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:bg-accent text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4" />
                    黑暗模式
                  </div>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">主题设置保存在本地，切换后下次打开会自动恢复。</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded hover:bg-accent">
            取消
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
