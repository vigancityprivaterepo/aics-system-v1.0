import { useCallback, useEffect, useRef, useState } from 'react'
import { renderAsync } from 'docx-preview'
import api from '../../lib/api'
import { DownloadIcon, FileTextIcon, XIcon } from '../../components/ui/Icons'

const RENDER_OPTIONS = {
  className: 'docx',
  inWrapper: true,
  ignoreWidth: false,
  ignoreHeight: false,
  ignoreFonts: false,
  breakPages: true,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
  renderEndnotes: true,
  useBase64URL: true,
}

export default function VehicleRequestPreview({ request, onClose }) {
  const [state, setState] = useState({ loading: true, error: false, message: '', html: '' })
  const bufferRef = useRef(null)
  const containerRef = useRef(null)

  const renderDocx = useCallback(async (arrayBuffer) => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''
    await renderAsync(arrayBuffer, containerRef.current, null, RENDER_OPTIONS)
  }, [])

  const loadHtmlFallback = useCallback(async () => {
    const res = await api.get(`/vehicle-requests/${request.id}/document/html`, { responseType: 'text' })
    setState({ loading: false, error: false, message: '', html: String(res.data ?? '') })
  }, [request.id])

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, error: false, message: '', html: '' })
    bufferRef.current = null

    api.get(`/vehicle-requests/${request.id}/document`, { responseType: 'arraybuffer' })
      .then(async (res) => {
        if (cancelled) return
        bufferRef.current = res.data
        try {
          await renderDocx(res.data)
          if (cancelled) return
          setState({ loading: false, error: false, message: '', html: '' })
        } catch (error) {
          if (cancelled) return
          try {
            await loadHtmlFallback()
          } catch (htmlError) {
            if (cancelled) return
            setState({
              loading: false,
              error: true,
              message: htmlError.response?.data?.message || error.message || 'Unable to preview request.',
              html: '',
            })
          }
        }
      })
      .catch((error) => {
        if (cancelled) return
        setState({
          loading: false,
          error: true,
          message: error.response?.data?.message || error.message || 'Unable to preview request.',
          html: '',
        })
      })

    return () => { cancelled = true }
  }, [loadHtmlFallback, renderDocx, request.id])

  const handleDownload = async () => {
    const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    try {
      const data = bufferRef.current
        ? new Blob([bufferRef.current], { type: mime })
        : await api.get(`/vehicle-requests/${request.id}/document`, { responseType: 'blob' }).then((res) => res.data)
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${request.requestNumber}-vehicle-request.docx`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      // parent page handles general errors
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-3 sm:p-6">
      <div className="mx-auto w-full max-w-6xl overflow-hidden bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <FileTextIcon className="h-4 w-4 text-brand-primary" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Vehicle Request Preview</h2>
              <p className="text-xs text-slate-500">{request.requestNumber} • {request.requestedBy}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800">
              <DownloadIcon className="h-3.5 w-3.5" />
              Download
            </button>
            <button onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-50" title="Close preview">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        {request.status === 'disapproved' ? (
          <div className="flex items-center gap-2.5 border-b border-red-300 bg-red-50 px-4 py-2.5 text-xs text-red-900 font-medium">
            <span className="text-base">⛔</span>
            <span>
              <strong>Disapproved Request Notice:</strong> This request was disapproved by Administration. The City Mayor's e-signature is omitted from this document.
            </span>
          </div>
        ) : request.status !== 'approved' && request.status !== 'processed' && (
          <div className="flex items-center gap-2.5 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 font-medium">
            <span className="text-base">⚠️</span>
            <span>
              <strong>Unapproved Request Notice:</strong> This request has not received administrative approval yet. The City Mayor's e-signature will be omitted until approved.
            </span>
          </div>
        )}
        <div className="relative overflow-auto bg-slate-300" style={{ minHeight: 620 }}>
          {state.loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-300 text-sm text-slate-500">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
              <span>Loading vehicle request preview...</span>
            </div>
          )}
          {state.error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-300 px-6 text-center text-sm text-slate-500">
              <FileTextIcon className="h-8 w-8 text-slate-400" />
              <p>Preview unavailable - request template could not be displayed.</p>
              {state.message && <p className="max-w-xl text-xs text-slate-500">{state.message}</p>}
            </div>
          )}
          {state.html ? (
            <iframe
              title="Vehicle request preview"
              srcDoc={state.html}
              className="block h-[75vh] w-full bg-white"
            />
          ) : (
            <div ref={containerRef} />
          )}
        </div>
      </div>
    </div>
  )
}
