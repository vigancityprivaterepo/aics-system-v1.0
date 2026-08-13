// Case makers encode names in mixed case; store them uppercase so every
// client record, report, and search match uses one consistent format.
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function normalizeNameOrNullish<T extends string | null | undefined>(value: T): T {
  return (value ? normalizeName(value) : value) as T
}

// Uppercases the `name` field of each entry in a familyComposition-shaped
// array (Client.familyComposition / Case.familyComposition), leaving any
// other fields on each member untouched. `Record<string, any>` (not
// `unknown`) matches zod's z.record(z.any()) inference so the result stays
// structurally assignable to Prisma's InputJsonObject. Takes a definite
// array (call this with `members ? normalizeFamilyCompositionNames(members) : members`
// at each call site) so callers keep their own null/undefined shape exactly.
export function normalizeFamilyCompositionNames<T extends Record<string, any>>(members: T[]): T[] {
  return members.map((member) =>
    member && typeof member.name === 'string' ? { ...member, name: normalizeName(member.name) } : member
  )
}
