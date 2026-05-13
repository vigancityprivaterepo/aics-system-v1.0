import { Router } from 'express'
import { verifyGuaranteeLetterDocument } from '../controllers/documentVerificationController.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.get('/verify/:token', asyncHandler(verifyGuaranteeLetterDocument))
router.get('/verify', asyncHandler(verifyGuaranteeLetterDocument))

export default router
