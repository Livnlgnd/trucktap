const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
  'https://trucktap.net',
  'https://www.trucktap.net',
  'https://livnlgnd.github.io',
  'trucktap://app',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost',
  'https://trucktap-blush.vercel.app',
  'https://sync.trucktap.net',
  'null',
]

function allowedOrigins(): string[] {
  const configured =
    process.env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  return [...new Set([...DEFAULT_ORIGINS, ...configured])]
}

export class HttpError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers()
  const origin = request.headers.get('origin')
  if (origin && allowedOrigins().includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
    headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS',
    )
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization',
    )
    headers.set('Access-Control-Max-Age', '600')
  }
  headers.set('Cache-Control', 'no-store')
  return headers
}

export function json(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  const headers = corsHeaders(request)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status, headers })
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new HttpError('Request body must be valid JSON.', 400)
  }
}

export function api(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      return await handler(request)
    } catch (error) {
      const status =
        error &&
        typeof error === 'object' &&
        'status' in error &&
        typeof error.status === 'number'
          ? error.status
          : 500
      if (status >= 500) {
        console.error('TruckTap API error:', error)
      }
      return json(
        request,
        {
          error:
            error instanceof Error
              ? error.message
              : 'The server could not complete that request.',
        },
        status,
      )
    }
  }
}
