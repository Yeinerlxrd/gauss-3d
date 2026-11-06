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

function geminiApiPlugin(apiKey: string, model: string) {
  return {
    name: 'gemini-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/explain', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        if (!apiKey) {
          res.statusCode = 500
          res.end('GEMINI_API_KEY no está configurada en .env')
          return
        }

        try {
          const { problem } = await readJsonBody(req)
          if (!problem?.trim()) {
            res.statusCode = 400
            res.end('Escribe un ejercicio antes de evaluarlo')
            return
          }

          const request = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: 'Explica ejercicios de divergencia y el teorema de Gauss en español, con pasos matemáticos claros y breves.' }],
              },
              contents: [{ parts: [{ text: problem }] }],
              generationConfig: { temperature: 0.2 },
            }),
          }
          const endpoint = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`)
          endpoint.searchParams.set('key', apiKey)
          const response = await fetchWithTimeout(endpoint, request, 6000)

          if (!response) throw new Error('Gemini no devolvió una respuesta')
          const responseText = await response.text()
          let data: {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
            error?: { message?: string }
          }
          try {
            data = JSON.parse(responseText) as typeof data
          } catch {
            res.statusCode = 502
            res.end(`Gemini devolvió una respuesta no válida (HTTP ${response.status})`)
            return
          }
          if (!response.ok) {
            res.statusCode = response.status
            res.end(`Gemini rechazó la solicitud: ${data.error?.message ?? `HTTP ${response.status}`}. Modelo: ${model}`)
            return
          }

          const explanation = data.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('').trim()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ explanation: explanation || 'Gemini no devolvió una explicación' }))
        } catch (error) {
          res.statusCode = 500
          const message = error instanceof Error && error.name === 'AbortError'
            ? 'Gemini tardó más de 15 segundos en responder'
            : error instanceof Error ? error.message : 'error desconocido'
          res.end(`No se pudo conectar con Gemini: ${message}`)
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const model = (env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash')
    .replace(/^models\//, '')
    .replace(/flashs$/, 'flash')
  return {
    plugins: [react(), geminiApiPlugin(env.GEMINI_API_KEY?.trim() ?? '', model)],
  }
})
