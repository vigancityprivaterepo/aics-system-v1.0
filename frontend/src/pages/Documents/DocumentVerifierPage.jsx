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
    <div className="animate-fade-in space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <p className="portal-kicker">Document Security</p>
        <h1 className="portal-page-title">QR Verifier</h1>
        <p className="portal-page-subtitle">Verify guarantee letters and released documents by QR code.</p>
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.15fr,1fr]">
        <div className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="portal-kicker">Camera Scanner</p>
              <h2 className="mt-1 font-display text-[17px] font-bold text-[#0f2d52]">QR Verifier</h2>
            </div>
            <QrCodeIcon className="h-6 w-6 text-[#047857]" />
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
          <h2 className="mt-1 font-display text-base font-bold text-[#0f2d52]">Paste verification code or link</h2>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-gray-500 [text-wrap:pretty]">
            Accepted values include the full QR verification URL, compact token, or legacy verification code format.
          </p>

          <div className="mt-3.5 space-y-3">
            <textarea
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              rows={4}
              placeholder="Paste the QR link or token here"
              className="min-h-24 w-full resize-y rounded-[10px] border-2 border-slate-300 bg-white px-3.5 py-3 font-mono text-[12.5px] text-slate-800 placeholder:text-slate-400 focus:border-[#10b981] focus:outline-none focus:ring-4 focus:ring-emerald-500/[0.16]"
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
        <p className="portal-kicker">Verification Result</p>
        <h2 className="mt-1 font-display text-base font-bold text-[#0f2d52]">
          {result ? (result.valid ? 'Matching document found' : 'Verification needs attention') : 'No document verified yet'}
        </h2>

        {!result ? (
          <p className="mt-4 text-sm text-slate-500">Run a scan or paste a verification code to load the document record.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className={`flex items-center gap-2.5 rounded-[10px] px-3.5 py-3 ${
              result.valid ? 'bg-[#ecfdf5]' : 'bg-amber-50'
            }`}>
              {result.valid ? (
                <CheckCircleIcon className="h-5 w-5 shrink-0 text-[#047857]" />
              ) : (
                <AlertTriangleIcon className="h-5 w-5 shrink-0 text-amber-600" />
              )}
              <p className={`text-[13px] font-semibold ${result.valid ? 'text-[#065f46]' : 'text-amber-900'}`}>
                {result.valid ? 'Authentic — issued by CSWDO Vigan' : (result.message || 'Verification response received.')}
              </p>
            </div>
            {result.valid && result.message ? (
              <p className="text-xs text-slate-500">{result.message}</p>
            ) : null}

            {result.case ? (
              <>
                <dl className="flex flex-col">
                  {[
                    ['Document', String(result.kind || '').replace('-', ' ') || 'N/A', 'capitalize'],
                    ['Case number', result.case.caseNumber || 'N/A', 'font-mono text-xs text-[#0f2d52]'],
                    ['Beneficiary', result.case.clientName || 'N/A'],
                    ['Assistance type', result.case.assistanceType || 'N/A', 'capitalize'],
                    ['Case status', String(result.case.status || 'N/A').replace(/_/g, ' '), 'capitalize'],
                    ['Amount', formatCurrency(result.case.amount)],
                    ['Issued', formatDateTime(result.issuedAt)],
                  ].map(([label, value, extra = ''], index, rows) => (
                    <div
                      key={label}
                      className={`flex justify-between gap-3 py-2.5 ${index < rows.length - 1 ? 'border-b border-slate-100' : ''}`}
                    >
                      <dt className="text-[12.5px] text-gray-500">{label}</dt>
                      <dd className={`m-0 text-right text-[12.5px] font-semibold text-slate-800 ${extra}`}>{value}</dd>
                    </div>
                  ))}
                </dl>

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
