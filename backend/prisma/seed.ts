import bcrypt from 'bcryptjs'
import { PrismaClient, UserRole, AssistanceType, CaseStatus, ClientCategory } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('Production seeding is disabled. Set ALLOW_PRODUCTION_SEED=true only for intentional one-off seeding.')
  }

  const passwordHash = await bcrypt.hash('password123', 10)

  const users = [
    { name: 'Admin User', role: UserRole.admin, email: 'admin@aics.dswd.gov.ph', employeeId: 'AICS-ADM-001', username: 'admin' },
    { name: 'Employee User', role: UserRole.employee, email: 'employee@aics.dswd.gov.ph', employeeId: 'AICS-EMP-001', username: 'employee' },
    { name: 'Data Office', role: UserRole.admin, email: 'data@vigancity.gov.ph', employeeId: 'AICS-ADM-002', username: 'data.admin' },
  ]

  for (const user of users) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: user.email },
          { username: user.username },
          { employeeId: user.employeeId },
        ],
      },
      select: { id: true },
    })

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { ...user, passwordHash, isActive: true },
      })
    } else {
      await prisma.user.create({
        data: { ...user, passwordHash, isActive: true },
      })
    }
  }

  await prisma.applicant.deleteMany({
    where: { email: 'data@vigancity.gov.ph' },
  })

  const medicineSeeds = [
    ['Amoxicillin', 'Amoxil', 'capsule', 'Antibiotics', 12.5],
    ['Amlodipine', 'Norvasc', 'tablet', 'Antihypertensives', 8.75],
    ['Metformin', 'Glucophage', 'tablet', 'Antidiabetics', 5.0],
    ['Paracetamol', 'Biogesic', 'tablet', 'Analgesics', 3.25],
    ['Ascorbic Acid', 'Clusivol', 'tablet', 'Vitamins & Supplements', 4.5],
    ['Salbutamol', 'Ventolin', 'nebule', 'Respiratory', 35.0],
    ['Atorvastatin', 'Lipitor', 'tablet', 'Cardiovascular', 20.0],
    ['Cyclophosphamide', null, 'vial', 'Chemotherapy', 650.0],
  ] as const

  for (const [genericName, brandName, unit, category, unitPrice] of medicineSeeds) {
    const existing = await prisma.medicineItem.findFirst({
      where: { genericName, brandName, unit },
    })

    if (existing) {
      await prisma.medicineItem.update({
        where: { id: existing.id },
        data: { category, unitPrice },
      })
    } else {
      await prisma.medicineItem.create({
        data: { genericName, brandName, unit, category, unitPrice },
      })
    }
  }

  const employee = await prisma.user.findUnique({ where: { email: 'employee@aics.dswd.gov.ph' } })

  const sampleClient = await prisma.client.upsert({
    where: { caseNumber: 'AICS-2026-04-000001' },
    update: {},
    create: {
      caseNumber: 'AICS-2026-04-000001',
      lastName: 'Santos',
      firstName: 'Maria',
      middleName: 'L.',
      dateOfBirth: new Date('1985-03-15'),
      sex: 'Female',
      civilStatus: 'Married',
      barangay: 'Poblacion',
      municipality: 'Vigan City',
      province: 'Ilocos Sur',
      region: 'Region I',
      contactNumber: '09171234567',
      is4ps: true,
      clientCategory: ClientCategory.walk_in,
    },
  })

  const existingCase = await prisma.case.findFirst({ where: { clientId: sampleClient.id } })
  if (!existingCase) {
    const c = await prisma.case.create({
      data: {
        clientId: sampleClient.id,
        assistanceType: AssistanceType.medicine,
        status: CaseStatus.requirements,
        socialWorkerId: employee?.id,
        socialWorkerName: employee?.name,
        socialWorkerEmpId: employee?.employeeId,
        dateOfAssessment: new Date('2026-04-20'),
      },
    })

    const requirements = [
      'prescription',
      'medical_cert',
      'cho_cert',
      'indigency',
      'id_copy',
      'personal_letter',
      'acknowledgement',
    ]

    await prisma.caseRequirement.createMany({
      data: requirements.map((r) => ({ caseId: c.id, requirementName: r, isSubmitted: false })),
      skipDuplicates: true,
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
