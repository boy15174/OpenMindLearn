import type { NodeImage } from '../../../types/index.js'
import { extractAnswerAndThinking } from '../parsing/thinkingExtractor.js'
import { asText } from '../parsing/normalize.js'
import type { GeneratedAnswer, GoogleGenerateResponse, ResolvedConfig } from '../types.js'

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

export function buildGoogleGeminiPayload(
  cfg: ResolvedConfig,
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

export function normalizeGoogleResponse(data: GoogleGenerateResponse, answerAnchorKeywords: string[]): GeneratedAnswer {
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
