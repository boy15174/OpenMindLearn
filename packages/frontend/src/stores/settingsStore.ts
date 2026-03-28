import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ExpandMode = 'direct' | 'targeted' | 'custom_context'
export type ThemeMode = 'light' | 'dark'
export type ApiStyle = 'openai_chat' | 'google_gemini'

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
  apiStyle: ApiStyle
  answerAnchorKeywords: string[]
  temperature: number
  maxTokens: number
  contextMaxDepth: number
  systemPrompt: string
  promptTemplates: PromptTemplates
}

interface UISettings {
  theme: ThemeMode
}

interface SettingsStore {
  llmSettings: LLMSettings
  uiSettings: UISettings
  updateLLMSettings: (settings: Partial<LLMSettings>) => void
  updateUISettings: (settings: Partial<UISettings>) => void
  setTheme: (theme: ThemeMode) => void
}

const LEGACY_SYSTEM_PROMPT = '只输出最终答案，不要输出任何思考过程、推理步骤、分析过程或 think 标签。'
const PREVIOUS_SYSTEM_PROMPT = `你是 OpenMindLearn 的学习教练型助手，目标是帮助用户“理解 -> 记住 -> 会用”。

回答原则：
1. 只输出最终答案，不输出任何思考过程、推理步骤、analysis/think 标签。
2. 优先使用用户输入语言；未指定时使用简体中文。
3. 先给结论，再给结构化讲解；解释要准确、可验证、避免空话。
4. 适度延伸但不跑题，和当前问题及上下文保持强关联。
5. 对不确定信息明确标注“可能/待确认”，不要编造。
6. 输出使用 Markdown，信息密度优先。`
const PREVIOUS_THINK_TAG_SYSTEM_PROMPT = `你是 OpenMindLearn 的学习教练型助手，目标是帮助用户“理解 -> 记住 -> 会用”。

回答原则：
1. 你可以进行充分推理；如需输出思考过程，请使用 <think>...</think> 包裹，便于前端折叠展示。
2. 优先使用用户输入语言；未指定时使用简体中文。
3. 先给结论，再给结构化讲解；解释要准确、可验证、避免空话。
4. 适度延伸但不跑题，和当前问题及上下文保持强关联。
5. 对不确定信息明确标注“可能/待确认”，不要编造。
6. 输出使用 Markdown，信息密度优先。`

