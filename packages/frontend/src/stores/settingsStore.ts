import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getBrowserLanguage, resolveLocaleMode } from '../i18n'
import type { LocaleCode, LocaleMode } from '../i18n/types'

export type ExpandMode = 'direct' | 'targeted' | 'custom_context'
export type ThemeMode = 'light' | 'dark'
export type ApiStyle = 'openai_chat' | 'google_gemini'

export interface PromptTemplates {
  directExpand: string
  targetedQuestion: string
  customContextExpand: string
  contextEnvelope: string
}

export interface LocalizedPromptConfig {
  systemPrompt: string
  promptTemplates: PromptTemplates
  answerAnchorKeywords: string[]
}

export const DEFAULT_ANSWER_ANCHOR_KEYWORDS_ZH = ['结论']
export const DEFAULT_ANSWER_ANCHOR_KEYWORDS_EN = ['Conclusion', 'Final Answer']
export const DEFAULT_ANSWER_ANCHOR_KEYWORDS = DEFAULT_ANSWER_ANCHOR_KEYWORDS_ZH

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

const DEFAULT_SYSTEM_PROMPT_ZH = `你是 OpenMindLearn 的学习教练型助手，目标是帮助用户“理解 -> 记住 -> 会用”。

回答原则：
1. 你可以进行充分推理；若输出思考过程，请与最终答案清晰分段，避免混在同一段正文里。
2. 优先使用用户输入语言；未指定时使用简体中文。
3. 先给结论，再给结构化讲解；解释要准确、可验证、避免空话。
4. 适度延伸但不跑题，和当前问题及上下文保持强关联。
5. 对不确定信息明确标注“可能/待确认”，不要编造。
6. 输出使用 Markdown，信息密度优先。`

const DEFAULT_SYSTEM_PROMPT_EN = `You are OpenMindLearn's learning coach. Your goal is to help the learner "understand -> retain -> apply".

Answer principles:
1. You may reason deeply; if thinking is shown, keep it clearly separated from final answer text.
2. Prefer the user's language. If unspecified, use English.
3. Give the conclusion first, then structured explanation.
4. Extend appropriately without drifting off-topic.
5. Mark uncertainty explicitly instead of fabricating facts.
6. Output in Markdown with high information density.`

