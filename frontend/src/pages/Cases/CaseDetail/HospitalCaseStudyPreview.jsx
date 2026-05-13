import { useEffect, useRef, useState, useCallback } from 'react'
import { renderAsync } from 'docx-preview'
import api from '../../../lib/api'
import { DownloadIcon, FileTextIcon, ChevronLeftIcon, ChevronRightIcon } from '../../../components/ui/Icons'

const DOCS = [
  { key: 'case-study',       label: 'Hospital Case Study', endpoint: (id) => `/cases/${id}/report/docx`,    downloadLabel: 'case-study' },
  { key: 'guarantee-letter', label: 'Guarantee Letter',    endpoint: (id) => `/cases/${id}/report/gl-docx`, downloadLabel: 'guarantee-letter' },
]

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

export default function HospitalCaseStudyPreview({ caseData }) {
  const [docIndex, setDocIndex] = useState(0)
  const [docState, setDocState] = useState({ 'case-study': { loading: true, error: false } })
  const abCache = useRef({})
  const containerRef = useRef(null)

  const currentDoc = DOCS[docIndex]
  const { loading = true, error = false } = docState[currentDoc.key] ?? {}

  const doRender = useCallback(async (key, arrayBuffer) => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''
    try {
      await renderAsync(arrayBuffer, containerRef.current, null, RENDER_OPTIONS)
      setDocState((p) => ({ ...p, [key]: { loading: false, error: false } }))
    } catch {
      setDocState((p) => ({ ...p, [key]: { loading: false, error: true } }))
    }
  }, [])

  const openDoc = (nextIndex) => {
    const nextDoc = DOCS[nextIndex]
    setDocState((previous) => ({
      ...previous,
      [nextDoc.key]: previous[nextDoc.key] ?? { loading: true, error: false },
    }))
    setDocIndex(nextIndex)
  }

  useEffect(() => {
    const doc = DOCS[docIndex]

    if (abCache.current[doc.key]) {
      doRender(doc.key, abCache.current[doc.key])
      return
    }

    let cancelled = false
    api.get(doc.endpoint(caseData.id), { responseType: 'arraybuffer' })
      .then((res) => {
        if (cancelled) return
        abCache.current[doc.key] = res.data
        doRender(doc.key, res.data)
      })
      .catch(() => {
        if (cancelled) return
        setDocState((p) => ({ ...p, [doc.key]: { loading: false, error: true } }))
      })

    return () => { cancelled = true }
  }, [docIndex, caseData.id, doRender])

  const handleDownload = async () => {
    const doc = DOCS[docIndex]
    const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    try {
      const data = abCache.current[doc.key]
        ? new Blob([abCache.current[doc.key]], { type: DOCX_MIME })
        : await api.get(doc.endpoint(caseData.id), { responseType: 'blob' }).then((r) => r.data)
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${caseData.caseNumber}-${doc.downloadLabel}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // parent handles toast
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-slate-100 border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => openDoc(Math.max(0, docIndex - 1))}
            disabled={docIndex === 0}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous document"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-1.5 px-2">
            <FileTextIcon className="h-4 w-4 text-brand-primary" />
            <span className="text-sm font-semibold text-slate-700">{currentDoc.label}</span>
            <span className="text-xs text-slate-400">({docIndex + 1} / {DOCS.length})</span>
          </div>

          <button
            onClick={() => openDoc(Math.min(DOCS.length - 1, docIndex + 1))}
            disabled={docIndex === DOCS.length - 1}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next document"
          >
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 bg-white">
        {DOCS.map((doc, i) => (
          <button
            key={doc.key}
            onClick={() => openDoc(i)}
            className={`px-5 py-2 text-xs font-medium transition-colors border-b-2 ${
              i === docIndex
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {doc.label}
          </button>
        ))}
      </div>

      {/* Render area */}
      <div className="relative bg-slate-300 overflow-auto" style={{ minHeight: 560 }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-300 text-slate-500 text-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
            <span>Loading {currentDoc.label}…</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-300 text-slate-500 text-sm">
            <FileTextIcon className="h-8 w-8 text-slate-400" />
            <p>Preview unavailable — backend may be offline or template is missing.</p>
          </div>
        )}
        <div ref={containerRef} />
      </div>
    </div>
  )
}
