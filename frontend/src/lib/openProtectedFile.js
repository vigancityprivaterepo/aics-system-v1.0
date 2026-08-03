import axios from 'axios'
import api from './api'

export function getStoredAuthHeader() {
  const inMemory = api.defaults.headers.common?.Authorization
  if (inMemory) return inMemory

  try {
    const raw = window.localStorage.getItem('aics-auth')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const token = parsed?.state?.token
    return token ? `Bearer ${token}` : null
  } catch {
    return null
  }
}

export function resolveProtectedFileUrl(fileUrl) {
  const rawValue = String(fileUrl || '')
  let normalizedPath = rawValue.replace(/^\/?api\/uploads\//i, '/uploads/')

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      const parsed = new URL(rawValue)
      const uploadsMatch = parsed.pathname.match(/\/uploads\/.*$/i)
      if (uploadsMatch?.[0]) {
        normalizedPath = uploadsMatch[0]
      } else {
        return rawValue
      }
    } catch {
      return rawValue
    }
  }

  const apiBase = String(api.defaults.baseURL || '')
  let absoluteApiBase
  try {
    absoluteApiBase = new URL(apiBase || '/api', window.location.origin).toString()
  } catch {
    absoluteApiBase = new URL('/api', window.location.origin).toString()
  }

  const originBase = absoluteApiBase.replace(/\/api\/?$/i, '/')
  return new URL(normalizedPath, originBase).toString()
}

export async function fetchProtectedFileBlob(fileUrl) {
  const url = resolveProtectedFileUrl(fileUrl)
  const authHeader = getStoredAuthHeader()
  const res = await axios.get(url, {
    responseType: 'blob',
    headers: authHeader ? { Authorization: authHeader } : undefined,
  })
  return res.data instanceof Blob
    ? res.data
    : new Blob([res.data], { type: 'application/octet-stream' })
}

export async function openProtectedFile(fileUrl, filename = 'document') {
  const previewWindow = window.open('', '_blank')
  try {
    const sourceBlob = await fetchProtectedFileBlob(fileUrl)
    const objectUrl = URL.createObjectURL(sourceBlob)

    if (previewWindow) {
      previewWindow.location.href = objectUrl
      return
    }

    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (error) {
    if (previewWindow && !previewWindow.closed) {
      previewWindow.close()
    }
    throw error
  }
}
