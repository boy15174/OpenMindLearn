export async function generateContent(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || ''
  const baseURL = process.env.GEMINI_BASE_URL || 'https://mg.aid.pub/v1'
  const model = process.env.GEMINI_MODEL || 'Gemini-3.1-Pro'

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await response.json()
  return data.choices[0].message.content
}

/**
 * 生成内容（带上下文）
 */
export async function generateWithContext(
  prompt: string,
  contextXml: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || ''
  const baseURL = process.env.GEMINI_BASE_URL || 'https://mg.aid.pub/v1'
  const model = process.env.GEMINI_MODEL || 'Gemini-3.1-Pro'

  // 构建带上下文的完整 prompt
  const fullPrompt = `以下是之前的对话上下文，请基于这些内容回答用户的问题：

${contextXml}

用户的问题：${prompt}

请基于上述上下文提供详细的回答。`

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: fullPrompt }]
    })
  })

  const data = await response.json()
  return data.choices[0].message.content
}
