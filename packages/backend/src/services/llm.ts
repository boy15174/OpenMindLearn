export type ExpandMode = 'direct' | 'targeted' | 'custom_context'
export type ApiStyle = 'openai_chat' | 'google_gemini'

import type { NodeImage } from '../types/index.js'

export interface PromptTemplates {
  directExpand: string
  targetedQuestion: string
  customContextExpand: string
  contextEnvelope: string
}

interface RuntimeConfig {
  apiKey?: string
  baseURL?: string
  model?: string
  apiStyle?: ApiStyle
  answerAnchorKeywords?: string[]
  temperature?: number
  maxTokens?: number
  contextMaxDepth?: number
  systemPrompt?: string
  promptTemplates?: Partial<PromptTemplates>
}

interface ChatCompletionMessage {
  content?: string | Array<Record<string, unknown> | string>
  reasoning_content?: string
  reasoning?: string
}

interface ChatCompletionChoice {
  message?: ChatCompletionMessage
  reasoning_content?: string
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[]
  output?: Array<Record<string, unknown>>
}

interface GoogleGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
        thought?: boolean
        thoughtSignature?: string
      }>
    }
  }>
}

export interface GeneratedAnswer {
  content: string
  thinking?: string
}

const DEFAULT_SYSTEM_PROMPT = `你是 OpenMindLearn 的学习教练型助手，目标是帮助用户“理解 -> 记住 -> 会用”。

回答原则：
1. 你可以进行充分推理；若输出思考过程，请与最终答案清晰分段，避免混在同一段正文里。
2. 优先使用用户输入语言；未指定时使用简体中文。
3. 先给结论，再给结构化讲解；解释要准确、可验证、避免空话。
4. 适度延伸但不跑题，和当前问题及上下文保持强关联。
5. 对不确定信息明确标注“可能/待确认”，不要编造。
6. 输出使用 Markdown，信息密度优先。`
const DEFAULT_PROMPT_TEMPLATES: PromptTemplates = {
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

const DEFAULT_ANSWER_ANCHOR_KEYWORDS = ['结论']

let runtimeConfig: RuntimeConfig = {}

function parseNumber(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) return input
  if (typeof input === 'string' && input.trim()) {
    const parsed = Number(input)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function clamp(value: number, min: number, max: number, integer = false): number {
  const normalized = Math.max(min, Math.min(max, value))
  return integer ? Math.round(normalized) : normalized
}

function toEnvNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeApiStyle(value: unknown): ApiStyle {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'google_gemini' || normalized === 'google') return 'google_gemini'
  return 'openai_chat'
}

function withNoTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function toGoogleBaseURL(baseURL: string): string {
  const normalized = withNoTrailingSlash(baseURL)
  if (normalized.endsWith('/v1')) {
    return `${normalized.slice(0, -3)}/gemini/v1`
  }
  if (normalized.includes('/openai/v1')) {
    return normalized.replace('/openai/v1', '/gemini/v1')
  }
  return normalized
}

function resolveTemplate(template: string | undefined, fallback: string, requiredTokens: string[]): string {
  const value = (template || '').trim()
  if (!value) return fallback
  let resolved = value
  requiredTokens.forEach((token) => {
    if (!resolved.includes(`{{${token}}}`)) {
      resolved = `${resolved}\n\n{{${token}}}`
    }
  })
  return resolved
}

function normalizeAnswerAnchorKeywords(input: unknown): string[] {
  const raw: string[] = []
  if (Array.isArray(input)) {
    input.forEach((item) => {
      if (typeof item === 'string') raw.push(item)
    })
  } else if (typeof input === 'string') {
    raw.push(...input.split(/[\n,，]/))
  }

  const normalized = raw
    .map((item) => item.trim())
    .filter(Boolean)

  const unique = Array.from(new Set(normalized))
  return unique.length > 0 ? unique : [...DEFAULT_ANSWER_ANCHOR_KEYWORDS]
}

function applyTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] ?? '')
}

