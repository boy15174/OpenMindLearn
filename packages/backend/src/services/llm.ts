export type ExpandMode = 'direct' | 'targeted' | 'custom_context'

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
  temperature?: number
  maxTokens?: number
  contextMaxDepth?: number
  systemPrompt?: string
  promptTemplates?: Partial<PromptTemplates>
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

const DEFAULT_SYSTEM_PROMPT = '只输出最终答案，不要输出任何思考过程、推理步骤、分析过程或 think 标签。'
const DEFAULT_PROMPT_TEMPLATES: PromptTemplates = {
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

function applyTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] ?? '')
}

function getResolvedConfig() {
  const envTemperature = toEnvNumber(process.env.GEMINI_TEMPERATURE)
  const envMaxTokens = toEnvNumber(process.env.GEMINI_MAX_TOKENS)
  const envContextMaxDepth = toEnvNumber(process.env.CONTEXT_MAX_DEPTH)

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
    temperature,
    maxTokens,
    contextMaxDepth,
    systemPrompt: (runtimeConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT).trim() || DEFAULT_SYSTEM_PROMPT,
    promptTemplates
  }
}

export function setLLMConfig(config: RuntimeConfig) {
  const nextConfig: RuntimeConfig = { ...config }
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

function removeThinkingTags(content: string): string {
  let cleaned = content
    .replace(/<\s*(think|thinking|reasoning)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\[\s*(think|thinking|reasoning)\s*\][\s\S]*?\[\s*\/\s*\1\s*\]/gi, '')
    .replace(/```(?:think|thinking|reasoning|analysis)[\s\S]*?```/gi, '')

  const lines = cleaned.split(/\r?\n/)
  const leadingReasoningPattern = /^(thought|thinking|reasoning|analysis|chain[-\s]?of[-\s]?thought|cot|思考|推理|思维链|内部推理|内心独白)\s*[:：]/i
  const answerPrefixPattern = /^(final answer|answer|最终答案|回答|答复)\s*[:：]\s*/i
  let firstContentLine = 0

  while (firstContentLine < lines.length) {
    const line = lines[firstContentLine].trim()
    if (!line) {
      firstContentLine++
      continue
    }
    if (leadingReasoningPattern.test(line)) {
      firstContentLine++
      continue
    }
    break
  }

  cleaned = lines.slice(firstContentLine).join('\n').trim()
  cleaned = cleaned.replace(answerPrefixPattern, '').trim()
  return cleaned
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

function buildCompletionBody(prompt: string) {
  const cfg = getResolvedConfig()
  return {
    url: `${cfg.baseURL}/chat/completions`,
    apiKey: cfg.apiKey,
    body: {
      model: cfg.model,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
      messages: [
        {
          role: 'system',
          content: cfg.systemPrompt
        },
        { role: 'user', content: prompt }
      ]
    }
  }
}

export async function generateContent(prompt: string): Promise<string> {
  const payload = buildCompletionBody(prompt)

  const response = await fetch(payload.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${payload.apiKey}`
    },
    body: JSON.stringify(payload.body)
  })

  const data = await response.json() as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content || ''
  return removeThinkingTags(content)
}

export async function generateWithContext(
  prompt: string,
  contextXml: string
): Promise<string> {
  const fullPrompt = buildContextPrompt(prompt, contextXml)
  const payload = buildCompletionBody(fullPrompt)

  const response = await fetch(payload.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${payload.apiKey}`
    },
    body: JSON.stringify(payload.body)
  })

  const data = await response.json() as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content || ''
  return removeThinkingTags(content)
}
