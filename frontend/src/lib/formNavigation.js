function escapeAttributeValue(value) {
  return String(value).replace(/"/g, '\\"')
}

export function scrollToField(fieldName) {
  if (typeof document === 'undefined' || !fieldName) return

  const escapedFieldName = escapeAttributeValue(fieldName)
  const target =
    document.querySelector(`[name="${escapedFieldName}"]`) ||
    document.querySelector(`[data-field-name="${escapedFieldName}"]`)

  if (!target) return

  const anchor = target.closest('[data-field-name]') || target
  anchor.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const focusTarget =
    anchor.matches('input, select, textarea, button, [contenteditable="true"]')
      ? anchor
      : anchor.querySelector('input, select, textarea, button, [contenteditable="true"]')

  if (focusTarget?.focus) {
    focusTarget.focus({ preventScroll: true })
  }
}

export function scrollToFirstError(errors = {}) {
  const firstFieldName = Object.keys(errors)[0]
  if (firstFieldName) scrollToField(firstFieldName)
}
