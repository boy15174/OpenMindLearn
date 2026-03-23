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
