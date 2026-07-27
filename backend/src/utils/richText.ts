const BLOCK_BREAK_PATTERN = /<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/tr)\s*\/?>/gi

function decodeHtmlEntities(value: string) {
  return value
    .replace(/(?:&nbsp;|\u00a0){4}/gi, '\t')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)))
}

export function richTextToPlainText(value: unknown) {
  if (value == null) return ''
  const source = String(value)
  if (!source.trim()) return ''

  const decoded = decodeHtmlEntities(
    source
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(BLOCK_BREAK_PATTERN, '\n')
      .replace(/<\/td>/gi, '\t')
      .replace(/<[^>]+>/g, '')
  )

  return decoded
    .replace(/\u00e2\u20ac\u00a2/g, '-')
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac[\u0153\u009d]/g, '"')
    .replace(/\u00e2\u20ac[\u201c\u201d]/g, '-')
    .replace(/\u00c2\u00b7/g, '-')
    .replace(/\u00c2/g, '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
}

export function richTextHasVisibleText(value: unknown) {
  return richTextToPlainText(value).replace(/[\s\t\n\r]+/g, '').length > 0
}
