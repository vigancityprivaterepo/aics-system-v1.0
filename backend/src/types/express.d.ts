import type { UserRole } from '@prisma/client'

declare global {
  namespace Express {
    interface AuthUser {
      id: string
      name: string
      email: string
      employeeId: string
      role: UserRole
    }

    interface PortalApplicant {
      id: string
      email: string
      firstName: string
      lastName: string
    }

    interface Request {
      user?: AuthUser
      applicant?: PortalApplicant
    }
  }
}

export {}