import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './config.js'
import { authRouter } from './routes/auth.js'
import { orgRouter } from './routes/org.js'
import { syncRouter } from './routes/sync.js'
import { workspaceRouter } from './routes/workspace.js'

export const app = express()

app.disable('x-powered-by')

app.use(
  helmet({
    contentSecurityPolicy: config.isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://fonts.googleapis.com',
            ],
            imgSrc: ["'self'", 'data:'],
            fontSrc: [
              "'self'",
              'data:',
              'https://fonts.gstatic.com',
            ],
            connectSrc: ["'self'"],
            manifestSrc: ["'self'"],
            workerSrc: ["'self'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
    strictTransportSecurity: config.isProduction ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }),
)

app.use(
  cors({
    origin(origin, callback) {
      callback(
        null,
        !origin || config.allowedOrigins.includes(origin),
      )
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }),
)

app.use(express.json({ limit: '4mb' }))

app.use('/api', (_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'trucktap-api',
    version: '1.0.0',
    serverTime: new Date().toISOString(),
  })
})

app.use('/api/auth', authRouter)
app.use('/api/org', orgRouter)
app.use('/api/workspace', workspaceRouter)
app.use('/api/sync', syncRouter)

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API route not found.' })
})

const clientAvailable = fs.existsSync(
  path.join(config.webDist, 'index.html'),
)

if (clientAvailable) {
  app.use(
    express.static(config.webDist, {
      index: false,
      maxAge: '1h',
      setHeaders(response, filePath) {
        if (
          filePath.endsWith('sw.js') ||
          filePath.endsWith('index.html') ||
          filePath.endsWith('manifest.json')
        ) {
          response.setHeader('Cache-Control', 'no-cache')
        }
        if (filePath.endsWith('sw.js')) {
          response.setHeader('Service-Worker-Allowed', '/')
        }
      },
    }),
  )

  app.use((request, response, next) => {
    if (request.method !== 'GET') {
      next()
      return
    }
    response.sendFile(path.join(config.webDist, 'index.html'))
  })
} else {
  app.get('/', (_request, response) => {
    response.json({
      name: 'TruckTap API',
      status: 'ok',
      message: 'Build the PWA to serve the app from this server.',
    })
  })
}

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found.' })
})

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('Unhandled API error:', error)
    if (response.headersSent) return
    response.status(500).json({
      error: 'The server could not complete that request.',
    })
  },
)
