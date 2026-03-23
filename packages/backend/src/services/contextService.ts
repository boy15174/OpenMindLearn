import { Node } from '../types/index.js'

/**
 * 根据 parentId 回溯节点链（最多指定深度）
 */
export function buildContextChain(
  parentId: string,
  allNodes: Node[],
  maxDepth: number = 10
): Node[] {
  const chain: Node[] = []
  const nodeMap = new Map(allNodes.map(n => [n.id, n]))

  let currentId: string | null = parentId
  let depth = 0

  while (currentId && depth < maxDepth) {
    const node = nodeMap.get(currentId)
    if (!node) break

    chain.unshift(node) // 添加到开头，保持从根到当前的顺序

    // 获取第一个父节点（如果有多个父节点，只取第一个）
    currentId = node.parentIds && node.parentIds.length > 0
      ? node.parentIds[0]
      : null

    depth++
  }

  return chain
}

/**
 * 生成 XML 格式的上下文
 */
export function generateContextXml(nodes: Node[]): string {
  if (nodes.length === 0) {
    return '<context></context>'
  }

  const nodeElements = nodes.map(node => {
    // 转义 XML 特殊字符
    const escapedContent = escapeXml(node.content)
    return `  <node id="${node.id}">
    <content>${escapedContent}</content>
  </node>`
  }).join('\n')

  return `<context>
${nodeElements}
</context>`
}

/**
 * 转义 XML 特殊字符
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
