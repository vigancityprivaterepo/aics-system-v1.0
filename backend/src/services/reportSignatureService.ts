import type { ApprovalStage, CaseStatus } from '@prisma/client'
import { APPROVAL_STAGE_META, type ApprovalAssigneeByStage } from '../types/caseTypes.js'

export type ReportSignatureStageKey = 'prepared_by' | ApprovalStage

type RawStageState = {
  status?: string | null
  signedFileUrl?: string | null
  signedAt?: string | null
  signedByUserId?: string | null
  signedByName?: string | null
  replacementHistory?: RawReplacementHistoryEntry[] | null
}

type RawReplacementHistoryEntry = {
  signedFileUrl: string
  replacedAt: string
  replacedByUserId: string | null
  replacedByName: string | null
  reason: string | null
}

type RawReportSignatureState = {
  version?: number | null
  preparedAt?: string | null
  sourceStatus?: string | null
  stages?: Record<string, RawStageState | undefined> | null
}

type MutableReportSignatureState = {
  version: number
  preparedAt: string
  sourceStatus: string
  stages: Record<string, {
    status: string
    assignedUserId: string | null
    assignedName: string | null
    assignedPosition: string | null
    signedFileUrl: string | null
    signedAt: string | null
    signedByUserId: string | null
    signedByName: string | null
    replacementHistory: RawReplacementHistoryEntry[]
  }>
}

const REPORT_SIGNATURE_STAGE_ORDER: ReportSignatureStageKey[] = [
  'prepared_by',
  'for_review',
  'recommending_approval',
  'for_approval',
]

