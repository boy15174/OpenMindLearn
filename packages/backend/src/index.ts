import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from 'dotenv'
import { nodeRoutes } from './routes/nodes.js'
import filesRoutes from './routes/files.js'

config()

const fastify = Fastify({ logger: true })

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
