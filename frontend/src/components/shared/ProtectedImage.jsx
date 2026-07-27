import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { getStoredAuthHeader, resolveProtectedFileUrl } from '../../lib/openProtectedFile'

export default function ProtectedImage({ src, alt, className, fallback = null }) {
  const [objectUrl, setObjectUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  const objectUrlRef = useRef(null)

  useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    if (!src) {
      setObjectUrl(null)
      setFailed(false)
      return
    }

    let cancelled = false
    let nextObjectUrl = null

    const load = async () => {
      try {
        const authHeader = getStoredAuthHeader()
        const response = await axios.get(resolveProtectedFileUrl(src), {
          responseType: 'blob',
          headers: authHeader ? { Authorization: authHeader } : undefined,
        })
        if (cancelled) return
        const blob = response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: 'application/octet-stream' })
        nextObjectUrl = URL.createObjectURL(blob)
        objectUrlRef.current = nextObjectUrl
        setObjectUrl(nextObjectUrl)
        setFailed(false)
      } catch {
        if (cancelled) return
        setFailed(true)
        setObjectUrl(null)
      }
    }

    void load()

    return () => {
      cancelled = true
      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl)
        if (objectUrlRef.current === nextObjectUrl) objectUrlRef.current = null
      }
    }
  }, [src])

  useEffect(() => () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  if (!src || failed || !objectUrl) return fallback

  return <img src={objectUrl} alt={alt} className={className} />
}
