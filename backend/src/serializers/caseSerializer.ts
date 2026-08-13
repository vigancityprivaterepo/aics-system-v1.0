import type { ApprovalStage } from '@prisma/client'
import { APPROVAL_STAGE_ORDER, APPROVAL_STAGE_META, type ApprovalAssigneeByStage } from '../types/caseTypes.js'
import { approvalActorTitle } from '../services/approvalService.js'
import { buildCaseStudyReportSignature } from '../services/reportSignatureService.js'
import { assessCaseWorkflow } from '../services/caseWorkflowService.js'
import { currencyFromDb } from '../utils/currency.js'

function portalContextFromAuditFlags(auditFlags: unknown): Record<string, unknown> | null {
  if (!auditFlags || typeof auditFlags !== 'object' || Array.isArray(auditFlags)) return null
  const flags = auditFlags as Record<string, unknown>
  const metadata =
    typeof flags.portal_application_metadata === 'object' &&
    flags.portal_application_metadata &&
    !Array.isArray(flags.portal_application_metadata)
      ? (flags.portal_application_metadata as Record<string, unknown>)
      : {}
  const context = {
    applicationId: typeof flags.portal_application_id === 'string' ? flags.portal_application_id : null,
    referenceNumber: typeof flags.portal_reference_number === 'string' ? flags.portal_reference_number : null,
    hospitalFacilityName: typeof flags.portal_selected_hospital_name === 'string' ? flags.portal_selected_hospital_name : null,
    medicineGenericName: typeof flags.portal_selected_medicine_name === 'string' ? flags.portal_selected_medicine_name : null,
    ...metadata,
  }
  return Object.values(context).some((v) => v != null && v !== '') ? context : null
}

function normalizeWorkflowStatus(status: string): string {
  return status === 'requirements' ? 'encoding' : status
}

// Collapses accidental repeats like "Barangay Barangay VII" (stored data) into
// "Barangay VII" so reports never print the word twice.
function dedupeBarangayWord(value: string | null | undefined): string | null | undefined {
  if (!value) return value
  return value.replace(/\bbarangay\b(?:\s+barangay\b)+/gi, (m) => m.match(/barangay/i)![0])
}

function normalizePlainAssistanceKinds(value: unknown): string[] {
  const allowed = new Set(['medical', 'hospital', 'burial'])
  if (!Array.isArray(value)) return []
  return [...new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => allowed.has(item))
  )]
}

function mapRequirements(rows: Array<{ requirementName: string; isSubmitted: boolean }>, type: string): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  for (const row of rows) {
    map[row.requirementName] = row.isSubmitted
  }
  return map
}

