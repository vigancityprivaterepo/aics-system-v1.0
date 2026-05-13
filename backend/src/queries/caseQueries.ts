import { prisma } from '../utils/prisma.js'

export async function findCaseWithDetails(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: {
      client: true,
      requirements: true,
      medicines: { orderBy: { createdAt: 'asc' } },
      burialDetails: true,
      hospitalDetails: true,
      medicalDetails: true,
      eyeglassDetails: true,
      plainDetails: true,
      applicantApplication: {
        include: {
          applicant: {
            select: {
              sex: true,
            },
          },
        },
      },
      socialWorker: { select: { id: true, eSignatureUrl: true, signatureParam: true, position: true } },
      approvals: {
        orderBy: { actedAt: 'asc' },
        include: { actedByUser: { select: { signatureParam: true } } },
      },
    },
  })
}

export async function getApprovalSettings() {
  return prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
    select: {
      reviewedByUserId: true,
      recommendingUserId: true,
      approvedByUserId: true,
      reviewedByUser: { select: { id: true, name: true, approvalLevel: true, eSignatureUrl: true, signatureParam: true, isActive: true } },
      recommendingUser: { select: { id: true, name: true, approvalLevel: true, eSignatureUrl: true, signatureParam: true, isActive: true } },
      approvedByUser: { select: { id: true, name: true, approvalLevel: true, eSignatureUrl: true, signatureParam: true, isActive: true } },
    },
  })
}

export type ApprovalSettings = Awaited<ReturnType<typeof getApprovalSettings>>
export type CaseWithDetails = NonNullable<Awaited<ReturnType<typeof findCaseWithDetails>>>
