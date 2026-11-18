import { z } from 'zod'

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

export function json<T>(body: T, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function sameOrigin(request: Request, url: URL, required = false) {
  const origin = request.headers.get('Origin')
  if (origin ? origin !== url.origin : required || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    throw new HttpError(403, 'This request must come from Whiteboard.')
  }
}

export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
    throw new HttpError(415, 'Expected JSON.')
  }
  const reader = request.body?.getReader()
  if (!reader) throw new HttpError(400, 'Missing request data.')
  const decoder = new TextDecoder()
  let raw = ''
  let bytes = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > 8_192) {
      await reader.cancel()
      throw new HttpError(413, 'Request data is too large.')
    }
    raw += decoder.decode(value, { stream: true })
  }
  try {
    return schema.parse(JSON.parse(raw + decoder.decode()))
  } catch {
    throw new HttpError(400, 'Check the request data.')
  }
}
