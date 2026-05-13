import axios from 'axios'
import api from './api'

function getStoredAuthHeader() {
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

function resolveProtectedFileUrl(fileUrl) {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl

  const normalizedPath = String(fileUrl).replace(/^\/?api\/uploads\//i, '/uploads/')
  const apiBase = String(api.defaults.baseURL || window.location.origin)
  const originBase = apiBase.replace(/\/api\/?$/, '/')
  return new URL(normalizedPath, originBase).toString()
}

export async function openProtectedFile(fileUrl, filename = 'document') {
  const previewWindow = window.open('', '_blank')
  const url = resolveProtectedFileUrl(fileUrl)
  const authHeader = getStoredAuthHeader()
  try {
    const res = await axios.get(url, {
      responseType: 'blob',
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
    const sourceBlob = res.data instanceof Blob
      ? res.data
      : new Blob([res.data], { type: 'application/octet-stream' })
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
