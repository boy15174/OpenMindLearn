import { FastifyInstance } from 'fastify'
import { buildExpandPrompt, generateContent, generateWithContext, getLLMConfig, setLLMConfig } from '../services/llm.js'
import { buildContextChain, generateContextXml } from '../services/contextService.js'
import { Node, SourceReference } from '../types/index.js'

export async function nodeRoutes(fastify: FastifyInstance) {
  fastify.post('/api/nodes/generate', async (request, reply) => {
    const { prompt } = request.body as { prompt: string }
    const content = await generateContent(prompt)
    return { id: Date.now().toString(), content }
  })

  fastify.post('/api/nodes/expand', async (request, reply) => {
    const { text, parentId, allNodes, selectedNodeIds, sourceRef, expandMode, contextMaxDepth } = request.body as {
      text: string
      parentId: string
      allNodes?: Node[]
      selectedNodeIds?: string[]
      sourceRef?: SourceReference
      expandMode?: 'direct' | 'targeted' | 'custom_context'
      contextMaxDepth?: number
    }

    let content: string
    const resolvedDepth = Math.max(1, Math.min(50, Number.isFinite(contextMaxDepth)
      ? Number(contextMaxDepth)
      : getLLMConfig().contextMaxDepth))
    const finalPrompt = buildExpandPrompt(text, expandMode || 'direct')

    // 如果提供了 allNodes，则使用上下文
    if (allNodes && allNodes.length > 0) {
      let contextNodes: Node[]

      // 如果提供了 selectedNodeIds，使用手动选择的节点
      if (selectedNodeIds && selectedNodeIds.length > 0) {
        const nodeMap = new Map(allNodes.map((node) => [node.id, node]))
        contextNodes = selectedNodeIds
          .map((id) => nodeMap.get(id))
          .filter((node): node is Node => Boolean(node))
      } else {
        // 否则自动回溯父节点链（根据配置深度）
        contextNodes = buildContextChain(parentId, allNodes, resolvedDepth)
      }

      // 生成 XML 格式上下文
      const contextXml = generateContextXml(contextNodes)

      // 使用带上下文的生成
      content = await generateWithContext(finalPrompt, contextXml)
    } else {
      // 没有上下文，直接生成
      content = await generateContent(finalPrompt)
    }

    return {
      id: Date.now().toString(),
      content,
      question: text,
      parentId,
      sourceRef
    }
  })

  fastify.post('/api/config/llm', async (request, reply) => {
    const { apiKey, baseURL, model, temperature, maxTokens, contextMaxDepth, systemPrompt, promptTemplates } = request.body as {
      apiKey: string
      baseURL: string
      model: string
      temperature?: number
      maxTokens?: number
      contextMaxDepth?: number
      systemPrompt?: string
      promptTemplates?: {
        directExpand?: string
        targetedQuestion?: string
        customContextExpand?: string
        contextEnvelope?: string
      }
    }
    setLLMConfig({ apiKey, baseURL, model, temperature, maxTokens, contextMaxDepth, systemPrompt, promptTemplates })
    return { success: true }
  })
}
