import type { Request, Response } from 'express'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { assertCaseReadable, paramId } from '../services/caseService.js'
import { buildCaseHistoryTimeline } from '../services/caseRecordsService.js'

export async function getCaseHistory(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      status: true,
      socialWorkerId: true,
      assistanceType: true,
      isArchived: true,
      approvals: {
        select: {
          actedByUserId: true,
        },
      },
    },
  })

  if (!caseData) throw new HttpError(404, 'Case not found')
  assertCaseReadable(caseData, req.user, 'Case history')

  res.json(await buildCaseHistoryTimeline(prisma, caseId))
}
