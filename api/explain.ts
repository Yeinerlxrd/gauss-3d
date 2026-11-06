import type { IncomingMessage, ServerResponse } from 'node:http'

type ExplainRequest = { problem?: string }
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
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

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  const model = (process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash')
    .replace(/^models\//, '')
    .replace(/flashs$/, 'flash')
  if (!apiKey) {
    res.statusCode = 500
    res.end('GEMINI_API_KEY no está configurada')
    return
  }

  try {
    const { problem } = await readJsonBody(req)
    if (!problem?.trim()) {
      res.statusCode = 400
      res.end('Escribe un ejercicio antes de evaluarlo')
      return
    }

    const endpoint = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`)
    endpoint.searchParams.set('key', apiKey)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'Explica ejercicios de divergencia y el teorema de Gauss en español, con pasos matemáticos claros y breves.' }],
        },
        contents: [{ parts: [{ text: problem }] }],
        generationConfig: { temperature: 0.2 },
      }),
    })

    const data = await response.json() as GeminiResponse
    if (!response.ok) {
      res.statusCode = response.status
      res.end(`Gemini rechazó la solicitud: ${data.error?.message ?? `HTTP ${response.status}`}`)
      return
    }

    const explanation = data.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('').trim()
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ explanation: explanation || 'Gemini no devolvió una explicación' }))
  } catch (error) {
    res.statusCode = 500
    res.end(`No se pudo conectar con Gemini: ${error instanceof Error ? error.message : 'error desconocido'}`)
  }
}