const DEFAULT_PROMPT_TEMPLATES_ZH: PromptTemplates = {
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

const DEFAULT_PROMPT_TEMPLATES_EN: PromptTemplates = {
  directExpand: `Expand the text below into a high-quality study card for quick understanding and practical use.

Source text:
{{text}}

Suggested structure (adjust as needed):
## One-line Conclusion
## Core Concepts and Mechanism
## Practical Example
## Common Pitfalls / Boundaries
## One Self-check Question (no answer)

Requirements:
- Stay strongly aligned with source text
- If ambiguity exists, state your assumptions first`,
  targetedQuestion: `Provide a high-quality learning-focused answer to the user's question.

User question/instruction:
{{text}}

Output requirements:
1. Answer directly with a clear conclusion first.
2. Explain key rationale and principles.
3. Provide one minimal practical example or counterexample.
4. Provide one follow-up question for deeper learning.
5. If information is insufficient, state missing parts and answer under current assumptions.`,
  customContextExpand: `Deepen the selected text while staying context-consistent. Do not drift off-topic.

Selected text:
{{text}}

Suggested output:
## Role in the original topic
## Point-by-point breakdown (terms / concepts / relationships)
## Links to upstream knowledge
## Example or analogy
## Two next exploration directions

Requirements:
- Stay close to selected text before extending
- Do not switch to unrelated topics`,
  contextEnvelope: `You are generating a study node for OpenMindLearn. Below is the upstream-to-parent context chain (XML):

{{contextXml}}

Current task:
{{prompt}}

Please follow:
1. Treat the last node as the current focus.
2. Use upstream nodes as background and terminology support.
3. If conflict exists, prefer more specific information closer to focus and state assumptions briefly.
4. Output should be directly usable as a Markdown learning card.
5. Do not repeat XML tags.`
}

export const DEFAULT_SYSTEM_PROMPT_BY_LOCALE: Record<LocaleCode, string> = {
  'zh-CN': DEFAULT_SYSTEM_PROMPT_ZH,
  'en-US': DEFAULT_SYSTEM_PROMPT_EN
}

export const DEFAULT_PROMPT_TEMPLATES_BY_LOCALE: Record<LocaleCode, PromptTemplates> = {
  'zh-CN': DEFAULT_PROMPT_TEMPLATES_ZH,
  'en-US': DEFAULT_PROMPT_TEMPLATES_EN
}

export const DEFAULT_ANSWER_ANCHOR_KEYWORDS_BY_LOCALE: Record<LocaleCode, string[]> = {
  'zh-CN': DEFAULT_ANSWER_ANCHOR_KEYWORDS_ZH,
  'en-US': DEFAULT_ANSWER_ANCHOR_KEYWORDS_EN
}

export interface LLMSettings {
  apiKey: string
  baseURL: string
  model: string
  apiStyle: ApiStyle
  promptLocale: LocaleCode
  localizedPrompts: Record<LocaleCode, LocalizedPromptConfig>
  answerAnchorKeywords: string[]
  temperature: number
  maxTokens: number
  contextMaxDepth: number
  systemPrompt: string
  promptTemplates: PromptTemplates
}

interface UISettings {
  theme: ThemeMode
  localeMode: LocaleMode
  localeResolved: LocaleCode
}

interface SettingsStore {
  llmSettings: LLMSettings
  uiSettings: UISettings
  updateLLMSettings: (settings: Partial<LLMSettings>) => void
  updateUISettings: (settings: Partial<UISettings>) => void
  setTheme: (theme: ThemeMode) => void
  setLocaleMode: (mode: LocaleMode) => void
  syncLocaleFromNavigator: () => void
}

function resolvePromptLocale(value: unknown): LocaleCode {
  return value === 'en-US' ? 'en-US' : 'zh-CN'
}

function clonePromptTemplates(templates: PromptTemplates): PromptTemplates {
  return {
    directExpand: templates.directExpand,
    targetedQuestion: templates.targetedQuestion,
    customContextExpand: templates.customContextExpand,
    contextEnvelope: templates.contextEnvelope
  }
}

function normalizeAnswerAnchorKeywords(input: unknown, fallback: string[]): string[] {
  const raw: string[] = []
  if (Array.isArray(input)) {
    input.forEach((item) => {
      if (typeof item === 'string') raw.push(item)
    })
  } else if (typeof input === 'string') {
    raw.push(...input.split(/[\r\n,，]+/))
  }

  const normalized = Array.from(new Set(raw.map((item) => item.trim()).filter(Boolean)))
  return normalized.length > 0 ? normalized : [...fallback]
}

function getDefaultPromptConfig(locale: LocaleCode): LocalizedPromptConfig {
  return {
    systemPrompt: DEFAULT_SYSTEM_PROMPT_BY_LOCALE[locale],
    promptTemplates: clonePromptTemplates(DEFAULT_PROMPT_TEMPLATES_BY_LOCALE[locale]),
    answerAnchorKeywords: [...DEFAULT_ANSWER_ANCHOR_KEYWORDS_BY_LOCALE[locale]]
  }
}

function normalizeLocalizedPrompt(locale: LocaleCode, source?: Partial<LocalizedPromptConfig>): LocalizedPromptConfig {
  const fallback = getDefaultPromptConfig(locale)
  return {
    systemPrompt: (source?.systemPrompt || '').trim() || fallback.systemPrompt,
    promptTemplates: {
      ...fallback.promptTemplates,
      ...(source?.promptTemplates || {})
    },
    answerAnchorKeywords: normalizeAnswerAnchorKeywords(source?.answerAnchorKeywords, fallback.answerAnchorKeywords)
  }
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
    upgraded.systemPrompt = DEFAULT_SYSTEM_PROMPT_ZH
  }
  if (!promptTemplates.directExpand || promptTemplates.directExpand === LEGACY_PROMPT_TEMPLATES.directExpand) {
    nextTemplates.directExpand = DEFAULT_PROMPT_TEMPLATES_ZH.directExpand
  }
  if (!promptTemplates.targetedQuestion || promptTemplates.targetedQuestion === LEGACY_PROMPT_TEMPLATES.targetedQuestion) {
    nextTemplates.targetedQuestion = DEFAULT_PROMPT_TEMPLATES_ZH.targetedQuestion
  }
  if (!promptTemplates.customContextExpand || promptTemplates.customContextExpand === LEGACY_PROMPT_TEMPLATES.customContextExpand) {
    nextTemplates.customContextExpand = DEFAULT_PROMPT_TEMPLATES_ZH.customContextExpand
  }
  if (isLegacyValue(promptTemplates.contextEnvelope, [LEGACY_PROMPT_TEMPLATES.contextEnvelope, PREVIOUS_CONTEXT_ENVELOPE])) {
    nextTemplates.contextEnvelope = DEFAULT_PROMPT_TEMPLATES_ZH.contextEnvelope
  }

  upgraded.promptTemplates = nextTemplates as PromptTemplates
  return upgraded
}

