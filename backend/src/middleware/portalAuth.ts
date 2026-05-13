import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

interface PortalJwtPayload {
  sub: string
  email: string
  firstName: string
  lastName: string
  type: 'applicant'
}

export function requirePortalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Unauthorized'))
  }

  const token = authHeader.slice('Bearer '.length)
  try {
    const payload = jwt.verify(token, env.portalJwtSecret) as PortalJwtPayload
    if (payload.type !== 'applicant') {
      return next(new HttpError(401, 'Invalid token type'))
    }
    req.applicant = {
      id: payload.sub,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
    }
    return next()
  } catch {
    return next(new HttpError(401, 'Invalid or expired token'))
  }
}

export function signPortalToken(applicant: { id: string; email: string; firstName: string; lastName: string }) {
  return jwt.sign(
    {
      sub: applicant.id,
      email: applicant.email,
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      type: 'applicant',
    },
    env.portalJwtSecret,
    { expiresIn: env.portalJwtExpiresIn as jwt.SignOptions['expiresIn'] }
  )
}
