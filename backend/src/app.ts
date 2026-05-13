import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { requireAuth } from './middleware/auth.js'
import { requirePortalAuth } from './middleware/portalAuth.js'
import { env } from './config/env.js'
import { uploadsRoot } from './utils/paths.js'

const app = express()

app.set('trust proxy', env.trustProxy)

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

const allowedOrigins = env.corsOrigin
  ? env.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
  : []

function isPrivateIpv4Host(hostname: string) {
  if (/^127(?:\.\d{1,3}){3}$/.test(hostname)) return true
  if (/^10(?:\.\d{1,3}){3}$/.test(hostname)) return true
  if (/^192\.168(?:\.\d{1,3}){2}$/.test(hostname)) return true

  const match = hostname.match(/^172\.(\d{1,3})(?:\.\d{1,3}){2}$/)
  if (!match) return false

  const secondOctet = Number(match[1])
  return secondOctet >= 16 && secondOctet <= 31
}

function isAllowedDevelopmentOrigin(origin: string) {
  if (env.nodeEnv === 'production') return false

  try {
    const parsed = new URL(origin)
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    const isLocalHost = ['localhost', '127.0.0.1'].includes(parsed.hostname)
    const isPrivateIp = isPrivateIpv4Host(parsed.hostname)
    const isVitePort = ['5173', '5174', '4173'].includes(parsed.port)

    return isHttp && isVitePort && (isLocalHost || isPrivateIp)
  } catch {
    return false
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)

      if (allowedOrigins.includes(origin)) return callback(null, true)
      if (isAllowedDevelopmentOrigin(origin)) return callback(null, true)

      if (allowedOrigins.length === 0) {
        if (env.nodeEnv !== 'production') return callback(null, true)
        return callback(new Error('CORS: CORS_ORIGIN is not set - all origins blocked in production'))
      }

      return callback(new Error(`CORS: origin ${origin} is not allowed`))
    },
    credentials: true,
  }),
)

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))

app.use('/uploads', (req, res, next) => {
  // Display assets rendered in img tags cannot include auth headers.
  if (req.path.startsWith('/profile-photos/')) return next()
  if (req.path.startsWith('/e-signatures/')) return next()

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' })
  requireAuth(req, res, (err) => {
    if (!err) return next()
    requirePortalAuth(req, res, next)
  })
}, express.static(uploadsRoot))

app.use('/api', routes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
