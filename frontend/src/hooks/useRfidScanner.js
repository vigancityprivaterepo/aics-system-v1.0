import { useCallback, useEffect, useRef } from 'react'

/**
 * Detects UID input from keyboard-output readers, pasted text, and the optional
 * ACS PC/SC bridge running on the same device as the browser.
 */
export function useRfidScanner({ onScan, enabled = true, minLen = 4 } = {}) {
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const idleTimerRef = useRef(null)
  const lastBridgeUidRef = useRef('')
  const lastBridgeScanAtRef = useRef(0)
  const MAX_KEY_GAP_MS = 500
  const IDLE_SUBMIT_MS = 320
  const ACS_BRIDGE_URL = import.meta.env.VITE_RFID_BRIDGE_URL || 'http://127.0.0.1:17654/uid'

  const normalizeUid = useCallback((value) => String(value ?? '').trim().toUpperCase().replace(/[^0-9A-Z]/g, ''), [])

  const submitScan = useCallback((rawValue) => {
    const uid = normalizeUid(rawValue)
    if (uid.length >= minLen) onScan?.(uid)
  }, [minLen, normalizeUid, onScan])

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = null
  }, [])

  const submitBuffer = useCallback(() => {
    clearIdleTimer()
    const uid = bufferRef.current
    bufferRef.current = ''
    if (normalizeUid(uid).length >= minLen) submitScan(uid)
  }, [clearIdleTimer, minLen, normalizeUid, submitScan])

  const scheduleIdleSubmit = useCallback(() => {
    clearIdleTimer()
    idleTimerRef.current = window.setTimeout(submitBuffer, IDLE_SUBMIT_MS)
  }, [clearIdleTimer, submitBuffer])

  const handleKeyDown = useCallback((event) => {
    if (!enabled || event.ctrlKey || event.altKey || event.metaKey) return

    const now = Date.now()
    const gap = now - lastKeyTimeRef.current
    lastKeyTimeRef.current = now
    if (gap > MAX_KEY_GAP_MS) bufferRef.current = ''

    if (event.key === 'Enter' || event.key === 'Tab') {
      if (normalizeUid(bufferRef.current).length >= minLen) {
        event.preventDefault()
        submitBuffer()
      }
      return
    }

    if (event.key === 'Backspace') {
      bufferRef.current = bufferRef.current.slice(0, -1)
      scheduleIdleSubmit()
      return
    }

    if (event.key.length === 1) {
      bufferRef.current += event.key
      scheduleIdleSubmit()
    }
  }, [enabled, minLen, normalizeUid, scheduleIdleSubmit, submitBuffer])

  const handlePaste = useCallback((event) => {
    if (!enabled) return
    const text = event.clipboardData?.getData('text')
    if (normalizeUid(text).length < minLen) return
    event.preventDefault()
    clearIdleTimer()
    bufferRef.current = ''
    submitScan(text)
  }, [clearIdleTimer, enabled, minLen, normalizeUid, submitScan])

  useEffect(() => {
    if (!enabled) return undefined
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('paste', handlePaste, true)
    return () => {
      clearIdleTimer()
      bufferRef.current = ''
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('paste', handlePaste, true)
    }
  }, [clearIdleTimer, enabled, handleKeyDown, handlePaste])

  useEffect(() => {
    if (!enabled) return undefined
    const controller = new AbortController()
    let stopped = false

    const pollBridge = async () => {
      if (stopped) return
      try {
        const response = await fetch(ACS_BRIDGE_URL, { cache: 'no-store', signal: controller.signal })
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
        // Optional per-device bridge. HID keyboard and manual UID entry remain available.
      } finally {
        if (!stopped) window.setTimeout(pollBridge, 700)
      }
    }

    pollBridge()
    return () => { stopped = true; controller.abort() }
  }, [ACS_BRIDGE_URL, enabled, minLen, normalizeUid, submitScan])
}