export function serializeCase(caseRow: any, assigneesByStage?: ApprovalAssigneeByStage) {
  const requirements = mapRequirements(caseRow.requirements ?? [], caseRow.assistanceType)

  const auditFlags =
    typeof caseRow.auditFlags === 'object' && caseRow.auditFlags
      ? (caseRow.auditFlags as Record<string, unknown>)
      : {}

  const medicineTemplateType = auditFlags.medicine_template_type === 'proxy' ? 'proxy' : 'personal'
  const eyeglassTemplateType = auditFlags.eyeglass_template_type === 'proxy' ? 'proxy' : 'personal'
  const plainAssistanceKinds = normalizePlainAssistanceKinds(auditFlags.plain_assistance_kinds)
  const plainConformeName = typeof auditFlags.plain_conforme_name === 'string' ? auditFlags.plain_conforme_name : null
  const plainConformeRelationship = typeof auditFlags.plain_conforme_relationship === 'string' ? auditFlags.plain_conforme_relationship : null
  const medicineConformeName = typeof auditFlags.medicine_conforme_name === 'string' ? auditFlags.medicine_conforme_name : null
  const medicineConformeRelationship =
    typeof auditFlags.medicine_conforme_relationship === 'string' ? auditFlags.medicine_conforme_relationship : null

  const approvalByStage = new Map<ApprovalStage, any>()
  for (const row of caseRow.approvals ?? []) {
    approvalByStage.set(row.stage as ApprovalStage, row)
  }

  const stageApproval = (stage: ApprovalStage) => {
    const row = approvalByStage.get(stage)
    return row
      ? {
          id: row.id,
          stage: row.stage,
          action: row.action,
          actedByUserId: row.actedByUserId ?? null,
          actedByName: row.actedByName,
          actedByTitle: row.actedByTitle ?? approvalActorTitle(stage),
          // Always use the signer's current e-signature rather than the frozen snapshot
          // captured at approval time, so a re-uploaded signature shows up immediately on
          // every report from then on. Fall back to the snapshot only if their profile no
          // longer has a signature on file at all.
          signatureUrl: row.actedByUser?.eSignatureUrl ?? row.signatureUrlSnapshot ?? null,
          signatureParam: row.actedByUser?.signatureParam ?? null,
          position: row.actedByUser?.position ?? null,
          actedAt: row.actedAt ? new Date(row.actedAt).toISOString().slice(0, 10) : null,
          notes: row.notes ?? null,
        }
      : null
  }

  const reviewedStage = stageApproval('for_review')
  const recommendingStage = stageApproval('recommending_approval')
  const approvedStage = stageApproval('for_approval')

  const stageAssignees: ApprovalAssigneeByStage = assigneesByStage ?? {
    for_review: null,
    recommending_approval: null,
    for_approval: null,
  }

  const reviewedAssignee = stageAssignees.for_review
  const recommendingAssignee = stageAssignees.recommending_approval
  const approvedAssignee = stageAssignees.for_approval
  const workflow = assessCaseWorkflow(caseRow, stageAssignees)

  const approvalSignatureFallbacks = {
    for_review:
      reviewedAssignee?.signatureParam && reviewedAssignee?.eSignatureUrl
        ? { signatureParam: reviewedAssignee.signatureParam, signatureUrl: reviewedAssignee.eSignatureUrl }
        : null,
    recommending_approval:
      recommendingAssignee?.signatureParam && recommendingAssignee?.eSignatureUrl
        ? { signatureParam: recommendingAssignee.signatureParam, signatureUrl: recommendingAssignee.eSignatureUrl }
        : null,
    for_approval:
      approvedAssignee?.signatureParam && approvedAssignee?.eSignatureUrl
        ? { signatureParam: approvedAssignee.signatureParam, signatureUrl: approvedAssignee.eSignatureUrl }
        : null,
  }

  const clientFullName = [caseRow.client.firstName, caseRow.client.middleName, caseRow.client.lastName]
    .filter(Boolean)
    .join(' ')
  const clientAddress = [
    dedupeBarangayWord(caseRow.client.barangay),
    caseRow.client.municipality,
    caseRow.client.province,
  ]
    .filter(Boolean)
    .join(', ')

  const beneficiaryNameOverride = String(caseRow.beneficiaryName ?? '').trim() || null

  const beneficiaryName =
    caseRow.assistanceType === 'burial'
      ? String(caseRow.burialDetails?.deceasedName ?? '').trim() || clientFullName
      : beneficiaryNameOverride || clientFullName

  const beneficiaryAddress =
    caseRow.assistanceType === 'burial'
      ? dedupeBarangayWord(String(caseRow.burialDetails?.deceasedAddress ?? '').trim()) || clientAddress
      : clientAddress

  const proxyName =
    beneficiaryNameOverride ? (caseRow.beneficiaryRequestorName ?? clientFullName)
    : caseRow.assistanceType === 'burial' ? (caseRow.burialDetails?.conformeName ?? clientFullName)
    : caseRow.assistanceType === 'medicine' ? medicineConformeName
    : caseRow.assistanceType === 'hospital' ? (caseRow.hospitalDetails?.conformeName ?? null)
    : caseRow.assistanceType === 'medical' ? (caseRow.medicalDetails?.conformeName ?? null)
    : caseRow.assistanceType === 'eyeglass' ? (caseRow.eyeglassDetails?.conformeName ?? null)
    : null
  const proxyRelationship =
    beneficiaryNameOverride ? (caseRow.beneficiaryRequestorRelationship ?? null)
    : caseRow.assistanceType === 'burial' ? (caseRow.burialDetails?.conformeRelationship ?? null)
    : caseRow.assistanceType === 'medicine' ? medicineConformeRelationship
    : caseRow.assistanceType === 'hospital' ? (caseRow.hospitalDetails?.conformeRelationship ?? null)
    : caseRow.assistanceType === 'medical' ? (caseRow.medicalDetails?.conformeRelationship ?? null)
    : caseRow.assistanceType === 'eyeglass' ? (caseRow.eyeglassDetails?.conformeRelationship ?? null)
    : null

  // 'released' is a terminal status, so the most recent status log (if it's the
  // release transition) tells us when and by whom the case was actually released.
  const latestStatusLog = Array.isArray(caseRow.statusLogs) ? caseRow.statusLogs[0] : null
  const releasedAt = caseRow.status === 'released' && latestStatusLog?.toStatus === 'released'
    ? latestStatusLog.changedAt?.toISOString() ?? null
    : null
  const releasedByName = caseRow.status === 'released' && latestStatusLog?.toStatus === 'released'
    ? latestStatusLog.changedBy?.name ?? null
    : null

  return {
    id: caseRow.id,
    caseNumber: caseRow.caseNumber ?? null,
    assistanceType: caseRow.assistanceType,
    status: normalizeWorkflowStatus(caseRow.status),
    socialWorkerName: caseRow.socialWorkerName ?? caseRow.socialWorker?.name ?? null,
    dateOfAssessment: caseRow.dateOfAssessment?.toISOString().slice(0, 10) ?? null,
    presentingProblem: caseRow.presentingProblem,
    familyComposition: caseRow.familyComposition ?? [],
    backgroundOfProblem: caseRow.backgroundOfProblem,
    assessment: caseRow.assessment,
    recommendation: caseRow.recommendation,
    hospitalClinic: caseRow.hospitalClinic,
    amount: currencyFromDb(caseRow.amount),
    remarks: caseRow.remarks,
    releasedAt,
    releasedByName,
    beneficiaryName,
    beneficiaryAddress,
    beneficiaryAge: caseRow.beneficiaryAge ?? null,
    beneficiarySex: caseRow.beneficiarySex ?? null,
    beneficiaryCivilStatus: caseRow.beneficiaryCivilStatus ?? null,
    beneficiaryOccupation: caseRow.beneficiaryOccupation ?? null,
    beneficiaryRequestorName: caseRow.beneficiaryRequestorName ?? null,
    beneficiaryRequestorRelationship: caseRow.beneficiaryRequestorRelationship ?? null,
    choCertGivenDate: caseRow.choCertGivenDate?.toISOString().slice(0, 10) ?? null,
    proxyName,
    proxyRelationship,
    ...workflow,
    workflow,
    client: {
      id: caseRow.client.id,
      caseNumber: caseRow.client.caseNumber,
      lastName: caseRow.client.lastName,
      firstName: caseRow.client.firstName,
      middleName: caseRow.client.middleName,
      dateOfBirth: caseRow.client.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      sex: caseRow.client.sex,
      civilStatus: caseRow.client.civilStatus,
      barangay: caseRow.client.barangay,
      municipality: caseRow.client.municipality,
      province: caseRow.client.province,
      region: caseRow.client.region,
      contactNumber: caseRow.client.contactNumber,
      occupation: caseRow.client.occupation,
      religion: (caseRow.client as any).religion ?? null,
      clientCategory: caseRow.client.clientCategory?.replace('_', '-') ?? 'walk-in',
      is4ps: caseRow.client.is4ps,
      isPwd: caseRow.client.isPwd,
      isSenior: caseRow.client.isSenior,
    },
    requirements,
    medicines: (caseRow.medicines ?? []).map((m: any) => ({
      id: m.id,
      medicineId: m.medicineId,
      medicineName: m.medicineName,
      quantity: Number(m.quantity),
      unit: m.unit,
      unitPrice: Number(m.unitPrice),
      totalPrice: Number(m.totalPrice),
      medicine: m.medicine
        ? {
            isAvailable: m.medicine.isAvailable ?? true,
            updatedAt: m.medicine.updatedAt ?? null,
            availabilityUpdatedAt: m.medicine.availabilityUpdatedAt ?? null,
            availableUpdatedAt: m.medicine.availableUpdatedAt ?? null,
            unavailableUpdatedAt: m.medicine.unavailableUpdatedAt ?? null,
          }
        : null,
    })),
    burialDetails: caseRow.burialDetails
      ? {
          id: caseRow.burialDetails.id,
          deceasedName: caseRow.burialDetails.deceasedName,
          deceasedAddress: caseRow.burialDetails.deceasedAddress ?? null,
          deceasedAge: caseRow.burialDetails.deceasedAge ?? null,
          deceasedOccupation: caseRow.burialDetails.deceasedOccupation ?? null,
          deceasedCivilStatus: caseRow.burialDetails.deceasedCivilStatus ?? null,
          deceasedSex: caseRow.burialDetails.deceasedSex ?? null,
          dateOfDeath: caseRow.burialDetails.dateOfDeath?.toISOString().slice(0, 10) ?? null,
          causeOfDeath: caseRow.burialDetails.causeOfDeath,
          funeralHome: caseRow.burialDetails.funeralHome,
          funeralHomeOwner: caseRow.burialDetails.funeralHomeOwner ?? null,
          funeralOwnerAddress: caseRow.burialDetails.funeralOwnerAddress ?? null,
          typeOfBill: caseRow.burialDetails.typeOfBill ?? null,
          intermentPlace: caseRow.burialDetails.intermentPlace ?? null,
          conformeName: caseRow.burialDetails.conformeName ?? null,
          conformeRelationship: caseRow.burialDetails.conformeRelationship ?? null,
          guaranteeLetterUrl: caseRow.burialDetails.guaranteeLetterUrl,
          signedGlUrl: caseRow.burialDetails.signedGlUrl,
          glUploadedAt: caseRow.burialDetails.glUploadedAt,
        }
      : null,
    hospitalDetails: caseRow.hospitalDetails
      ? {
          id: caseRow.hospitalDetails.id,
          templateType: caseRow.hospitalDetails.templateType,
          patientName: caseRow.hospitalDetails.patientName ?? null,
          hospitalName: caseRow.hospitalDetails.hospitalName ?? null,
          hospitalAddress: caseRow.hospitalDetails.hospitalAddress ?? null,
          doctorName: caseRow.hospitalDetails.doctorName ?? null,
          mdPosition: caseRow.hospitalDetails.mdPosition ?? null,
          admissionDate: caseRow.hospitalDetails.admissionDate?.toISOString().slice(0, 10) ?? null,
          diagnosis: caseRow.hospitalDetails.diagnosis ?? null,
          typeOfBill: caseRow.hospitalDetails.typeOfBill ?? null,
          conformeName: caseRow.hospitalDetails.conformeName ?? null,
          conformeRelationship: caseRow.hospitalDetails.conformeRelationship ?? null,
          guaranteeLetterUrl: caseRow.hospitalDetails.guaranteeLetterUrl ?? null,
          signedGlUrl: caseRow.hospitalDetails.signedGlUrl ?? null,
          glUploadedAt: caseRow.hospitalDetails.glUploadedAt ?? null,
        }
      : null,
    medicalDetails: caseRow.medicalDetails
      ? {
          id: caseRow.medicalDetails.id,
          templateType: caseRow.medicalDetails.templateType,
          clinicName: caseRow.medicalDetails.clinicName ?? null,
          clinicAddress: caseRow.medicalDetails.clinicAddress ?? null,
          doctorName: caseRow.medicalDetails.doctorName ?? null,
          mdPosition: caseRow.medicalDetails.mdPosition ?? null,
          consultationDate: caseRow.medicalDetails.consultationDate?.toISOString().slice(0, 10) ?? null,
          medicalType: caseRow.medicalDetails.medicalType ?? null,
          diagnosedType: caseRow.medicalDetails.diagnosedType ?? null,
          operationType: caseRow.medicalDetails.operationType ?? null,
          diagnosis: caseRow.medicalDetails.diagnosis ?? null,
          typeOfBill: caseRow.medicalDetails.typeOfBill ?? null,
          conformeName: caseRow.medicalDetails.conformeName ?? null,
          conformeRelationship: caseRow.medicalDetails.conformeRelationship ?? null,
          guaranteeLetterUrl: caseRow.medicalDetails.guaranteeLetterUrl ?? null,
          signedGlUrl: caseRow.medicalDetails.signedGlUrl ?? null,
          glUploadedAt: caseRow.medicalDetails.glUploadedAt ?? null,
        }
      : null,
    eyeglassDetails: caseRow.eyeglassDetails
      ? {
          id: caseRow.eyeglassDetails.id,
          templateType: eyeglassTemplateType,
          doctorName: caseRow.eyeglassDetails.doctorName ?? null,
          clinicName: caseRow.eyeglassDetails.clinicName ?? null,
          clinicAddress: caseRow.eyeglassDetails.clinicAddress ?? null,
          conformeName: caseRow.eyeglassDetails.conformeName ?? null,
          conformeRelationship: caseRow.eyeglassDetails.conformeRelationship ?? null,
          guaranteeLetterUrl: caseRow.eyeglassDetails.guaranteeLetterUrl ?? null,
          signedGlUrl: caseRow.eyeglassDetails.signedGlUrl ?? null,
          glUploadedAt: caseRow.eyeglassDetails.glUploadedAt ?? null,
        }
      : null,
    plainDetails: caseRow.plainDetails
      ? {
          natureOfAssistance: caseRow.plainDetails.natureOfAssistance ?? null,
          conformeName: plainConformeName,
          conformeRelationship: plainConformeRelationship,
          assistanceKinds: plainAssistanceKinds,
        }
      : null,
    medicineDetails: {
      templateType: medicineTemplateType,
      conformeName: medicineConformeName,
      conformeRelationship: medicineConformeRelationship,
    },
    portalApplicationContext: portalContextFromAuditFlags(caseRow.auditFlags),
    portalApplicationDocuments: (caseRow.applicantApplication?.documents ?? []).map((document: any) => ({
      id: document.id,
      documentType: document.documentType,
      originalName: document.originalName,
      fileUrl: document.fileUrl,
      uploadedAt: document.uploadedAt ?? null,
    })),
    approvals: {
      for_review: reviewedStage,
      recommending_approval: recommendingStage,
      for_approval: approvedStage,
    },
    approvalSignatureFallbacks,
    reportSignature: buildCaseStudyReportSignature(caseRow, stageAssignees),
    reviewedByName: reviewedStage?.actedByName ?? reviewedAssignee?.name ?? null,
    reviewedByTitle: reviewedStage?.actedByTitle ?? reviewedAssignee?.position ?? approvalActorTitle('for_review'),
    reviewedByDate: reviewedStage?.actedAt ?? null,
    reviewedBySignature: reviewedStage?.signatureUrl ?? null,
    recommendingByName: recommendingStage?.actedByName ?? recommendingAssignee?.name ?? null,
    recommendingByTitle: recommendingStage?.actedByTitle ?? recommendingAssignee?.position ?? approvalActorTitle('recommending_approval'),
    recommendingByDate: recommendingStage?.actedAt ?? null,
    recommendingBySignature: recommendingStage?.signatureUrl ?? null,
    approvedByName: approvedStage?.actedByName ?? approvedAssignee?.name ?? null,
    approvedByTitle: approvedStage?.actedByTitle ?? approvedAssignee?.position ?? approvalActorTitle('for_approval'),
    approvedByDate: approvedStage?.actedAt ?? null,
    approvedBySignature: approvedStage?.signatureUrl ?? null,
    preparedBySignature: caseRow.socialWorker?.eSignatureUrl ?? null,
    preparedBySignatureParam: caseRow.socialWorker?.signatureParam ?? null,
    preparedByPosition: caseRow.socialWorker?.position ?? null,
  }
}

export type SerializedCase = ReturnType<typeof serializeCase>

export { portalContextFromAuditFlags, normalizeWorkflowStatus, mapRequirements, APPROVAL_STAGE_META, APPROVAL_STAGE_ORDER }
