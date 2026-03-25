import type { DiffLine } from '../types/canvas'

export function parseTags(tagsText: string): string[] {
  const values = tagsText
    .split(/[,，\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
  return Array.from(new Set(values)).slice(0, 30)
}

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildDiffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split(/\r?\n/)
  const b = newText.split(/\r?\n/)
  const n = a.length
  const m = b.length

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ type: 'same', text: a[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: 'removed', text: a[i] })
      i += 1
    } else {
      lines.push({ type: 'added', text: b[j] })
      j += 1
    }
  }

  while (i < n) {
    lines.push({ type: 'removed', text: a[i] })
    i += 1
  }
  while (j < m) {
    lines.push({ type: 'added', text: b[j] })
    j += 1
  }

  return lines
}
