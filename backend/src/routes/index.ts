import { Router } from 'express'
import authRoutes from './auth.js'
import clientRoutes from './clients.js'
import caseRoutes from './cases.js'
import medicineRoutes from './medicines.js'
import hospitalRoutes from './hospitals.js'
import dashboardRoutes from './dashboard.js'
import userRoutes from './users.js'
import reportRoutes from './reports.js'
import settingsRoutes from './settings.js'
import funeralHomesRoutes from './funeralHomes.js'
import portalAuthRoutes from './portalAuth.js'
import portalApplicationsRoutes from './portalApplications.js'
import applicantApplicationsRoutes from './applicantApplications.js'
import applicantsRoutes from './applicants.js'
import documentRoutes from './documents.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { getReadinessStatus } from '../services/healthService.js'

const router = Router()

router.get('/health/live', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

router.get('/health/ready', async (_req, res) => {
  const readiness = await getReadinessStatus()
  if (readiness.ok) {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
    return
  }

  res.status(503).json({
    status: 'error',
    issues: readiness.issues,
    timestamp: new Date().toISOString(),
  })
})

router.get('/health', async (_req, res) => {
  const readiness = await getReadinessStatus()
  res.status(readiness.ok ? 200 : 503).json({
    status: readiness.ok ? 'ok' : 'error',
    ...(readiness.ok ? {} : { issues: readiness.issues }),
    timestamp: new Date().toISOString(),
  })
})

// Public: staff auth
router.use('/auth', authRoutes)

// Public + protected: applicant portal auth
router.use('/portal/auth', portalAuthRoutes)
router.use('/portal/applications', portalApplicationsRoutes)
router.use('/documents', documentRoutes)

router.use(requireAuth)
router.use('/medicines', requireRole(['admin', 'employee', 'city_health_office']), medicineRoutes)
router.use('/hospitals', requireRole(['admin', 'employee', 'city_health_office']), hospitalRoutes)
router.use('/users', userRoutes)
router.use('/applicants', applicantsRoutes)
router.use(requireRole(['admin', 'employee']))
router.use('/clients', clientRoutes)
router.use('/cases', caseRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/reports', reportRoutes)
router.use('/settings', settingsRoutes)
router.use('/funeral-homes', funeralHomesRoutes)
router.use('/applicant-applications', applicantApplicationsRoutes)

export default router
