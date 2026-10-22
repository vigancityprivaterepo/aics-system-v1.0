// A household member's relationship is recorded relative to the client
// ("Norma is the client's Common Law Wife"). When a case is filed for that
// member instead, the client joins the household list and needs the reverse
// relationship ("Richard is Norma's Common Law Husband"). Gendered answers use
// the client's sex; when it is unknown, or the relationship is not one we can
// reverse safely, return '' so the case maker picks it.

const BY_SEX = (male, female) => ({ male, female })

const INVERSE = {
  spouse: 'Spouse',
  husband: 'Spouse',
  wife: 'Spouse',
  son: BY_SEX('Father', 'Mother'),
  daughter: BY_SEX('Father', 'Mother'),
  child: BY_SEX('Father', 'Mother'),
  father: BY_SEX('Son', 'Daughter'),
  mother: BY_SEX('Son', 'Daughter'),
  brother: BY_SEX('Brother', 'Sister'),
  sister: BY_SEX('Brother', 'Sister'),
  grandson: BY_SEX('Grandfather', 'Grandmother'),
  granddaughter: BY_SEX('Grandfather', 'Grandmother'),
  grandchild: BY_SEX('Grandfather', 'Grandmother'),
  grandfather: BY_SEX('Grandson', 'Granddaughter'),
  grandmother: BY_SEX('Grandson', 'Granddaughter'),
  uncle: BY_SEX('Nephew', 'Niece'),
  aunt: BY_SEX('Nephew', 'Niece'),
  nephew: BY_SEX('Uncle', 'Aunt'),
  niece: BY_SEX('Uncle', 'Aunt'),
  'son-in-law': BY_SEX('Father-in-Law', 'Mother-in-Law'),
  'daughter-in-law': BY_SEX('Father-in-Law', 'Mother-in-Law'),
  'father-in-law': BY_SEX('Son-in-Law', 'Daughter-in-Law'),
  'mother-in-law': BY_SEX('Son-in-Law', 'Daughter-in-Law'),
  'common law wife': BY_SEX('Common Law Husband', 'Common Law Wife'),
  'common law husband': BY_SEX('Common Law Husband', 'Common Law Wife'),
  'common law partner': 'Common Law Partner',
  'live-in partner': 'Live-in Partner',
  'live in partner': 'Live-in Partner',
  cousin: 'Cousin',
}

// "Other"/"Others" on the client profile keeps the real wording in relationshipOther.
export function effectiveRelationship(relationship, relationshipOther) {
  const value = String(relationship ?? '').trim()
  if (/^others?$/i.test(value)) return String(relationshipOther ?? '').trim()
  return value
}

export function inverseRelationship(relationship, clientSex) {
  const key = String(relationship ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  const answer = INVERSE[key]
  if (!answer) return ''
  if (typeof answer === 'string') return answer
  const sex = String(clientSex ?? '').trim().toLowerCase()
  if (sex === 'male') return answer.male
  if (sex === 'female') return answer.female
  return ''
}
