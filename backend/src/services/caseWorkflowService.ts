import type { CaseStatus } from '@prisma/client'
import { REQUIREMENT_DEFINITIONS, normalizePlainAssistanceKinds } from '../utils/requirements.js'
import type { ApprovalAssigneeByStage } from '../types/caseTypes.js'
import { normalizeWorkflowStatus } from '../services/caseService.js'
import { richTextHasVisibleText } from '../utils/richText.js'

export type WorkflowQueue =
  | 'needs_intake'
  | 'needs_encoding'
  | 'ready_for_review'
  | 'waiting_for_recommender'
  | 'waiting_for_approver'
  | 'ready_for_release'
  | 'blocked_incomplete'
  | 'released'

const QUEUE_SLA_HOURS: Record<WorkflowQueue, number | null> = {
  needs_intake: 24,
  needs_encoding: 48,
  ready_for_review: 24,
  waiting_for_recommender: 24,
  waiting_for_approver: 24,
  ready_for_release: 48,
  blocked_incomplete: 24,
  released: null,
}

function textPresent(value: unknown) {
  return typeof value === 'string' ? richTextHasVisibleText(value) : value != null
}

function toPositiveNumber(value: unknown) {
  if (value == null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function addBlocker(blockers: string[], condition: boolean, message: string) {
  if (condition) blockers.push(message)
}

function latestWorkflowActivity(caseRow: any) {
  const latestLog = Array.isArray(caseRow.statusLogs) ? caseRow.statusLogs[0] : null
  const changedAt = latestLog?.changedAt ? new Date(latestLog.changedAt) : null
  const updatedAt = caseRow.updatedAt ? new Date(caseRow.updatedAt) : null
  const createdAt = caseRow.createdAt ? new Date(caseRow.createdAt) : null
  return changedAt ?? updatedAt ?? createdAt ?? new Date()
}

function isPortalOriginCase(caseRow: any) {
  if (caseRow?.applicantApplication?.id) return true
  const auditFlags =
    caseRow?.auditFlags && typeof caseRow.auditFlags === 'object' && !Array.isArray(caseRow.auditFlags)
      ? caseRow.auditFlags
      : null
  return typeof auditFlags?.portal_application_id === 'string' && auditFlags.portal_application_id.trim().length > 0
}

function missingRequirementLabels(caseRow: any) {
  const definitions = REQUIREMENT_DEFINITIONS[caseRow.assistanceType as keyof typeof REQUIREMENT_DEFINITIONS] ?? []
  const rows = Array.isArray(caseRow.requirements) ? caseRow.requirements : []
  const submittedByKey = new Map(rows.map((row: any) => [row.requirementName, Boolean(row.isSubmitted)]))
  return definitions
    .filter((requirement) => submittedByKey.get(requirement.key) !== true)
    .map((requirement) => requirement.label)
}

export function assessCaseWorkflow(caseRow: any, assigneesByStage?: ApprovalAssigneeByStage) {
  const status = normalizeWorkflowStatus(caseRow.status as CaseStatus)
  const blockers: string[] = []
  const portalOrigin = isPortalOriginCase(caseRow)

  addBlocker(blockers, !textPresent(caseRow.client?.firstName) || !textPresent(caseRow.client?.lastName), 'Client full name is incomplete')
  addBlocker(blockers, !textPresent(caseRow.client?.contactNumber), 'Client contact number is missing')
  addBlocker(blockers, !textPresent(caseRow.client?.barangay), 'Client barangay is missing')
  addBlocker(blockers, !textPresent(caseRow.dateOfAssessment), 'Date of assessment is missing')
  addBlocker(blockers, !textPresent(caseRow.presentingProblem), 'Presenting problem is missing')
  addBlocker(blockers, !textPresent(caseRow.backgroundOfProblem) && !textPresent(caseRow.assessment), 'Case study findings are missing')
  addBlocker(blockers, !Array.isArray(caseRow.familyComposition) || caseRow.familyComposition.length === 0, 'Family composition has no entries')

  const missingRequirements = missingRequirementLabels(caseRow)
  if (!portalOrigin && missingRequirements.length) {
    blockers.push(`Missing submitted requirements: ${missingRequirements.join(', ')}`)
  }

  const amount = toPositiveNumber(caseRow.amount)
  const medicineTotal = Array.isArray(caseRow.medicines)
    ? caseRow.medicines.reduce((sum: number, item: any) => sum + toPositiveNumber(item.totalPrice), 0)
    : 0
  addBlocker(blockers, amount <= 0 && medicineTotal <= 0, 'Amount has not been encoded')

  if (caseRow.assistanceType === 'medicine') {
    addBlocker(blockers, !Array.isArray(caseRow.medicines) || caseRow.medicines.length === 0, 'Medicine items have not been encoded')
  }
  if (caseRow.assistanceType === 'burial') {
    addBlocker(blockers, !textPresent(caseRow.burialDetails?.deceasedName), 'Deceased name is missing')
    addBlocker(blockers, !textPresent(caseRow.burialDetails?.funeralHome), 'Funeral home is missing')
    addBlocker(blockers, !textPresent(caseRow.burialDetails?.conformeRelationship), 'Conforme relationship is missing')
  }
  if (caseRow.assistanceType === 'hospital') {
    addBlocker(blockers, !textPresent(caseRow.hospitalDetails?.hospitalName), 'Hospital name is missing')
    addBlocker(blockers, !textPresent(caseRow.hospitalDetails?.doctorName), 'Attending physician is missing')
    addBlocker(blockers, !textPresent(caseRow.hospitalDetails?.diagnosis), 'Hospital diagnosis is missing')
  }
  if (caseRow.assistanceType === 'medical') {
    addBlocker(blockers, !textPresent(caseRow.medicalDetails?.clinicName), 'Clinic or facility name is missing')
    addBlocker(blockers, !textPresent(caseRow.medicalDetails?.doctorName), 'Attending physician is missing')
    addBlocker(blockers, !textPresent(caseRow.medicalDetails?.diagnosis), 'Medical diagnosis is missing')
  }
  if (caseRow.assistanceType === 'eyeglass') {
    addBlocker(blockers, !textPresent(caseRow.eyeglassDetails?.doctorName), 'Optometrist or doctor name is missing')
    addBlocker(blockers, !textPresent(caseRow.eyeglassDetails?.clinicName), 'Clinic or optical shop is missing')
  }
  if (caseRow.assistanceType === 'plain') {
    const auditFlags =
      caseRow.auditFlags && typeof caseRow.auditFlags === 'object' && !Array.isArray(caseRow.auditFlags)
        ? caseRow.auditFlags
        : null
    const plainAssistanceKinds = normalizePlainAssistanceKinds(auditFlags?.plain_assistance_kinds)
    addBlocker(blockers, plainAssistanceKinds.length === 0, 'Requested assistance type has not been selected')
  }
  const readyForReview = blockers.length === 0
  const isRejected = status === 'rejected'
  const isBlocked = (status === 'encoding' && !readyForReview) || isRejected

  let queue: WorkflowQueue = 'needs_intake'
  let nextAction = 'Complete intake and proceed to case study.'
  let ownerUserId = caseRow.socialWorkerId ?? null

  if (status === 'encoding') {
    queue = readyForReview ? 'ready_for_review' : 'needs_encoding'
    nextAction = readyForReview
      ? 'Submit the case for review.'
      : `Resolve ${blockers.length} blocker${blockers.length === 1 ? '' : 's'} before review.`
  } else if (status === 'for_review') {
    queue = 'ready_for_review'
    ownerUserId = assigneesByStage?.for_review?.id ?? null
    nextAction = 'Reviewer decision is required.'
  } else if (status === 'recommending_approval') {
    queue = 'waiting_for_recommender'
    ownerUserId = assigneesByStage?.recommending_approval?.id ?? null
    nextAction = 'Recommender decision is required.'
  } else if (status === 'for_approval') {
    queue = 'waiting_for_approver'
    ownerUserId = assigneesByStage?.for_approval?.id ?? null
    nextAction = 'Final approver decision is required.'
  } else if (status === 'approved') {
    queue = 'ready_for_release'
    nextAction = 'Release the approved case.'
  } else if (status === 'released') {
    queue = 'released'
    nextAction = 'Case has been released.'
  } else if (status === 'rejected') {
    queue = 'blocked_incomplete'
    nextAction = 'Re-open the case and correct the disapproval findings.'
  }

  const dueHours = QUEUE_SLA_HOURS[isBlocked && queue === 'needs_encoding' ? 'blocked_incomplete' : queue]
  const activityAt = latestWorkflowActivity(caseRow)
  const dueAt = dueHours == null ? null : new Date(activityAt.getTime() + dueHours * 60 * 60 * 1000)
  const overdue = dueAt != null && dueAt.getTime() < Date.now() && queue !== 'released'

  return {
    queue,
    nextAction,
    ownerUserId,
    isBlocked,
    blockers,
    dueAt: dueAt?.toISOString() ?? null,
    overdue,
    readyForReview,
  }
}