function getResolvedConfig() {
  const envTemperature = toEnvNumber(process.env.GEMINI_TEMPERATURE)
  const envMaxTokens = toEnvNumber(process.env.GEMINI_MAX_TOKENS)
  const envContextMaxDepth = toEnvNumber(process.env.CONTEXT_MAX_DEPTH)
  const envApiStyle = process.env.API_STYLE
  const envAnswerAnchorKeywords = process.env.ANSWER_ANCHOR_KEYWORDS

  const temperature = clamp(
    runtimeConfig.temperature ?? envTemperature ?? 0.7,
    0,
    2
  )
  const maxTokens = clamp(
    runtimeConfig.maxTokens ?? envMaxTokens ?? 4096,
    1,
    32000,
    true
  )
  const contextMaxDepth = clamp(
    runtimeConfig.contextMaxDepth ?? envContextMaxDepth ?? 10,
    1,
    50,
    true
  )

  const promptTemplates: PromptTemplates = {
    directExpand: resolveTemplate(
      runtimeConfig.promptTemplates?.directExpand,
      DEFAULT_PROMPT_TEMPLATES.directExpand,
      ['text']
    ),
    targetedQuestion: resolveTemplate(
      runtimeConfig.promptTemplates?.targetedQuestion,
      DEFAULT_PROMPT_TEMPLATES.targetedQuestion,
      ['text']
    ),
    customContextExpand: resolveTemplate(
      runtimeConfig.promptTemplates?.customContextExpand,
      DEFAULT_PROMPT_TEMPLATES.customContextExpand,
      ['text']
    ),
    contextEnvelope: resolveTemplate(
      runtimeConfig.promptTemplates?.contextEnvelope,
      DEFAULT_PROMPT_TEMPLATES.contextEnvelope,
      ['contextXml', 'prompt']
    )
  }

  return {
    apiKey: runtimeConfig.apiKey || process.env.GEMINI_API_KEY || '',
    baseURL: runtimeConfig.baseURL || process.env.GEMINI_BASE_URL || 'https://mg.aid.pub/v1',
    model: runtimeConfig.model || process.env.GEMINI_MODEL || 'Gemini-3.1-Pro',
    apiStyle: normalizeApiStyle(runtimeConfig.apiStyle || envApiStyle || 'openai_chat'),
    answerAnchorKeywords: normalizeAnswerAnchorKeywords(
      runtimeConfig.answerAnchorKeywords ?? envAnswerAnchorKeywords ?? DEFAULT_ANSWER_ANCHOR_KEYWORDS
    ),
    temperature,
    maxTokens,
    contextMaxDepth,
    systemPrompt: (runtimeConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT).trim() || DEFAULT_SYSTEM_PROMPT,
    promptTemplates
  }
}

export function setLLMConfig(config: RuntimeConfig) {
  const nextConfig: RuntimeConfig = { ...config }
  if (config.apiStyle) {
    nextConfig.apiStyle = normalizeApiStyle(config.apiStyle)
  }
  if (config.answerAnchorKeywords !== undefined) {
    nextConfig.answerAnchorKeywords = normalizeAnswerAnchorKeywords(config.answerAnchorKeywords)
  }
  const parsedTemperature = parseNumber(config.temperature)
  if (parsedTemperature !== undefined) {
    nextConfig.temperature = clamp(parsedTemperature, 0, 2)
  }
  const parsedMaxTokens = parseNumber(config.maxTokens)
  if (parsedMaxTokens !== undefined) {
    nextConfig.maxTokens = clamp(parsedMaxTokens, 1, 32000, true)
  }
  const parsedContextDepth = parseNumber(config.contextMaxDepth)
  if (parsedContextDepth !== undefined) {
    nextConfig.contextMaxDepth = clamp(parsedContextDepth, 1, 50, true)
  }

  runtimeConfig = {
    ...runtimeConfig,
    ...nextConfig,
    promptTemplates: {
      ...(runtimeConfig.promptTemplates || {}),
      ...(nextConfig.promptTemplates || {})
    }
  }
}

