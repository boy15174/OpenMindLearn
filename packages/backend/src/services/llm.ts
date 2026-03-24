let runtimeConfig: { apiKey?: string; baseURL?: string; model?: string } = {}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

export function setLLMConfig(config: { apiKey?: string; baseURL?: string; model?: string }) {
  runtimeConfig = { ...runtimeConfig, ...config }
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

export async function generateContent(prompt: string): Promise<string> {
  const apiKey = runtimeConfig.apiKey || process.env.GEMINI_API_KEY || ''
  const baseURL = runtimeConfig.baseURL || process.env.GEMINI_BASE_URL || 'https://mg.aid.pub/v1'
  const model = runtimeConfig.model || process.env.GEMINI_MODEL || 'Gemini-3.1-Pro'

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: '只输出最终答案，不要输出任何思考过程、推理步骤、分析过程或 think 标签。'
        },
        { role: 'user', content: prompt }
      ]
    })
  })

  const data = await response.json() as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content || ''
  return removeThinkingTags(content)
}

/**
 * 生成内容（带上下文）
 */
export async function generateWithContext(
  prompt: string,
  contextXml: string
): Promise<string> {
  const apiKey = runtimeConfig.apiKey || process.env.GEMINI_API_KEY || ''
  const baseURL = runtimeConfig.baseURL || process.env.GEMINI_BASE_URL || 'https://mg.aid.pub/v1'
  const model = runtimeConfig.model || process.env.GEMINI_MODEL || 'Gemini-3.1-Pro'

  // 构建带上下文的完整 prompt
  const fullPrompt = `你是一个知识图谱助手。以下是节点链（从根节点到当前父节点），最后一个节点是用户当前正在查看的内容：

${contextXml}

用户想要基于**最后一个节点**的内容进一步探索：${prompt}

要求：
1. 重点关注最后一个节点的内容，这是用户当前的焦点
2. 你的回答应该是对最后一个节点内容的延伸和深化
3. 前面的节点提供背景脉络，帮助你理解整体主题
4. 保持与最后一个节点的紧密关联
5. 用 Markdown 格式回答
6. 只输出最终答案，不要输出任何思考过程、推理步骤、分析过程或 think 标签`

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: '只输出最终答案，不要输出任何思考过程、推理步骤、分析过程或 think 标签。'
        },
        { role: 'user', content: fullPrompt }
      ]
    })
  })

  const data = await response.json() as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content || ''
  return removeThinkingTags(content)
}
