import { useEffect, useRef, useCallback } from 'react'

/**
 * useRfidScanner detects RFID UID input from keyboard-output readers, pasted text,
 * and the local ACS PC/SC bridge at http://127.0.0.1:17654.
 */
export function useRfidScanner({ onScan, enabled = true, minLen = 4 } = {}) {
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const lastBridgeUidRef = useRef('')
  const lastBridgeScanAtRef = useRef(0)
  const SCAN_INTERVAL_MS = 250
  const ACS_BRIDGE_URL = 'http://127.0.0.1:17654/uid'

  const normalizeUid = useCallback((value) => {
    return String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
  }, [])

  const submitScan = useCallback(
    (rawValue) => {
      const uid = normalizeUid(rawValue)
      if (uid.length >= minLen) onScan?.(uid)
    },
    [minLen, normalizeUid, onScan]
  )

  const handleKeyDown = useCallback(
    (e) => {
      if (!enabled) return

      const now = Date.now()
      const gap = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      if (gap > SCAN_INTERVAL_MS && bufferRef.current.length > 0) {
        bufferRef.current = ''
      }

      if (e.key === 'Enter') {
        const uid = bufferRef.current
        bufferRef.current = ''
        if (normalizeUid(uid).length >= minLen) {
          e.preventDefault()
          submitScan(uid)
        }
        return
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key
      }
    },
    [enabled, minLen, normalizeUid, submitScan]
  )

  const handlePaste = useCallback(
    (e) => {
      if (!enabled) return
      const text = e.clipboardData?.getData('text')
      if (!text) return
      if (normalizeUid(text).length >= minLen) {
        e.preventDefault()
        bufferRef.current = ''
        submitScan(text)
      }
    },
    [enabled, minLen, normalizeUid, submitScan]
  )

  useEffect(() => {
    if (!enabled) return
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('paste', handlePaste)
    }
  }, [enabled, handleKeyDown, handlePaste])

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    let stopped = false

    const pollBridge = async () => {
      if (stopped) return

      try {
        const response = await fetch(ACS_BRIDGE_URL, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (response.ok) {
          const data = await response.json()
          const uid = normalizeUid(data?.uid)
          const now = Date.now()
          const isRepeat = uid === lastBridgeUidRef.current && now - lastBridgeScanAtRef.current < 2500

          if (uid.length >= minLen && !isRepeat) {
            lastBridgeUidRef.current = uid
            lastBridgeScanAtRef.current = now
            submitScan(uid)
          }
        }
      } catch {
        // The ACS bridge is optional. Keyboard and paste-based readers still work.
      } finally {
        if (!stopped) window.setTimeout(pollBridge, 700)
      }
    }

    pollBridge()

    return () => {
      stopped = true
      controller.abort()
    }
  }, [enabled, minLen, normalizeUid, submitScan])
}