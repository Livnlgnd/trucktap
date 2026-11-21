import { app } from './app.js'
import { config } from './config.js'
import { db } from './db.js'

const server = app.listen(config.port, config.host, () => {
  const displayHost = config.host === '0.0.0.0' ? 'localhost' : config.host
  console.log(`TruckTap API listening at http://${displayHost}:${config.port}`)
  console.log(`Database: ${config.databasePath}`)

  if (config.usingDefaultJwtSecret) {
    console.warn(
      'WARNING: JWT_SECRET is not set. Set it before exposing this server.',
    )
  }
})

function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down TruckTap API.`)
  server.close(() => {
    db.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
