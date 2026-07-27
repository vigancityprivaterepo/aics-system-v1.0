import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { UserRole } from '@prisma/client'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'
import { prisma } from '../utils/prisma.js'

interface JwtPayload {
  sub: string
  name: string
  email: string
  employeeId: string
  role: UserRole
  approvalLevel?: string[]
}

const VALID_ROLES: UserRole[] = ['admin', 'employee', 'city_health_office']
const APPROVAL_LEVEL_VALUES = ['reviewer', 'recommender', 'approver', 'preparer'] as const

function validateRole(role: string): UserRole {
  if (VALID_ROLES.includes(role as UserRole)) return role as UserRole
  throw new HttpError(401, `Unrecognized role in token: ${role}`)
}

function parseApprovalLevels(stored: string | null | undefined): string[] {
  if (!stored || stored === 'none') return []
  return stored
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is string => APPROVAL_LEVEL_VALUES.includes(value as typeof APPROVAL_LEVEL_VALUES[number]))
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Unauthorized'))
  }

  const token = authHeader.slice('Bearer '.length)
  void (async () => {
    let payload: JwtPayload
    try {
      payload = jwt.verify(token, env.jwtSecret) as JwtPayload
    } catch {
      throw new HttpError(401, 'Invalid or expired token')
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        approvalLevel: true,
        isActive: true,
      },
    })

    if (!dbUser || !dbUser.isActive) {
      throw new HttpError(401, 'Account is inactive or no longer available')
    }

    req.user = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      employeeId: dbUser.employeeId,
      role: validateRole(String(dbUser.role)),
      approvalLevel: parseApprovalLevels(dbUser.approvalLevel),
    }
    next()
  })().catch(next)
}

export function requireRole(roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Unauthorized'))
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Forbidden'))
    return next()
  }
}
