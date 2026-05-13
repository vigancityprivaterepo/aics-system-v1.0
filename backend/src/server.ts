import './config/env.js'
import app from './app.js'
import { env, getProductionConfigErrors } from './config/env.js'
import { initStorageDirs } from './services/storageService.js'
import { prisma } from './utils/prisma.js'
import { logger } from './utils/logger.js'

process.on('unhandledRejection', (reason) => {
  logger.withError('Unhandled promise rejection', reason)
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  logger.withError('Uncaught exception', err)
  process.exit(1)
})

async function start() {
  const configErrors = getProductionConfigErrors()
  if (configErrors.length > 0) {
    logger.error('Production configuration validation failed', { issues: configErrors })
    process.exit(1)
  }

  try {
    await prisma.$connect()
    logger.info('Database connected')
  } catch (err) {
    logger.withError('Fatal startup error: database connection failed', err)
    process.exit(1)
  }

  initStorageDirs()

  if (!env.smtpHost || !env.smtpUser) {
    logger.warn('SMTP not configured; email delivery is disabled outside production')
  }
  if (!env.semaphoreApiKey) {
    logger.warn('Semaphore SMS not configured; SMS delivery is disabled outside production')
  }
  if (!env.anthropicApiKey) {
    logger.warn('Anthropic AI findings assist disabled')
  }
  if (env.rateLimitMode === 'memory') {
    logger.warn('Rate limiting is using in-memory storage; deploy as a single backend instance only')
  }

  const server = app.listen(env.port, () => {
    logger.info('AICS backend listening', {
      port: env.port,
      nodeEnv: env.nodeEnv,
      apiBaseUrl: env.apiBaseUrl,
    })
  })

  const shutdown = async () => {
    logger.info('Graceful shutdown initiated')

    const timer = setTimeout(() => {
      logger.error('Forced exit after shutdown timeout')
      process.exit(1)
    }, 10_000)
    timer.unref()

    server.close(async () => {
      await prisma.$disconnect()
      clearTimeout(timer)
      logger.info('Shutdown complete')
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

start()
