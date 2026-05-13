import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import QrScanner from 'qr-scanner'
import api from '../../lib/api'
import { formatCurrency, formatDateTime } from '../../lib/utils'
import { AlertTriangleIcon, CheckCircleIcon, QrCodeIcon, RefreshIcon, SearchIcon, ShieldCheckIcon } from '../../components/ui/Icons'

function extractVerificationToken(rawValue) {
  const value = String(rawValue ?? '').trim()
  if (!value) return ''

  try {
    const url = new URL(value)
    const queryToken = url.searchParams.get('token')
    if (queryToken) return queryToken.trim()

    const pathMatch = url.pathname.match(/\/documents\/verify\/([^/]+)$/i)
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]).trim()
  } catch {
    return value
  }

  return value
}

export default function DocumentVerifierPage() {
  const videoRef = useRef(null)
  const scannerRef = useRef(null)

  const [manualValue, setManualValue] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState(null)
  const [lastScannedValue, setLastScannedValue] = useState('')

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop()
    }
    setCameraActive(false)
  }

  useEffect(() => () => {
    if (scannerRef.current) {
      scannerRef.current.destroy()
      scannerRef.current = null
    }
  }, [])

  const verifyToken = async (rawValue) => {
    const token = extractVerificationToken(rawValue)
    if (!token) {
      toast.error('Scan or enter a document verification code first.')
      return
    }

    setVerifying(true)
    setResult(null)
    setLastScannedValue(rawValue)

    try {
      const res = await api.get(`/documents/verify/${encodeURIComponent(token)}`)
      setResult(res.data)
      setManualValue(token)
      if (res.data.valid) {
        toast.success('Document verified')
      } else {
        toast.error(res.data.message || 'Document found but verification failed')
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to verify document'
      toast.error(message)
      setResult({
        valid: false,
        message,
      })
    } finally {
      setVerifying(false)
    }
  }

  const startCamera = async () => {
    setCameraError('')
    setResult(null)

    if (!videoRef.current) {
      setCameraError('Camera preview is not available.')
      return
    }

    try {
      const hasCamera = await QrScanner.hasCamera()
      if (!hasCamera) {
        setCameraError('No camera was found on this device.')
        return
      }
    } catch {
      setCameraError('This browser does not allow camera access.')
      return
    }

    try {
      if (!scannerRef.current) {
        scannerRef.current = new QrScanner(
          videoRef.current,
          (scanResult) => {
            stopCamera()
            void verifyToken(scanResult.data)
          },
          {
            preferredCamera: 'environment',
            maxScansPerSecond: 12,
            highlightScanRegion: false,
            highlightCodeOutline: false,
            returnDetailedScanResult: true,
            onDecodeError: (error) => {
              if (error === QrScanner.NO_QR_CODE_FOUND) return
              if (String(error || '').includes('No QR code found')) return
            },
          },
        )
      }

      await scannerRef.current.start()
      setCameraActive(true)
    } catch (error) {
      setCameraError(error?.message || 'Unable to start the camera scanner.')
      stopCamera()
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="portal-kicker">Camera Scanner</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-900">QR Verifier</h1>
            </div>
            <QrCodeIcon className="h-6 w-6 text-emerald-700" />
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
            <div className="relative h-64 sm:h-72">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              {!cameraActive ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
                  <ShieldCheckIcon className="h-10 w-10 text-emerald-300" />
                  <div>
                    <p className="text-base font-semibold">Camera is ready for scanning</p>
                    <p className="mt-1 text-sm text-slate-300">
                      Point the camera at the QR code printed on the document.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-40 w-40 rounded-3xl border-2 border-emerald-300/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)] sm:h-44 sm:w-44" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={cameraActive ? stopCamera : startCamera}
              className="portal-button-green"
              disabled={verifying}
            >
              {cameraActive ? 'Stop Camera' : 'Start Camera'}
            </button>
            <button
              type="button"
              onClick={() => void verifyToken(manualValue)}
              className="portal-button-secondary"
              disabled={verifying}
            >
              <SearchIcon className="h-4 w-4" />
              Verify Entered Code
            </button>
          </div>

          {cameraError ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{cameraError}</p>
              </div>
            </div>
          ) : null}

          {!cameraError ? (
            <p className="mt-4 text-xs text-slate-500">
              The scanner now uses a library fallback, so camera scanning can work even when the browser does not expose native QR detection.
            </p>
          ) : null}
        </div>

        <div className="card">
          <p className="portal-kicker">Manual Lookup</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Paste verification code or link</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Accepted values include the full QR verification URL, compact token, or legacy verification code format.
          </p>

          <div className="mt-4 space-y-3">
            <textarea
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              rows={4}
              placeholder="Paste the QR link or token here"
              className="portal-input min-h-24 w-full resize-y"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void verifyToken(manualValue)}
                className="portal-button-green"
                disabled={verifying}
              >
                {verifying ? 'Verifying...' : 'Verify Document'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualValue('')
                  setResult(null)
                  setCameraError('')
                }}
                className="portal-button-secondary"
                disabled={verifying}
              >
                <RefreshIcon className="h-4 w-4" />
                Clear
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last scanned value</p>
            <p className="mt-2 break-all font-mono text-xs text-slate-700">{lastScannedValue || 'None yet'}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="flex items-center gap-3">
          {result?.valid ? (
            <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
          ) : (
            <AlertTriangleIcon className="h-6 w-6 text-amber-600" />
          )}
          <div>
            <p className="portal-kicker">Verification Result</p>
            <h2 className="text-lg font-semibold text-slate-900">
              {result ? (result.valid ? 'Matching document found' : 'Verification needs attention') : 'No document verified yet'}
            </h2>
          </div>
        </div>

        {!result ? (
          <p className="mt-4 text-sm text-slate-500">Run a scan or paste a verification code to load the document record.</p>
        ) : (
          <div className="mt-5 space-y-4">
            <div className={`rounded-2xl border px-4 py-4 text-sm ${
              result.valid
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}>
              {result.message || 'Verification response received.'}
            </div>

            {result.case ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium text-slate-500">Case Number</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{result.case.caseNumber || 'N/A'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium text-slate-500">Client</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{result.case.clientName || 'N/A'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium text-slate-500">Document Type</p>
                    <p className="mt-2 text-sm font-semibold capitalize text-slate-900">{String(result.kind || '').replace('-', ' ') || 'N/A'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium text-slate-500">Amount</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(result.case.amount)}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">Assistance Type</p>
                    <p className="mt-2 text-sm font-semibold capitalize text-slate-900">{result.case.assistanceType || 'N/A'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">Case Status</p>
                    <p className="mt-2 text-sm font-semibold capitalize text-slate-900">{String(result.case.status || 'N/A').replace(/_/g, ' ')}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">Issued At</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(result.issuedAt)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link to={`/cases/${result.case.id}/profile`} className="portal-button-green">
                    Open Case Profile
                  </Link>
                  <Link to={`/cases/${result.case.id}/reports`} className="portal-button-secondary">
                    Open Case Reports
                  </Link>
                </div>
              </>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
