import { FastifyInstance } from 'fastify'
import { generateContent } from '../services/llm.js'

export async function nodeRoutes(fastify: FastifyInstance) {
  fastify.post('/api/nodes/generate', async (request, reply) => {
    const { prompt } = request.body as { prompt: string }
    const content = await generateContent(prompt)
    return { id: Date.now().toString(), content }
  })

  fastify.post('/api/nodes/expand', async (request, reply) => {
    const { text, parentId } = request.body as { text: string; parentId: string }
    const content = await generateContent(`请详细解释: ${text}`)
    return { id: Date.now().toString(), content, parentId }
  })
}
