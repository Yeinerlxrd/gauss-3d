import type { IncomingMessage, ServerResponse } from 'node:http'

type ExplainRequest = { problem?: string }
type GroqResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as ExplainRequest
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    res.end('Método no permitido')
    return
  }

  const apiKey = process.env.GROQ_API_KEY?.trim()
  const model = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b'
  if (!apiKey) {
    res.statusCode = 500
    res.end('GROQ_API_KEY no está configurada')
    return
  }

  try {
    const { problem } = await readJsonBody(req)
    if (!problem?.trim()) {
      res.statusCode = 400
      res.end('Escribe un ejercicio antes de evaluarlo')
      return
    }

    const endpoint = new URL('https://api.groq.com/openai/v1/chat/completions')
    const response = await fetch(endpoint, {
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
    })

    const data = await response.json() as GroqResponse
    if (!response.ok) {
      res.statusCode = response.status
      res.end(`Groq rechazó la solicitud: ${data.error?.message ?? `HTTP ${response.status}`}`)
      return
    }

    const explanation = data.choices?.[0]?.message?.content?.trim()
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ explanation: explanation || 'Groq no devolvió una explicación' }))
  } catch (error) {
    res.statusCode = 500
    res.end(`No se pudo conectar con Groq: ${error instanceof Error ? error.message : 'error desconocido'}`)
  }
}
