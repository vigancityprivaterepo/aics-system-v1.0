// One-time backfill: normalizes casing of medicine names already stored in the database
// (created before toTitleCase() was wired into the save paths) so they match the same
// "Amoxicillin" / "Amoxicillin Trihydrate" formatting new entries get.
//
// Run inside the backend container (needs the compiled dist/ + prisma client):
//   docker compose exec backend node scripts/backfillMedicineNameCasing.mjs
import { PrismaClient } from '@prisma/client'
import { toTitleCase } from '../dist/utils/textFormat.js'

const prisma = new PrismaClient()

async function main() {
  const medicines = await prisma.medicineItem.findMany({
    select: { id: true, genericName: true, brandName: true },
  })

  let medicineUpdates = 0
  for (const m of medicines) {
    const genericName = toTitleCase(m.genericName)
    const brandName = m.brandName ? toTitleCase(m.brandName) : m.brandName
    if (genericName !== m.genericName || brandName !== m.brandName) {
      await prisma.medicineItem.update({
        where: { id: m.id },
        data: { genericName, brandName },
      })
      medicineUpdates++
    }
  }

  const caseMedicines = await prisma.caseMedicine.findMany({
    select: { id: true, medicineName: true },
  })

  let caseMedicineUpdates = 0
  for (const cm of caseMedicines) {
    const medicineName = toTitleCase(cm.medicineName)
    if (medicineName !== cm.medicineName) {
      await prisma.caseMedicine.update({
        where: { id: cm.id },
        data: { medicineName },
      })
      caseMedicineUpdates++
    }
  }

  // Normalization can make two previously distinct-looking rows collide (e.g. "Amoxicillin"
  // and "amoxicillin" both already in the table) — surface those so an admin can merge/remove.
  const byKey = new Map()
  for (const m of await prisma.medicineItem.findMany({ select: { id: true, genericName: true, unit: true, strength: true } })) {
    const key = `${m.genericName.toLowerCase()}|${(m.unit ?? '').toLowerCase()}|${(m.strength ?? '').toLowerCase()}`
    byKey.set(key, [...(byKey.get(key) ?? []), m.id])
  }
  const collisions = [...byKey.entries()].filter(([, ids]) => ids.length > 1)

  console.log(`medicine_items updated: ${medicineUpdates}/${medicines.length}`)
  console.log(`case_medicines updated: ${caseMedicineUpdates}/${caseMedicines.length}`)
  if (collisions.length) {
    console.log(`\nWarning: ${collisions.length} generic name+unit+strength group(s) now have duplicate medicine_items rows — review/merge manually:`)
    for (const [key, ids] of collisions) console.log(`  ${key}: ${ids.join(', ')}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