const STAGE_APPROVAL_LEVEL_BY_KEY: Partial<Record<ReportSignatureStageKey, string>> = {
  for_review: 'reviewer',
  recommending_approval: 'recommender',
  for_approval: 'approver',
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function extractRawReportSignatureState(auditFlags: unknown): RawReportSignatureState | null {
  const flags = asObject(auditFlags)
  if (!flags) return null
  const reportSignature = asObject(flags.report_signature)
  if (!reportSignature) return null
  const stages = asObject(reportSignature.stages)
  return {
    version: typeof reportSignature.version === 'number' ? reportSignature.version : null,
    preparedAt: typeof reportSignature.preparedAt === 'string' ? reportSignature.preparedAt : null,
    sourceStatus: typeof reportSignature.sourceStatus === 'string' ? reportSignature.sourceStatus : null,
    stages: stages as Record<string, RawStageState | undefined> | null,
  }
}

export function activeReportSignatureStage(status: CaseStatus | string): ReportSignatureStageKey | null {
  if (status === 'intake' || status === 'encoding' || status === 'requirements') return 'prepared_by'
  if (status === 'for_review') return 'for_review'
  if (status === 'recommending_approval') return 'recommending_approval'
  if (status === 'for_approval' || status === 'approved' || status === 'released') return 'for_approval'
  return null
}

export function previousReportSignatureStage(stageKey: ReportSignatureStageKey): ReportSignatureStageKey | null {
  const index = REPORT_SIGNATURE_STAGE_ORDER.indexOf(stageKey)
  if (index <= 0) return null
  return REPORT_SIGNATURE_STAGE_ORDER[index - 1] ?? null
}

function priorReportSignatureStages(stageKey: ReportSignatureStageKey): ReportSignatureStageKey[] {
  const index = REPORT_SIGNATURE_STAGE_ORDER.indexOf(stageKey)
  if (index <= 0) return []
  return REPORT_SIGNATURE_STAGE_ORDER.slice(0, index)
}

export function isReportSignatureStageSigned(auditFlags: unknown, stageKey: ReportSignatureStageKey) {
  const raw = extractRawReportSignatureState(auditFlags)
  return raw?.stages?.[stageKey]?.status === 'signed'
}

export function arePriorReportSignatureStagesSigned(
  auditFlags: unknown,
  stageKey: ReportSignatureStageKey,
) {
  const raw = extractRawReportSignatureState(auditFlags)
  return priorReportSignatureStages(stageKey).every((priorStageKey) => raw?.stages?.[priorStageKey]?.status === 'signed')
}

function stageLabel(stageKey: ReportSignatureStageKey) {
  return stageKey === 'prepared_by' ? 'Prepared by' : APPROVAL_STAGE_META[stageKey].label
}

function stageTitle(stageKey: ReportSignatureStageKey) {
  return stageKey === 'prepared_by' ? 'Case Maker' : APPROVAL_STAGE_META[stageKey].title
}

function assignedUserForStage(
  caseRow: any,
  assigneesByStage?: ApprovalAssigneeByStage,
  stageKey?: ReportSignatureStageKey,
) {
  if (stageKey === 'prepared_by') {
    return {
      id: caseRow.socialWorker?.id ?? caseRow.socialWorkerId ?? null,
      name: caseRow.socialWorkerName ?? caseRow.socialWorker?.name ?? null,
      position: caseRow.socialWorker?.position ?? null,
    }
  }
  if (!stageKey) return { id: null, name: null, position: null }
  const assignee = assigneesByStage?.[stageKey]
  return {
    id: assignee?.id ?? null,
    name: assignee?.name ?? null,
    position: assignee?.position ?? null,
  }
}

export function userCanUploadReportSignatureStage(
  user: Express.AuthUser | undefined,
  activeStage: {
    key: ReportSignatureStageKey
    assignedUserId?: string | null
  } | null | undefined,
  caseRow?: {
    socialWorkerId?: string | null
  } | null,
) {
  if (!user || !activeStage) return false
  if (user.role === 'admin') return true

  if (activeStage.key === 'prepared_by') {
    return !!caseRow?.socialWorkerId && caseRow.socialWorkerId === user.id
  }

  if (activeStage.assignedUserId) {
    return activeStage.assignedUserId === user.id
  }

  const requiredLevel = STAGE_APPROVAL_LEVEL_BY_KEY[activeStage.key]
  return requiredLevel ? user.approvalLevel.includes(requiredLevel) : false
}

export function createFreshReportSignatureState(caseRow: any, assigneesByStage?: ApprovalAssigneeByStage): MutableReportSignatureState {
  const sourceStatus = String(caseRow.status ?? '')
  const nextVersion = (extractRawReportSignatureState(caseRow.auditFlags)?.version ?? 0) + 1

  const stages = Object.fromEntries(
    REPORT_SIGNATURE_STAGE_ORDER.map((stageKey) => {
      const assigned = assignedUserForStage(caseRow, assigneesByStage, stageKey)
      return [stageKey, {
        status: 'pending',
        assignedUserId: assigned.id,
        assignedName: assigned.name,
        assignedPosition: assigned.position,
        signedFileUrl: null,
        signedAt: null,
        signedByUserId: null,
        signedByName: null,
        replacementHistory: [],
      }]
    })
  )

  return {
    version: nextVersion,
    preparedAt: new Date().toISOString(),
    sourceStatus,
    stages,
  }
}

export function applySignedReportStage(
  reportSignature: MutableReportSignatureState,
  stageKey: ReportSignatureStageKey,
  input: {
    signedFileUrl: string
    signedByUserId: string | null
    signedByName: string | null
  },
) {
  return {
    ...reportSignature,
    stages: {
      ...reportSignature.stages,
      [stageKey]: {
        ...(reportSignature.stages?.[stageKey] ?? {}),
        status: 'signed',
        signedFileUrl: input.signedFileUrl,
        signedAt: new Date().toISOString(),
        signedByUserId: input.signedByUserId,
        signedByName: input.signedByName,
      },
    },
  }
}

export function replaceSignedReportStage(
  reportSignature: MutableReportSignatureState,
  stageKey: ReportSignatureStageKey,
  input: {
    signedFileUrl: string
    replacedByUserId: string | null
    replacedByName: string | null
    reason?: string | null
  },
) {
  const currentStage = reportSignature.stages?.[stageKey]
  if (currentStage?.status !== 'signed' || !currentStage.signedFileUrl) {
    throw new Error('Only a completed signature stage can be replaced.')
  }

  const replacedAt = new Date().toISOString()
  const replacementHistory = Array.isArray(currentStage.replacementHistory)
    ? currentStage.replacementHistory
    : []

  return {
    ...reportSignature,
    stages: {
      ...reportSignature.stages,
      [stageKey]: {
        ...currentStage,
        signedFileUrl: input.signedFileUrl,
        signedAt: replacedAt,
        replacementHistory: [
          ...replacementHistory,
          {
            signedFileUrl: currentStage.signedFileUrl,
            replacedAt,
            replacedByUserId: input.replacedByUserId,
            replacedByName: input.replacedByName,
            reason: input.reason ?? null,
          },
        ],
      },
    },
  }
}

export function buildCaseStudyReportSignature(caseRow: any, assigneesByStage?: ApprovalAssigneeByStage) {
  const raw = extractRawReportSignatureState(caseRow.auditFlags)
  const activeStageKey = activeReportSignatureStage(caseRow.status)
  const stages = REPORT_SIGNATURE_STAGE_ORDER.map((stageKey) => {
    const assigned = assignedUserForStage(caseRow, assigneesByStage, stageKey)
    const rawStage = raw?.stages?.[stageKey]
    return {
      key: stageKey,
      label: stageLabel(stageKey),
      title: stageKey === 'prepared_by' ? (assigned.position || stageTitle(stageKey)) : stageTitle(stageKey),
      assignedUserId: assigned.id,
      assignedName: assigned.name,
      assignedPosition: assigned.position,
      status: rawStage?.status === 'signed' ? 'signed' : 'pending',
      signedFileUrl: rawStage?.signedFileUrl ?? null,
      signedAt: rawStage?.signedAt ?? null,
      signedByUserId: rawStage?.signedByUserId ?? null,
      signedByName: rawStage?.signedByName ?? null,
      replacementCount: Array.isArray(rawStage?.replacementHistory) ? rawStage.replacementHistory.length : 0,
      isActive: activeStageKey === stageKey,
    }
  })

  const previousStageKey = activeStageKey ? previousReportSignatureStage(activeStageKey) : null
  const previousStage = previousStageKey ? stages.find((stage) => stage.key === previousStageKey) ?? null : null
  const finalStage = stages.find((stage) => stage.key === 'for_approval') ?? null
  const priorStagesSigned = activeStageKey ? arePriorReportSignatureStagesSigned(caseRow.auditFlags, activeStageKey) : false

  return {
    version: raw?.version ?? 0,
    preparedAt: raw?.preparedAt ?? null,
    sourceStatus: raw?.sourceStatus ?? null,
    activeStageKey,
    stages,
    readyForCurrentStageSigning: activeStageKey
      ? priorStagesSigned
      : false,
    currentDownload: activeStageKey && priorStagesSigned
      ? {
          kind: activeStageKey === 'prepared_by' ? 'generated' : 'uploaded',
          endpoint: `/cases/${caseRow.id}/report-signature/current-pdf`,
          fileName:
            activeStageKey === 'prepared_by'
              ? `${caseRow.caseNumber ?? caseRow.client.caseNumber}-case-study${(raw?.version ?? 0) > 0 ? `-v${raw?.version ?? 0}` : ''}.pdf`
              : `${caseRow.caseNumber ?? caseRow.client.caseNumber}-case-study-v${raw?.version ?? 0}.pdf`,
          ...(previousStage?.signedFileUrl ? { url: previousStage.signedFileUrl } : {}),
        }
      : null,
    finalSignedReportUrl: finalStage?.signedFileUrl ?? null,
    fullySigned: stages.every((stage) => stage.status === 'signed'),
  }
}

export function mergeReportSignatureIntoAuditFlags(
  currentAuditFlags: unknown,
  reportSignature: MutableReportSignatureState,
) {
  const flags = asObject(currentAuditFlags) ?? {}
  return {
    ...flags,
    report_signature: reportSignature,
  }
}