function normalizeLLMSettings(settings?: Partial<LLMSettings>): LLMSettings {
  const upgraded = upgradeLegacyPromptDefaults(settings)
  const promptLocale = resolvePromptLocale(upgraded.promptLocale)
  const localizedPromptsRaw = (upgraded.localizedPrompts || {}) as Partial<Record<LocaleCode, Partial<LocalizedPromptConfig>>>

  const localizedPrompts: Record<LocaleCode, LocalizedPromptConfig> = {
    'zh-CN': normalizeLocalizedPrompt('zh-CN', localizedPromptsRaw['zh-CN']),
    'en-US': normalizeLocalizedPrompt('en-US', localizedPromptsRaw['en-US'])
  }

  if (!upgraded.localizedPrompts) {
    localizedPrompts[promptLocale] = normalizeLocalizedPrompt(promptLocale, {
      ...localizedPrompts[promptLocale],
      systemPrompt: upgraded.systemPrompt || localizedPrompts[promptLocale].systemPrompt,
      promptTemplates: {
        ...localizedPrompts[promptLocale].promptTemplates,
        ...(upgraded.promptTemplates || {})
      },
      answerAnchorKeywords: upgraded.answerAnchorKeywords || localizedPrompts[promptLocale].answerAnchorKeywords
    })
  }

  const activePromptConfig = localizedPrompts[promptLocale]

  return {
    apiKey: upgraded.apiKey || '',
    baseURL: upgraded.baseURL || 'https://mg.aid.pub/v1',
    model: upgraded.model || 'Gemini-3.1-Pro',
    apiStyle: upgraded.apiStyle || 'openai_chat',
    promptLocale,
    localizedPrompts,
    answerAnchorKeywords: [...activePromptConfig.answerAnchorKeywords],
    temperature: typeof upgraded.temperature === 'number' ? upgraded.temperature : 0.7,
    maxTokens: typeof upgraded.maxTokens === 'number' ? upgraded.maxTokens : 4096,
    contextMaxDepth: typeof upgraded.contextMaxDepth === 'number' ? upgraded.contextMaxDepth : 10,
    systemPrompt: activePromptConfig.systemPrompt,
    promptTemplates: clonePromptTemplates(activePromptConfig.promptTemplates)
  }
}

const DEFAULT_LLM_SETTINGS: LLMSettings = normalizeLLMSettings()

const DEFAULT_UI_SETTINGS: UISettings = {
  theme: 'light',
  localeMode: 'auto',
  localeResolved: resolveLocaleMode('auto', getBrowserLanguage())
}

