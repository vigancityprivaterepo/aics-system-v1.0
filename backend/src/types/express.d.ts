import type { UserRole } from '@prisma/client'
import type { StaffModuleKey } from '../services/moduleAccessService.js'

declare global {
  namespace Express {
    interface AuthUser {
      id: string
      name: string
      email: string
      employeeId: string
      role: UserRole
      approvalLevel: string[]
      position: string | null
      department: string | null
      accessibleModules: StaffModuleKey[]
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
