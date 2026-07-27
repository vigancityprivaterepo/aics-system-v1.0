import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'
import { prisma } from '../utils/prisma.js'

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
  void (async () => {
    let payload: PortalJwtPayload
    try {
      payload = jwt.verify(token, env.portalJwtSecret) as PortalJwtPayload
    } catch {
      throw new HttpError(401, 'Invalid or expired token')
    }

    if (payload.type !== 'applicant') {
      throw new HttpError(401, 'Invalid token type')
    }

    const applicant = await prisma.applicant.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isVerified: true,
      },
    })

    if (!applicant || !applicant.isVerified) {
      throw new HttpError(401, 'Account is unavailable or no longer verified')
    }

    req.applicant = {
      id: applicant.id,
      email: applicant.email,
      firstName: applicant.firstName,
      lastName: applicant.lastName,
    }
    next()
  })().catch(next)
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
