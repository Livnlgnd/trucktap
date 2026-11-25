import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SERVER_ROOT = path.resolve(currentDir, '..')

try {
  process.loadEnvFile(path.join(SERVER_ROOT, '.env'))
} catch {
  // .env is optional; defaults below support local development.
}

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
  'trucktap://app',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost',
  'https://trucktap-blush.vercel.app',
  'https://sync.trucktap.net',
  'null',
]

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? '0.0.0.0',
  databasePath: path.resolve(
    SERVER_ROOT,
    process.env.DATABASE_PATH ?? './data/trucktap.db',
  ),
  jwtSecret:
    process.env.JWT_SECRET ??
    'trucktap-local-development-secret-change-before-deploying',
  usingDefaultJwtSecret: !process.env.JWT_SECRET,
  tokenTtlSeconds: 60 * 60 * 24 * 30,
  allowedOrigins: (
    process.env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? defaultOrigins
  ),
  webDist: path.resolve(
    SERVER_ROOT,
    process.env.WEB_DIST ??
      (fs.existsSync(path.resolve(SERVER_ROOT, '../dist'))
        ? '../dist'
        : './public'),
  ),
  isProduction: process.env.NODE_ENV === 'production',
}
