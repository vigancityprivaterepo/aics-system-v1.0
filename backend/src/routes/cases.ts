import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireAuth } from '../middleware/auth.js'
import { listCases, getCase, createCase, updateCase, deleteCase, pendingApprovalsByType, generateFindings } from '../controllers/caseController.js'
import { updateStatus } from '../controllers/caseApprovalController.js'
import { caseStudyDocx, caseStudyPdf, guaranteeLetterPdf, guaranteeLetterDocx, endorsementDocx, acknowledgementDocx } from '../controllers/caseDocumentController.js'
import { getMedicines, saveMedicines, deleteMedicine } from '../controllers/caseMedicineController.js'
import { getRequirements, updateRequirements, patchRequirement } from '../controllers/caseRequirementController.js'
import { getBurial, updateBurial, uploadBurialGl, getHospital, updateHospital, uploadHospitalGl, updateMedical, uploadMedicalGl, updateEyeglass, updatePlain } from '../controllers/caseDetailsController.js'
import { resolveFromUploads } from '../utils/paths.js'

const router = Router()

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, resolveFromUploads('signed-gl')),
    filename: (_req, file, cb) => {
      const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      cb(null, `${Date.now()}-${safeOriginal}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
})

// ── Core CRUD ───────────────────────────────────────────────────────────────
router.get('/', asyncHandler(listCases))
router.post('/', asyncHandler(createCase))
router.get('/pending-approvals-by-type', requireAuth, asyncHandler(pendingApprovalsByType))
router.get('/:id', asyncHandler(getCase))
router.put('/:id', asyncHandler(updateCase))
router.delete('/:id', asyncHandler(deleteCase))

// ── Workflow ────────────────────────────────────────────────────────────────
router.patch('/:id/status', asyncHandler(updateStatus))
router.post('/:id/generate-findings', asyncHandler(generateFindings))

// ── Requirements ────────────────────────────────────────────────────────────
router.get('/:id/requirements', asyncHandler(getRequirements))
router.put('/:id/requirements', asyncHandler(updateRequirements))
router.patch('/:id/requirements/:reqId', asyncHandler(patchRequirement))

// ── Medicines ───────────────────────────────────────────────────────────────
router.get('/:id/medicines', asyncHandler(getMedicines))
router.post('/:id/medicines', asyncHandler(saveMedicines))
router.delete('/:id/medicines/:medId', asyncHandler(deleteMedicine))

// ── Type-specific details ────────────────────────────────────────────────────
router.get('/:id/burial', asyncHandler(getBurial))
router.put('/:id/burial', asyncHandler(updateBurial))
router.post('/:id/burial/upload-gl', upload.single('file'), asyncHandler(uploadBurialGl))

router.get('/:id/hospital', asyncHandler(getHospital))
router.put('/:id/hospital', asyncHandler(updateHospital))
router.post('/:id/hospital/upload-gl', upload.single('file'), asyncHandler(uploadHospitalGl))

router.put('/:id/medical', asyncHandler(updateMedical))
router.post('/:id/medical/upload-gl', upload.single('file'), asyncHandler(uploadMedicalGl))

router.put('/:id/eyeglass', asyncHandler(updateEyeglass))
router.put('/:id/plain', asyncHandler(updatePlain))

// ── Documents ───────────────────────────────────────────────────────────────
router.get('/:id/report/docx', asyncHandler(caseStudyDocx))
router.get('/:id/report/pdf', asyncHandler(caseStudyPdf))
router.get('/:id/guarantee-letter/pdf', asyncHandler(guaranteeLetterPdf))
router.get('/:id/report/gl-docx', asyncHandler(guaranteeLetterDocx))
router.get('/:id/report/endorsement-docx', asyncHandler(endorsementDocx))
router.get('/:id/report/acknowledgement-docx', asyncHandler(acknowledgementDocx))

export default router
