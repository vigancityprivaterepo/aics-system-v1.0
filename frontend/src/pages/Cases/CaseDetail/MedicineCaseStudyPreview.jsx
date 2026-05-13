import { useEffect, useRef, useState, useCallback } from 'react'
import { renderAsync } from 'docx-preview'
import api from '../../../lib/api'
import { DownloadIcon, FileTextIcon } from '../../../components/ui/Icons'

const DOC = {
  key: 'case-study',
  label: 'Medicine Case Study',
  endpoint: (id) => `/cases/${id}/report/docx`,
  downloadLabel: 'case-study',
}

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

export default function MedicineCaseStudyPreview({ caseData }) {
  const [state, setState] = useState({ loading: true, error: false })
  const abCache = useRef(null)
  const containerRef = useRef(null)

  const doRender = useCallback(async (arrayBuffer) => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''
    try {
      await renderAsync(arrayBuffer, containerRef.current, null, RENDER_OPTIONS)
      setState({ loading: false, error: false })
    } catch {
      setState({ loading: false, error: true })
    }
  }, [])

  useEffect(() => {
    if (abCache.current) {
      doRender(abCache.current)
      return
    }

    let cancelled = false
    api.get(DOC.endpoint(caseData.id), { responseType: 'arraybuffer' })
      .then((res) => {
        if (cancelled) return
        abCache.current = res.data
        doRender(res.data)
      })
      .catch(() => {
        if (cancelled) return
        setState({ loading: false, error: true })
      })

    return () => { cancelled = true }
  }, [caseData.id, doRender])

  const handleDownload = async () => {
    const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    try {
      const data = abCache.current
        ? new Blob([abCache.current], { type: DOCX_MIME })
        : await api.get(DOC.endpoint(caseData.id), { responseType: 'blob' }).then((r) => r.data)
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${caseData.caseNumber}-${DOC.downloadLabel}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // parent handles toast
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between bg-slate-100 border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-1.5 px-1">
          <FileTextIcon className="h-4 w-4 text-brand-primary" />
          <span className="text-sm font-semibold text-slate-700">{DOC.label}</span>
        </div>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          Download
        </button>
      </div>

      <div className="relative bg-slate-300 overflow-auto" style={{ minHeight: 560 }}>
        {state.loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-300 text-slate-500 text-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
            <span>Loading {DOC.label}...</span>
          </div>
        )}
        {state.error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-300 text-slate-500 text-sm">
            <FileTextIcon className="h-8 w-8 text-slate-400" />
            <p>Preview unavailable - backend may be offline or template is missing.</p>
          </div>
        )}
        <div ref={containerRef} />
      </div>
    </div>
  )
}
