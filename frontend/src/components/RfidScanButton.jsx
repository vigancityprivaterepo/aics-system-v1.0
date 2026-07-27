import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useRfidScanner } from '../hooks/useRfidScanner'


/**
 * RfidScanButton
 *
 * Activates RFID scan mode. Keyboard-output readers are detected automatically.
 * ACS PC/SC readers are read automatically through the local bridge.
 */
export default function RfidScanButton({ onClientFound, disabled = false, className = '' }) {
  const [active, setActive] = useState(false)
  const [scanning, setScanning] = useState(false)

  const handleScan = useCallback(
    async (rawUid) => {
      const uid = String(rawUid ?? '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '')
      if (scanning || uid.length < 4) return
      setScanning(true)
      try {
        const res = await api.get(`/clients/rfid/${encodeURIComponent(uid)}`, {
          headers: { 'Cache-Control': 'no-cache' },
          params: { t: Date.now() },
        })
        setActive(false)
        onClientFound?.(res.data)
        toast.success(`Card matched: ${res.data.lastName}, ${res.data.firstName}`)
      } catch (err) {
        const msg = err.response?.data?.message ?? 'RFID card not registered'
        if (err.response?.status === 404) {
          toast.error('Card not registered to any client. Please enroll the card first.')
        } else {
          toast.error(msg)
        }
      } finally {
        setScanning(false)
      }
    },
    [scanning, onClientFound]
  )

  useRfidScanner({ onScan: handleScan, enabled: active && !disabled })

  const toggle = () => {
    if (disabled) return
    setActive((v) => !v)
  }


  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        title={active ? 'Click to cancel RFID scan' : 'Activate RFID card scan'}
        className={`
          relative flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium
          transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
          ${active
            ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100'
            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
          }
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        `}
      >
        <RfidIcon active={active} scanning={scanning} />
        <span>{active ? (scanning ? 'Reading card...' : 'Tap card now') : 'RFID Scan'}</span>
        {active && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
      </button>
    </div>
  )
}

function RfidIcon({ active, scanning }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`h-4 w-4 transition-all ${active ? (scanning ? 'text-emerald-400 animate-pulse' : 'text-emerald-600') : 'text-slate-400'}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <rect x="2" y="6" width="20" height="13" rx="2" strokeLinecap="round" />
      <path strokeLinecap="round" d="M15.5 10.5a3 3 0 0 1 0 4" />
      <path strokeLinecap="round" d="M17.5 8.5a6 6 0 0 1 0 8" />
      <rect x="6" y="10" width="5" height="4" rx="0.5" />
    </svg>
  )
}