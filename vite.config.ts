import { defineConfig, loadEnv, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

async function readJsonBody(req: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as { problem?: string }
}

async function fetchWithTimeout(url: URL, init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function groqApiPlugin(apiKey: string, model: string) {
  return {
    name: 'groq-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/explain', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        if (!apiKey) {
          res.statusCode = 500
          res.end('GROQ_API_KEY no está configurada en .env')
          return
        }

        try {
          const { problem } = await readJsonBody(req)
          if (!problem?.trim()) {
            res.statusCode = 400
            res.end('Escribe un ejercicio antes de evaluarlo')
            return
          }

          const request: RequestInit = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: 'Explica ejercicios de divergencia y el teorema de Gauss en español, con pasos matemáticos claros y breves.' },
                { role: 'user', content: problem },
              ],
              temperature: 0.2,
            }),
          }
          const endpoint = new URL('https://api.groq.com/openai/v1/chat/completions')
          const response = await fetchWithTimeout(endpoint, request)
          const responseText = await response.text()
          let data: {
            choices?: Array<{ message?: { content?: string } }>
            error?: { message?: string }
          }
          try {
            data = JSON.parse(responseText) as typeof data
          } catch {
            res.statusCode = 502
            res.end(`Groq devolvió una respuesta no válida (HTTP ${response.status})`)
            return
          }
          if (!response.ok) {
            res.statusCode = response.status
            res.end(`Groq rechazó la solicitud: ${data.error?.message ?? `HTTP ${response.status}`}. Modelo: ${model}`)
            return
          }

          const explanation = data.choices?.[0]?.message?.content?.trim()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ explanation: explanation || 'Groq no devolvió una explicación' }))
        } catch (error) {
          res.statusCode = 500
          const message = error instanceof Error && error.name === 'AbortError'
            ? 'Groq tardó más de 15 segundos en responder'
            : error instanceof Error ? error.message : 'error desconocido'
          res.end(`No se pudo conectar con Groq: ${message}`)
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const model = env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b'
  return {
    plugins: [react(), groqApiPlugin(env.GROQ_API_KEY?.trim() ?? '', model)],
  }
})
