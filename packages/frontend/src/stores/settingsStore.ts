import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ExpandMode = 'direct' | 'targeted' | 'custom_context'

export interface PromptTemplates {
  directExpand: string
  targetedQuestion: string
  customContextExpand: string
  contextEnvelope: string
}

interface LLMSettings {
  apiKey: string
  baseURL: string
  model: string
  temperature: number
  maxTokens: number
  contextMaxDepth: number
  systemPrompt: string
  promptTemplates: PromptTemplates
}

interface SettingsStore {
  llmSettings: LLMSettings
  updateLLMSettings: (settings: Partial<LLMSettings>) => void
}

const DEFAULT_SYSTEM_PROMPT = '只输出最终答案，不要输出任何思考过程、推理步骤、分析过程或 think 标签。'

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplates = {
  directExpand: '请详细解释并展开以下内容：\n\n{{text}}',
  targetedQuestion: '请围绕以下问题进行针对性回答，并给出清晰结构：\n\n{{text}}',
  customContextExpand: '请基于选中文本继续展开，保持与原文强关联：\n\n{{text}}',
  contextEnvelope: `你是一个知识图谱助手。以下是节点链（从根节点到当前父节点），最后一个节点是用户当前正在查看的内容：

{{contextXml}}

用户想要基于最后一个节点的内容进一步探索：
{{prompt}}

要求：
1. 重点关注最后一个节点，它是当前焦点
2. 回答应对当前焦点做延伸和深化
3. 前文节点仅作为背景脉络
4. 保持与当前焦点紧密关联
5. 用 Markdown 格式回答`
}

const DEFAULT_LLM_SETTINGS: LLMSettings = {
  apiKey: '',
  baseURL: 'https://mg.aid.pub/v1',
  model: 'Gemini-3.1-Pro',
  temperature: 0.7,
  maxTokens: 4096,
  contextMaxDepth: 10,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  promptTemplates: DEFAULT_PROMPT_TEMPLATES
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      llmSettings: DEFAULT_LLM_SETTINGS,
      updateLLMSettings: (settings) => set((state) => ({
        llmSettings: {
          ...state.llmSettings,
          ...settings,
          promptTemplates: {
            ...state.llmSettings.promptTemplates,
            ...(settings.promptTemplates || {})
          }
        }
      }))
    }),
    {
      name: 'oml-settings',
      merge: (persisted, current) => {
        const persistedState = (persisted || {}) as Partial<SettingsStore>
        return {
          ...current,
          ...persistedState,
          llmSettings: {
            ...DEFAULT_LLM_SETTINGS,
            ...current.llmSettings,
            ...(persistedState.llmSettings || {}),
            promptTemplates: {
              ...DEFAULT_PROMPT_TEMPLATES,
              ...current.llmSettings.promptTemplates,
              ...(persistedState.llmSettings?.promptTemplates || {})
            }
          }
        } as SettingsStore
      }
    }
  )
)
