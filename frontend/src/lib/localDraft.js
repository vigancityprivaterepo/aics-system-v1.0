import { useEffect, useRef } from 'react'

const DEBOUNCE_MS = 1000

/** Debounce-writes `data` to localStorage under `key` while `enabled`. */
export function useAutosaveDraft(key, data, { enabled = true } = {}) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (!enabled || !key) return undefined
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }))
      } catch {
        // storage full/unavailable - autosave silently no-ops
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, JSON.stringify(data)])
}

export function readLocalDraft(key) {
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.data !== undefined ? parsed : null
  } catch {
    return null
  }
}

export function clearLocalDraft(key) {
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
