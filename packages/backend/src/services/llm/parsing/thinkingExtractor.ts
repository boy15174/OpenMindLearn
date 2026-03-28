import type { GeneratedAnswer } from '../types.js'

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
    "user's query", 'the user query', "i'm currently", 'i am currently', "i'm now", 'i am now',
    'focused on', 'reconciling', 'considering different approaches', 'my primary goal', "i've outlined"
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

export function extractAnswerAndThinking(content: string, answerAnchorKeywords: string[]): GeneratedAnswer {
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
