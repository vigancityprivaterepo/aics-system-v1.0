// Normalizes free-typed medicine names so casing stays consistent regardless of how a case
// maker types it in (amoXicillin, AMOXICILLIN, amoxicillin -> Amoxicillin), incl. multi-word
// names like "amoxicillin trihydrate" -> "Amoxicillin Trihydrate".
export function toTitleCase(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ')
}