export function getLLMConfig() {
  return getResolvedConfig()
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeMessagePayload(choice: ChatCompletionChoice | undefined, answerAnchorKeywords: string[]): GeneratedAnswer {
  const message = choice?.message
  if (!message) return { content: '' }

  const externalThinking: string[] = []
  const pushExternalThinking = (value: unknown) => {
    const text = asText(value).trim()
    if (text) externalThinking.push(text)
  }

  pushExternalThinking(message.reasoning_content)
  pushExternalThinking(message.reasoning)
  pushExternalThinking(choice?.reasoning_content)

  let contentText = ''
  if (typeof message.content === 'string') {
    contentText = message.content
  } else if (Array.isArray(message.content)) {
    const answerParts: string[] = []
    const thinkingParts: string[] = []

    message.content.forEach((part) => {
      if (typeof part === 'string') {
        if (part.trim()) answerParts.push(part)
        return
      }
      if (!part || typeof part !== 'object') return

      const type = asText((part as Record<string, unknown>).type).toLowerCase()
      const text = asText(
        (part as Record<string, unknown>).text
        || (part as Record<string, unknown>).content
        || (part as Record<string, unknown>).value
      ).trim()
      if (!text) return

      if (/(reason|think|analysis)/i.test(type)) {
        thinkingParts.push(text)
      } else {
        answerParts.push(text)
      }
    })

    if (thinkingParts.length > 0) {
      externalThinking.push(thinkingParts.join('\n\n'))
    }
    contentText = answerParts.join('\n').trim()
  }

  const parsed = extractAnswerAndThinking(contentText, answerAnchorKeywords)
  const allThinking = [...externalThinking]
  if (parsed.thinking) allThinking.push(parsed.thinking)

  return {
    content: parsed.content,
    thinking: allThinking.join('\n\n').trim() || undefined
  }
}

function normalizeOutputPayload(output: Array<Record<string, unknown>> | undefined, answerAnchorKeywords: string[]): GeneratedAnswer {
  if (!Array.isArray(output) || output.length === 0) return { content: '' }

  const thinkingParts: string[] = []
  const answerParts: string[] = []

  output.forEach((item) => {
    const itemType = asText(item?.type).toLowerCase()
    const contentList = Array.isArray(item?.content) ? item.content : []

    if (itemType.includes('reason')) {
      const summary = asText((item as Record<string, unknown>).summary).trim()
      if (summary) thinkingParts.push(summary)
    }

    if (contentList.length > 0) {
      contentList.forEach((part) => {
        if (!part || typeof part !== 'object') return
        const partRecord = part as Record<string, unknown>
        const partType = asText(partRecord.type).toLowerCase()
        const text = asText(partRecord.text || partRecord.content || partRecord.summary).trim()
        if (!text) return
        if (/(reason|think|analysis)/i.test(partType)) {
          thinkingParts.push(text)
        } else {
          answerParts.push(text)
        }
      })
      return
    }

    const directText = asText(item?.text || item?.content).trim()
    if (!directText) return
    if (/(reason|think|analysis)/i.test(itemType)) {
      thinkingParts.push(directText)
    } else {
      answerParts.push(directText)
    }
  })

  const parsed = extractAnswerAndThinking(answerParts.join('\n').trim(), answerAnchorKeywords)
  const allThinking = [...thinkingParts]
  if (parsed.thinking) allThinking.push(parsed.thinking)
  return {
    content: parsed.content,
    thinking: allThinking.join('\n\n').trim() || undefined
  }
}

function looksLikeHeadingBlock(block: string): boolean {
  const line = block.trim()
  if (!line) return false
  if (/^#{1,6}\s+/.test(line)) return true
  if (line.length > 72) return false
  if (/[.!?。！？:：]/.test(line)) return false
  return /^[A-Za-z][A-Za-z0-9\s\-&/()]+$/.test(line)
}

function looksLikeThinkingBlock(block: string): boolean {
  const text = block.trim()
  if (!text) return false
  const lowered = text.toLowerCase()
  if (
    /^(i(?:'m| am)\s+(?:currently|now|focused|considering|planning|analyzing|reconciling|trying|thinking)|i(?:'ve| have)\s+(?:outlined|decided|structured|drafted|prioritized|identified))/i.test(text) ||
    /^the user'?s query/i.test(text) ||
    /(用户(的)?问题|我(现在|正在|目前|接下来).*(分析|思考|拆解|规划|聚焦)|先.*再.*|我的(目标|思路)|接下来我会)/.test(text)
  ) {
    return true
  }
  const metaHints = [
    'user\'s query', 'the user query', 'i\'m currently', 'i am currently', 'i\'m now', 'i am now',
    'focused on', 'reconciling', 'considering different approaches', 'my primary goal', 'i\'ve outlined'
  ]
  return metaHints.some((hint) => lowered.includes(hint))
}

function containsAnchorKeyword(line: string, keywords: string[]): boolean {
  const lowerLine = line.toLowerCase()
  return keywords.some((keyword) => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    if (!normalizedKeyword) return false
    return lowerLine.includes(normalizedKeyword)
  })
}

function isAnswerAnchorBlock(block: string, answerAnchorKeywords: string[]): boolean {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.some((line) => containsAnchorKeyword(line, answerAnchorKeywords))) {
    return true
  }

  const line = block.trim()
  if (!line) return false
  return /^(?:#{1,6}\s*)?(?:最终答案|回答|答复|总结|核心结论|conclusion|final answer|answer|summary)\b/i.test(line)
}

function splitIntoLogicalBlocks(text: string): string[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: string[] = []
  let buffer: string[] = []

  const flush = () => {
    const joined = buffer.join('\n').trim()
    if (joined) blocks.push(joined)
    buffer = []
  }

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flush()
      return
    }

    const standaloneHeading = /^#{1,6}\s+/.test(trimmed) || looksLikeHeadingBlock(trimmed)
    if (standaloneHeading) {
      flush()
      blocks.push(trimmed)
      return
    }

    buffer.push(line)
  })

  flush()
  return blocks
}

