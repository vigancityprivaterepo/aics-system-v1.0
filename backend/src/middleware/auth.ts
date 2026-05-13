import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { UserRole } from '@prisma/client'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

interface JwtPayload {
  sub: string
  name: string
  email: string
  employeeId: string
  role: UserRole
}

const VALID_ROLES: UserRole[] = ['admin', 'employee', 'city_health_office']

function validateRole(role: string): UserRole {
  if (VALID_ROLES.includes(role as UserRole)) return role as UserRole
  throw new HttpError(401, `Unrecognized role in token: ${role}`)
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Unauthorized'))
  }

  const token = authHeader.slice('Bearer '.length)
  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload
    req.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      employeeId: payload.employeeId,
      role: validateRole(String(payload.role)),
    }
    return next()
  } catch {
    return next(new HttpError(401, 'Invalid or expired token'))
  }
}

export function requireRole(roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Unauthorized'))
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Forbidden'))
    return next()
  }
}
