import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from 'dotenv'
import { nodeRoutes } from './routes/nodes.js'
import filesRoutes from './routes/files.js'

config()

// .oml 使用 base64 传输，体积会比原始 ZIP 增大，带图片时需要更高上限
const fastify = Fastify({ logger: true, bodyLimit: 60 * 1024 * 1024 })

await fastify.register(cors)
await fastify.register(nodeRoutes)
await fastify.register(filesRoutes, { prefix: '/api/files' })

const start = async () => {
  try {
    await fastify.listen({ port: 3000 })
    console.log('Backend running on http://localhost:3000')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
