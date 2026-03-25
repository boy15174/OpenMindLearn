import type { SourceHighlight } from '../types/canvas'

export function getSelectionOffsets(container: HTMLElement, range: Range): { start: number; end: number } {
  const preRange = range.cloneRange()
  preRange.selectNodeContents(container)
  preRange.setEnd(range.startContainer, range.startOffset)
  const start = preRange.toString().length
  const end = start + range.toString().length
  return { start, end }
}

export function getContainerPlainText(container: HTMLElement): string {
  const range = document.createRange()
  range.selectNodeContents(container)
  return range.toString()
}

export function clearSourceHighlightMarks(container: HTMLElement) {
  const marks = container.querySelectorAll('mark[data-source-highlight="true"]')
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark)
    }
    parent.removeChild(mark)
    parent.normalize()
  })
}

export function applySourceHighlightByRanges(container: HTMLElement, highlights: SourceHighlight[]) {
  if (highlights.length === 0) return

  const sortedHighlights = [...highlights].sort((a, b) => a.rangeStart - b.rangeStart)
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text
    if (!textNode.nodeValue) continue
    if (textNode.parentElement?.closest('mark[data-source-highlight="true"]')) continue
    textNodes.push(textNode)
  }

  let nodeStartOffset = 0
  textNodes.forEach((textNode) => {
    const originalText = textNode.nodeValue || ''
    const nodeEndOffset = nodeStartOffset + originalText.length
    const active = sortedHighlights.filter(
      h => h.rangeStart < nodeEndOffset && h.rangeEnd > nodeStartOffset
    )

    if (active.length === 0) {
      nodeStartOffset = nodeEndOffset
      return
    }

    const fragment = document.createDocumentFragment()
    let cursor = 0

    active.forEach((highlight) => {
      const localStart = Math.max(0, highlight.rangeStart - nodeStartOffset)
      const localEnd = Math.min(originalText.length, highlight.rangeEnd - nodeStartOffset)
      if (localEnd <= localStart) return
      if (localStart > cursor) {
        fragment.appendChild(document.createTextNode(originalText.slice(cursor, localStart)))
      }

      const mark = document.createElement('mark')
      mark.setAttribute('data-source-highlight', 'true')
      mark.style.backgroundColor = `${highlight.color}33`
      mark.style.color = 'inherit'
      mark.style.padding = '0 1px'
      mark.style.borderRadius = '2px'
      mark.textContent = originalText.slice(localStart, localEnd)
      fragment.appendChild(mark)
      cursor = Math.max(cursor, localEnd)
    })

    if (cursor < originalText.length) {
      fragment.appendChild(document.createTextNode(originalText.slice(cursor)))
    }

    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode)
    }

    nodeStartOffset = nodeEndOffset
  })
}
