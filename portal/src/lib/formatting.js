const portalDateTimeFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
})

export function formatPortalDateTime(value, fallback = 'Not yet available') {
  if (!value) return fallback

  const parsedValue = new Date(value)
  if (Number.isNaN(parsedValue.getTime())) {
    return fallback
  }

  return portalDateTimeFormatter.format(parsedValue)
}

export function formatPortalStatus(status, fallback = 'pending') {
  if (!status) return fallback
  return String(status).replace(/_/g, ' ')
}
