import { FastifyInstance } from 'fastify'
import { saveOmlFile, loadOmlFile } from '../services/fileService.js'

export default async function filesRoutes(fastify: FastifyInstance) {
  // 保存图谱为 .oml 文件
  fastify.post('/save', async (request, reply) => {
    try {
      const { nodes, edges, regions, name } = request.body as any

      if (!nodes || !Array.isArray(nodes)) {
        return reply.code(400).send({ error: 'Invalid nodes data' })
      }

      const base64Data = await saveOmlFile({
        nodes,
        edges: edges || [],
        regions: regions || [],
        name: name || 'Untitled'
      })

      return { data: base64Data }
    } catch (error) {
      console.error('Error saving file:', error)
      return reply.code(500).send({ error: 'Failed to save file' })
    }
  })

  // 加载 .oml 文件
  fastify.post('/load', async (request, reply) => {
    try {
      const { data } = request.body as any

      if (!data || typeof data !== 'string') {
        return reply.code(400).send({ error: 'Invalid file data' })
      }

      const graphData = await loadOmlFile(data)

      return graphData
    } catch (error) {
      console.error('Error loading file:', error)
      return reply.code(500).send({ error: 'Failed to load file' })
    }
  })
}
