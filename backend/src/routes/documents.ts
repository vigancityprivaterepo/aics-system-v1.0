import { Router } from 'express'
import { verifyGuaranteeLetterDocument } from '../controllers/documentVerificationController.js'
import { openSignWebhook } from '../controllers/openSignController.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.post('/opensign/webhook', asyncHandler(openSignWebhook))
router.get('/verify/:token', asyncHandler(verifyGuaranteeLetterDocument))
router.get('/verify', asyncHandler(verifyGuaranteeLetterDocument))

export default router