const LEGACY_PROMPT_TEMPLATES: PromptTemplates = {
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

const PREVIOUS_CONTEXT_ENVELOPE = `你正在为 OpenMindLearn 生成学习节点。以下是从上游到当前父节点的上下文链（XML）：

{{contextXml}}

当前任务：
{{prompt}}

请遵循：
1. 把“最后一个节点”视为当前焦点，优先服务它。
2. 上游节点用于补充背景、术语和因果链，不要平均分配篇幅。
3. 若上下文信息冲突，优先采用更接近焦点且更具体的信息，并在答案中简要说明假设。
4. 输出应可直接保存为学习卡片（Markdown）。
5. 不要复述 XML 标签，不要输出思考过程。`

const DEFAULT_SYSTEM_PROMPT = `你是 OpenMindLearn 的学习教练型助手，目标是帮助用户“理解 -> 记住 -> 会用”。

回答原则：
1. 你可以进行充分推理；若输出思考过程，请与最终答案清晰分段，避免混在同一段正文里。
2. 优先使用用户输入语言；未指定时使用简体中文。
3. 先给结论，再给结构化讲解；解释要准确、可验证、避免空话。
4. 适度延伸但不跑题，和当前问题及上下文保持强关联。
5. 对不确定信息明确标注“可能/待确认”，不要编造。
6. 输出使用 Markdown，信息密度优先。`

export const DEFAULT_ANSWER_ANCHOR_KEYWORDS = ['结论']

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplates = {
  directExpand: `请把下面内容扩展成一张高质量学习卡片，目标是让学习者快速理解并能应用。

原始内容：
{{text}}

输出结构（按需增减，避免凑字）：
## 一句话结论
## 核心概念与机制
## 示例（贴近真实场景）
## 易错点 / 边界条件
## 1 个自测问题（不附答案）

要求：
- 与原文强关联，先解释原文再延伸
- 若原文有歧义，先写明你的理解假设`,
  targetedQuestion: `请针对用户的问题给出高质量学习回答。

用户问题/指令：
{{text}}

输出要求：
1. 先直接回答问题，给出明确结论。
2. 再用要点解释关键依据与原理。
3. 给一个最小可用示例或反例。
4. 给一个“下一步可继续追问”的问题。
5. 若信息不足，先说明缺失信息，再给出在当前假设下的答案。`,
  customContextExpand: `请围绕以下“选中文本片段”做上下文一致的深挖扩展，不要偏题。

选中文本：
{{text}}

输出建议：
## 片段在原主题中的作用
## 逐点拆解（术语 / 概念 / 关系）
## 与上游知识的连接
## 示例或类比
## 可继续探索的 2 个方向

要求：
- 先贴合片段，再做必要扩展
- 不要脱离片段另起话题`,
  contextEnvelope: `你正在为 OpenMindLearn 生成学习节点。以下是从上游到当前父节点的上下文链（XML）：

{{contextXml}}

当前任务：
{{prompt}}

请遵循：
1. 把“最后一个节点”视为当前焦点，优先服务它。
2. 上游节点用于补充背景、术语和因果链，不要平均分配篇幅。
3. 若上下文信息冲突，优先采用更接近焦点且更具体的信息，并在答案中简要说明假设。
4. 输出应可直接保存为学习卡片（Markdown）。
5. 不要复述 XML 标签。`
}

function isLegacyValue(value: string | undefined, legacyValues: string[]): boolean {
  if (!value) return true
  return legacyValues.includes(value)
}

function upgradeLegacyPromptDefaults(settings?: Partial<LLMSettings>): Partial<LLMSettings> {
  if (!settings) return {}

  const upgraded: Partial<LLMSettings> = { ...settings }
  const promptTemplates: Partial<PromptTemplates> = settings.promptTemplates || {}
  const nextTemplates: Partial<PromptTemplates> = { ...promptTemplates }

  if (isLegacyValue(settings.systemPrompt, [LEGACY_SYSTEM_PROMPT, PREVIOUS_SYSTEM_PROMPT, PREVIOUS_THINK_TAG_SYSTEM_PROMPT])) {
    upgraded.systemPrompt = DEFAULT_SYSTEM_PROMPT
  }
  if (!promptTemplates.directExpand || promptTemplates.directExpand === LEGACY_PROMPT_TEMPLATES.directExpand) {
    nextTemplates.directExpand = DEFAULT_PROMPT_TEMPLATES.directExpand
  }
  if (!promptTemplates.targetedQuestion || promptTemplates.targetedQuestion === LEGACY_PROMPT_TEMPLATES.targetedQuestion) {
    nextTemplates.targetedQuestion = DEFAULT_PROMPT_TEMPLATES.targetedQuestion
  }
  if (!promptTemplates.customContextExpand || promptTemplates.customContextExpand === LEGACY_PROMPT_TEMPLATES.customContextExpand) {
    nextTemplates.customContextExpand = DEFAULT_PROMPT_TEMPLATES.customContextExpand
  }
  if (isLegacyValue(promptTemplates.contextEnvelope, [LEGACY_PROMPT_TEMPLATES.contextEnvelope, PREVIOUS_CONTEXT_ENVELOPE])) {
    nextTemplates.contextEnvelope = DEFAULT_PROMPT_TEMPLATES.contextEnvelope
  }

  upgraded.promptTemplates = nextTemplates as PromptTemplates
  return upgraded
}

const DEFAULT_LLM_SETTINGS: LLMSettings = {
  apiKey: '',
  baseURL: 'https://mg.aid.pub/v1',
  model: 'Gemini-3.1-Pro',
  apiStyle: 'openai_chat',
  answerAnchorKeywords: DEFAULT_ANSWER_ANCHOR_KEYWORDS,
  temperature: 0.7,
  maxTokens: 4096,
  contextMaxDepth: 10,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  promptTemplates: DEFAULT_PROMPT_TEMPLATES
}

const DEFAULT_UI_SETTINGS: UISettings = {
  theme: 'light'
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      llmSettings: DEFAULT_LLM_SETTINGS,
      uiSettings: DEFAULT_UI_SETTINGS,
      updateLLMSettings: (settings) => set((state) => ({
        llmSettings: {
          ...state.llmSettings,
          ...settings,
          promptTemplates: {
            ...state.llmSettings.promptTemplates,
            ...(settings.promptTemplates || {})
          }
        }
      })),
      updateUISettings: (settings) => set((state) => ({
        uiSettings: {
          ...state.uiSettings,
          ...settings
        }
      })),
      setTheme: (theme) => set((state) => ({
        uiSettings: {
          ...state.uiSettings,
          theme
        }
      }))
    }),
    {
      name: 'oml-settings',
      merge: (persisted, current) => {
        const persistedState = (persisted || {}) as Partial<SettingsStore>
        const upgradedPersistedLLM = upgradeLegacyPromptDefaults(persistedState.llmSettings)
        return {
          ...current,
          ...persistedState,
          llmSettings: {
            ...DEFAULT_LLM_SETTINGS,
            ...current.llmSettings,
            ...upgradedPersistedLLM,
            promptTemplates: {
              ...DEFAULT_PROMPT_TEMPLATES,
              ...current.llmSettings.promptTemplates,
              ...(upgradedPersistedLLM.promptTemplates || {})
            }
          },
          uiSettings: {
            ...DEFAULT_UI_SETTINGS,
            ...current.uiSettings,
            ...(persistedState.uiSettings || {})
          }
        } as SettingsStore
      }
    }
  )
)