function extractHeuristicThinkingSections(text: string, answerAnchorKeywords: string[]): { content: string; thinking?: string } {
  const strongCue = /(user'?s query|i(?:'m| am)\s+(?:currently|now|focused|considering|reconciling)|i(?:'ve| have)\s+(?:outlined|decided|structured)|my primary goal|用户(的)?问题|我(现在|正在|目前))/i
  const blocks = splitIntoLogicalBlocks(text)
  if (blocks.length === 0) return { content: '' }

  const keywordAnchorIndex = blocks.findIndex((block, index) => index > 0 && isAnswerAnchorBlock(block, answerAnchorKeywords))
  if (keywordAnchorIndex > 0) {
    return {
      content: blocks.slice(keywordAnchorIndex).join('\n\n').trim(),
      thinking: blocks.slice(0, keywordAnchorIndex).join('\n\n').trim() || undefined
    }
  }

  // If we can detect where the actual answer starts, everything before it is treated as thinking.
  const anchorIndex = blocks.findIndex((block, index) => {
    if (index === 0) return false
    return !looksLikeHeadingBlock(block) && !looksLikeThinkingBlock(block)
  })
  const anchorPrefix = anchorIndex > 0 ? blocks.slice(0, anchorIndex).join('\n\n') : ''
  if (anchorIndex > 0 && (strongCue.test(anchorPrefix) || blocks.slice(0, anchorIndex).some(looksLikeThinkingBlock))) {
    return {
      content: blocks.slice(anchorIndex).join('\n\n').trim(),
      thinking: blocks.slice(0, anchorIndex).join('\n\n').trim() || undefined
    }
  }

  const thinkingIndexes = new Set<number>()

  blocks.forEach((block, index) => {
    if (looksLikeThinkingBlock(block)) {
      thinkingIndexes.add(index)
    }
  })

  Array.from(thinkingIndexes).forEach((index) => {
    let cursor = index - 1
    while (cursor >= 0 && looksLikeHeadingBlock(blocks[cursor])) {
      thinkingIndexes.add(cursor)
      cursor--
    }
  })

  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < blocks.length; i++) {
      if (thinkingIndexes.has(i)) continue
      if (!looksLikeHeadingBlock(blocks[i])) continue
      if (thinkingIndexes.has(i - 1) || thinkingIndexes.has(i + 1)) {
        thinkingIndexes.add(i)
        changed = true
      }
    }
  }

  if (thinkingIndexes.size === 0) {
    return { content: text.trim() }
  }

  const thinkingBlocks: string[] = []
  const contentBlocks: string[] = []
  blocks.forEach((block, index) => {
    if (thinkingIndexes.has(index)) {
      thinkingBlocks.push(block)
    } else {
      contentBlocks.push(block)
    }
  })

  return {
    content: contentBlocks.join('\n\n').trim(),
    thinking: thinkingBlocks.join('\n\n').trim() || undefined
  }
}

