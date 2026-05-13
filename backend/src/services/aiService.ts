import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

type FindingsPayload = {
  assistanceType: string
  presentingProblem: string | null | undefined
  client: {
    firstName?: string | null
    lastName?: string | null
    middleName?: string | null
    dateOfBirth?: string | null
    sex?: string | null
    civilStatus?: string | null
    barangay?: string | null
    municipality?: string | null
    province?: string | null
    occupation?: string | null
    contactNumber?: string | null
    is4ps?: boolean
    isPwd?: boolean
    isSenior?: boolean
  }
  familyComposition: unknown
  portalContext?: Record<string, unknown> | null
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry == null) return false
      if (typeof entry === 'string') return entry.trim().length > 0
      if (Array.isArray(entry)) return entry.length > 0
      return true
    }),
  ) as T
}

function buildPrompt(payload: FindingsPayload): string {
  const clientProfile = compactObject({
    name: [payload.client.firstName, payload.client.middleName, payload.client.lastName].filter(Boolean).join(' '),
    dateOfBirth: payload.client.dateOfBirth ?? null,
    sex: payload.client.sex ?? null,
    civilStatus: payload.client.civilStatus ?? null,
    barangay: payload.client.barangay ?? null,
    municipality: payload.client.municipality ?? null,
    province: payload.client.province ?? null,
    occupation: payload.client.occupation ?? null,
    contactNumber: payload.client.contactNumber ?? null,
    fourPs: payload.client.is4ps ? 'Yes' : 'No',
    pwd: payload.client.isPwd ? 'Yes' : 'No',
    seniorCitizen: payload.client.isSenior ? 'Yes' : 'No',
  })

  const sanitizedFamily = Array.isArray(payload.familyComposition) ? payload.familyComposition : []
  const portalContext = compactObject(payload.portalContext ?? {})

  return [
    'You are assisting a Philippine local government AICS case study maker.',
    'Write a short professional Findings paragraph for a social case study.',
    'Output only the findings text. Do not include headings, bullets, disclaimers, or markdown.',
    'Keep it factual, concise, and appropriate for a government social welfare case study.',
    'Use 2 to 4 sentences.',
    '',
    `Assistance Type: ${payload.assistanceType}`,
    `Presenting Problem: ${String(payload.presentingProblem ?? '').trim() || 'Not provided'}`,
    '',
    `Client Profile: ${JSON.stringify(clientProfile)}`,
    `Family Composition: ${JSON.stringify(sanitizedFamily)}`,
    `Additional Context: ${JSON.stringify(portalContext)}`,
  ].join('\n')
}

export async function generateClaudeFindingsDraft(payload: FindingsPayload): Promise<string> {
  if (!env.anthropicApiKey) {
    throw new HttpError(503, 'Claude findings assist is not configured. Set ANTHROPIC_API_KEY first.')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.anthropicModel,
      max_tokens: 220,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: buildPrompt(payload),
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new HttpError(502, `Claude request failed${errorText ? `: ${errorText}` : ''}`)
  }

  const data = await response.json() as {
    content?: Array<{ type?: string; text?: string }>
  }

  const text = (data.content ?? [])
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text?.trim() ?? '')
    .join('\n')
    .trim()

  if (!text) {
    throw new HttpError(502, 'Claude did not return any findings text.')
  }

  return text
}
