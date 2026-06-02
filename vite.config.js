import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function claudeApiPlugin(apiKey) {
  return {
    name: 'claude-api',
    configureServer(server) {
      server.middlewares.use('/api/claude', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in .env.local' }))
          return
        }

        let body
        try {
          body = await new Promise((resolve, reject) => {
            let raw = ''
            req.on('data', chunk => { raw += chunk })
            req.on('end', () => { try { resolve(JSON.parse(raw)) } catch (e) { reject(e) } })
            req.on('error', reject)
          })
        } catch {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Invalid JSON body' }))
          return
        }

        const { messages, system, maxTokens = 1500 } = body

        let upstream
        try {
          upstream = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: maxTokens,
              stream: true,
              system,
              messages,
            }),
          })
        } catch (err) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: err.message }))
          return
        }

        if (!upstream.ok) {
          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json')
          res.end(text)
          return
        }

        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        const reader = upstream.body.getReader()
        const decoder = new TextDecoder()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done || res.destroyed) break
            res.write(decoder.decode(value, { stream: true }))
          }
        } finally {
          reader.releaseLock()
          res.end()
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), claudeApiPlugin(env.ANTHROPIC_API_KEY)],
  }
})
