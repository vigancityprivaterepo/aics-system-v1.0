import { prisma } from '../utils/prisma.js'
import { getRuntimeReadinessIssues } from '../config/env.js'

export async function getReadinessStatus() {
  const issues = getRuntimeReadinessIssues()
  if (issues.length > 0) {
    return { ok: false, issues }
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, issues: [] as string[] }
  } catch {
    return { ok: false, issues: ['Database unreachable'] }
  }
}