function extractAnswerAndThinking(content: string, answerAnchorKeywords: string[]): GeneratedAnswer {
  const extractedThinking: string[] = []
  let cleaned = content || ''

  cleaned = cleaned.replace(
    /<\s*(think|thinking|reasoning|analysis)[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi,
    (_, __, block: string) => {
      const value = (block || '').trim()
      if (value) extractedThinking.push(value)
      return '\n'
    }
  )
  cleaned = cleaned.replace(
    /\[\s*(think|thinking|reasoning|analysis)\s*\]([\s\S]*?)\[\s*\/\s*\1\s*\]/gi,
    (_, __, block: string) => {
      const value = (block || '').trim()
      if (value) extractedThinking.push(value)
      return '\n'
    }
  )
  cleaned = cleaned.replace(
    /```(?:think|thinking|reasoning|analysis)\s*([\s\S]*?)```/gi,
    (_, block: string) => {
      const value = (block || '').trim()
      if (value) extractedThinking.push(value)
      return '\n'
    }
  )

  const paragraphSplit = cleaned.split(/\n{2,}/)
  const firstParagraph = (paragraphSplit[0] || '').trim()
  const firstParagraphThinkPrefix = firstParagraph.match(/^think(?:ing)?\s*[:：-]?\s*/i)
  if (firstParagraphThinkPrefix && paragraphSplit.length > 1) {
    const thinkText = firstParagraph.replace(/^think(?:ing)?\s*[:：-]?\s*/i, '').trim()
    if (thinkText) extractedThinking.push(thinkText)
    cleaned = paragraphSplit.slice(1).join('\n\n').trim()
  } else {
    const firstLineEnd = cleaned.search(/\r?\n/)
    const firstLine = firstLineEnd === -1 ? cleaned.trim() : cleaned.slice(0, firstLineEnd).trim()
    const firstLineThinkPrefix = firstLine.match(/^think(?:ing)?\s*[:：-]?\s*/i)
    if (firstLineThinkPrefix) {
      const thinkText = firstLine.replace(/^think(?:ing)?\s*[:：-]?\s*/i, '').trim()
      if (thinkText) extractedThinking.push(thinkText)
      cleaned = (firstLineEnd === -1 ? '' : cleaned.slice(firstLineEnd + 1)).trim()
    }
  }

  const answerMarker = /(?:^|\n)\s*(?:final answer|answer|最终答案|回答|答复)\s*[:：]\s*/i
  const markerMatch = cleaned.match(answerMarker)
  if (markerMatch && markerMatch.index !== undefined) {
    const prefix = cleaned.slice(0, markerMatch.index).trim()
    if (prefix) extractedThinking.push(prefix)
    cleaned = cleaned.slice(markerMatch.index + markerMatch[0].length)
  }

  const lines = cleaned.split(/\r?\n/)
  const leadingReasoningPattern = /^(thought|thinking|reasoning|analysis|chain[-\s]?of[-\s]?thought|cot|思考|推理|思维链|内部推理|内心独白)\s*[:：]/i
  const strippedLeadingThinking: string[] = []
  let firstContentLine = 0

  while (firstContentLine < lines.length) {
    const line = lines[firstContentLine].trim()
    if (!line) {
      firstContentLine++
      continue
    }
    if (leadingReasoningPattern.test(line)) {
      strippedLeadingThinking.push(lines[firstContentLine])
      firstContentLine++
      continue
    }
    break
  }

  if (strippedLeadingThinking.length > 0) {
    extractedThinking.push(strippedLeadingThinking.join('\n').trim())
  }

  cleaned = lines.slice(firstContentLine).join('\n').trim()
  cleaned = cleaned.replace(/^(final answer|answer|最终答案|回答|答复)\s*[:：]\s*/i, '').trim()

  const heuristic = extractHeuristicThinkingSections(cleaned, answerAnchorKeywords)
  cleaned = heuristic.content
  if (heuristic.thinking) extractedThinking.push(heuristic.thinking)

  return {
    content: cleaned,
    thinking: extractedThinking.join('\n\n').trim() || undefined
  }
}

function getExpandPromptTemplate(mode: ExpandMode, templates: PromptTemplates): string {
  if (mode === 'targeted') return templates.targetedQuestion
  if (mode === 'custom_context') return templates.customContextExpand
  return templates.directExpand
}

export function buildExpandPrompt(text: string, mode: ExpandMode = 'direct'): string {
  const { promptTemplates } = getResolvedConfig()
  const template = getExpandPromptTemplate(mode, promptTemplates)
  return applyTemplate(template, { text })
}

function buildContextPrompt(prompt: string, contextXml: string): string {
  const { promptTemplates } = getResolvedConfig()
  return applyTemplate(promptTemplates.contextEnvelope, {
    prompt,
    contextXml
  })
}

function buildOpenAIChatPayload(
  cfg: ReturnType<typeof getResolvedConfig>,
  prompt: string,
  images?: NodeImage[]
) {
  const userContent = images && images.length > 0
    ? [
        { type: 'text' as const, text: prompt },
        ...images.map(img => ({
          type: 'image_url' as const,
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` }
        }))
      ]
    : prompt

  return {
    url: `${withNoTrailingSlash(cfg.baseURL)}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`
    },
    body: {
      model: cfg.model,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
      messages: [
        {
          role: 'system',
          content: cfg.systemPrompt
        },
        { role: 'user', content: userContent }
      ]
    }
  }
}

function buildGoogleGeminiPayload(
  cfg: ReturnType<typeof getResolvedConfig>,
  prompt: string,
  images?: NodeImage[]
) {
  const parts = [
    { text: prompt },
    ...((images || []).map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64
      }
    })))
  ]

  return {
    url: `${toGoogleBaseURL(cfg.baseURL)}/models/${encodeURIComponent(cfg.model)}:generateContent`,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': cfg.apiKey
    },
    body: {
      systemInstruction: {
        parts: [{ text: cfg.systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts
        }
      ],
      generationConfig: {
        temperature: cfg.temperature,
        maxOutputTokens: cfg.maxTokens,
        thinkingConfig: {
          includeThoughts: true
        }
      }
    }
  }
}

async function parseResponseJson(response: Response): Promise<any> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function extractErrorMessage(data: any, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback
  const nested = data.error?.message || data.error || data.detail || data.message
  const text = typeof nested === 'string' ? nested : ''
  return text || fallback
}

function normalizeGooglePayload(data: GoogleGenerateResponse, answerAnchorKeywords: string[]): GeneratedAnswer {
  const parts = data.candidates?.[0]?.content?.parts || []
  const thinkingParts: string[] = []
  const answerParts: string[] = []

  parts.forEach((part) => {
    const text = asText(part?.text).trim()
    if (!text) return
    if (part?.thought || asText(part?.thoughtSignature)) {
      thinkingParts.push(text)
      return
    }
    answerParts.push(text)
  })

  const answerText = answerParts.join('\n').trim()
  const parsed = extractAnswerAndThinking(answerText, answerAnchorKeywords)
  const allThinking = [...thinkingParts]
  if (parsed.thinking) allThinking.push(parsed.thinking)

  return {
    content: parsed.content,
    thinking: allThinking.join('\n\n').trim() || undefined
  }
}

async function generateByStyle(prompt: string, images?: NodeImage[]): Promise<GeneratedAnswer> {
  const cfg = getResolvedConfig()
  if (cfg.apiStyle === 'google_gemini') {
    const payload = buildGoogleGeminiPayload(cfg, prompt, images)
    const response = await fetch(payload.url, {
      method: 'POST',
      headers: payload.headers,
      body: JSON.stringify(payload.body)
    })
    const data = await parseResponseJson(response)
    if (!response.ok) {
      throw new Error(extractErrorMessage(data, `Google API 请求失败：HTTP ${response.status}`))
    }
    return normalizeGooglePayload(data as GoogleGenerateResponse, cfg.answerAnchorKeywords)
  }

  const payload = buildOpenAIChatPayload(cfg, prompt, images)
  const response = await fetch(payload.url, {
    method: 'POST',
    headers: payload.headers,
    body: JSON.stringify(payload.body)
  })
  const data = await parseResponseJson(response)
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, `LLM 请求失败：HTTP ${response.status}`))
  }
  const parsed = data as ChatCompletionResponse
  if (Array.isArray(parsed.output) && parsed.output.length > 0) {
    return normalizeOutputPayload(parsed.output, cfg.answerAnchorKeywords)
  }
  return normalizeMessagePayload(parsed.choices?.[0], cfg.answerAnchorKeywords)
}

export async function generateContent(prompt: string, images?: NodeImage[]): Promise<GeneratedAnswer> {
  return generateByStyle(prompt, images)
}

export async function generateWithContext(
  prompt: string,
  contextXml: string,
  images?: NodeImage[]
): Promise<GeneratedAnswer> {
  const fullPrompt = buildContextPrompt(prompt, contextXml)
  return generateByStyle(fullPrompt, images)
}
