import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../utils/httpError.js'
import { logger } from '../utils/logger.js'

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, 'Route not found'))
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      issues: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json(
      err.details && typeof err.details === 'object'
        ? { message: err.message, ...(err.details as Record<string, unknown>) }
        : { message: err.message }
    )
  }

  logger.withError('Unhandled request error', err, {
    method: _req.method,
    path: _req.originalUrl,
  })
  return res.status(500).json({ message: 'Internal server error' })
}