function normalizeUISettings(settings?: Partial<UISettings>): UISettings {
  const mode = settings?.localeMode || 'auto'
  return {
    theme: settings?.theme || 'light',
    localeMode: mode,
    localeResolved: resolveLocaleMode(mode, getBrowserLanguage())
  }
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      llmSettings: DEFAULT_LLM_SETTINGS,
      uiSettings: DEFAULT_UI_SETTINGS,
      updateLLMSettings: (settings) => set((state) => {
        const mergedLocalizedPrompts: Record<LocaleCode, LocalizedPromptConfig> = {
          'zh-CN': normalizeLocalizedPrompt('zh-CN', {
            ...state.llmSettings.localizedPrompts['zh-CN'],
            ...(settings.localizedPrompts?.['zh-CN'] || {})
          }),
          'en-US': normalizeLocalizedPrompt('en-US', {
            ...state.llmSettings.localizedPrompts['en-US'],
            ...(settings.localizedPrompts?.['en-US'] || {})
          })
        }

        const nextPromptLocale = resolvePromptLocale(settings.promptLocale ?? state.llmSettings.promptLocale)
        const shouldUpdateActivePrompt = (
          settings.systemPrompt !== undefined ||
          settings.promptTemplates !== undefined ||
          settings.answerAnchorKeywords !== undefined
        )

        if (shouldUpdateActivePrompt) {
          const currentActive = mergedLocalizedPrompts[nextPromptLocale]
          mergedLocalizedPrompts[nextPromptLocale] = normalizeLocalizedPrompt(nextPromptLocale, {
            ...currentActive,
            systemPrompt: settings.systemPrompt ?? currentActive.systemPrompt,
            promptTemplates: {
              ...currentActive.promptTemplates,
              ...(settings.promptTemplates || {})
            },
            answerAnchorKeywords: settings.answerAnchorKeywords ?? currentActive.answerAnchorKeywords
          })
        }

        const activePromptConfig = mergedLocalizedPrompts[nextPromptLocale]

        return {
          llmSettings: {
            ...state.llmSettings,
            ...settings,
            promptLocale: nextPromptLocale,
            localizedPrompts: mergedLocalizedPrompts,
            systemPrompt: activePromptConfig.systemPrompt,
            promptTemplates: clonePromptTemplates(activePromptConfig.promptTemplates),
            answerAnchorKeywords: [...activePromptConfig.answerAnchorKeywords]
          }
        }
      }),
      updateUISettings: (settings) => set((state) => {
        const nextTheme = settings.theme ?? state.uiSettings.theme
        const nextLocaleMode = settings.localeMode ?? state.uiSettings.localeMode
        const nextLocaleResolved = settings.localeMode
          ? resolveLocaleMode(settings.localeMode, getBrowserLanguage())
          : settings.localeResolved ?? state.uiSettings.localeResolved

        return {
          uiSettings: {
            theme: nextTheme,
            localeMode: nextLocaleMode,
            localeResolved: nextLocaleResolved
          }
        }
      }),
      setTheme: (theme) => set((state) => ({
        uiSettings: {
          ...state.uiSettings,
          theme
        }
      })),
      setLocaleMode: (mode) => set((state) => ({
        uiSettings: {
          ...state.uiSettings,
          localeMode: mode,
          localeResolved: resolveLocaleMode(mode, getBrowserLanguage())
        }
      })),
      syncLocaleFromNavigator: () => set((state) => {
        if (state.uiSettings.localeMode !== 'auto') return {}
        const resolved = resolveLocaleMode('auto', getBrowserLanguage())
        if (resolved === state.uiSettings.localeResolved) return {}
        return {
          uiSettings: {
            ...state.uiSettings,
            localeResolved: resolved
          }
        }
      })
    }),
    {
      name: 'oml-settings',
      merge: (persisted, current) => {
        const persistedState = (persisted || {}) as Partial<SettingsStore>
        const mergedLLM = normalizeLLMSettings({
          ...current.llmSettings,
          ...(persistedState.llmSettings || {})
        })
        const mergedUI = normalizeUISettings({
          ...current.uiSettings,
          ...(persistedState.uiSettings || {})
        })

        return {
          ...current,
          ...persistedState,
          llmSettings: mergedLLM,
          uiSettings: mergedUI
        } as SettingsStore
      }
    }
  )
)
