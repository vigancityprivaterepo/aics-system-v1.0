import { useEffect, useMemo, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import PdfJsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import { DownloadIcon, FileTextIcon } from './ui/Icons'
import { fetchProtectedFileBlob } from '../lib/openProtectedFile'

if (!GlobalWorkerOptions.workerPort) {
  GlobalWorkerOptions.workerPort = new PdfJsWorker({ type: 'module' })
}

const MIN_ZOOM = 60
const MAX_ZOOM = 180
const DEFAULT_ZOOM = 100
const THUMBNAIL_WIDTH = 110
const MAIN_PAGE_BASE_WIDTH = 860

function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
}

function isPdfFile(url) {
  return /\.pdf(?:$|[?#])/i.test(String(url ?? '').trim())
}

function getSignedGlInfo(caseData) {
  const type = caseData.assistanceType
  if (type === 'burial') return { url: caseData.burialDetails?.signedGlUrl, at: caseData.burialDetails?.glUploadedAt }
  if (type === 'hospital') return { url: caseData.hospitalDetails?.signedGlUrl, at: caseData.hospitalDetails?.glUploadedAt }
  if (type === 'medical') return { url: caseData.medicalDetails?.signedGlUrl, at: caseData.medicalDetails?.glUploadedAt }
  return { url: null, at: null }
}

async function loadGuaranteeLetterBlob(caseData) {
  const signedGl = getSignedGlInfo(caseData).url
  const candidates = []

  if (signedGl && isPdfFile(signedGl)) {
    candidates.push({ endpoint: signedGl, source: 'signed' })
  }
  candidates.push({ endpoint: `/api/cases/${caseData.id}/guarantee-letter/pdf`, source: 'generated' })

  let lastError = null

  for (const candidate of candidates) {
    try {
      const sourceBlob = await fetchProtectedFileBlob(candidate.endpoint)
      const pdfBlob = sourceBlob instanceof Blob
        ? sourceBlob
        : new Blob([sourceBlob], { type: 'application/pdf' })

      if (!pdfBlob.size) {
        throw new Error('The guarantee letter PDF preview is empty.')
      }

      return { blob: pdfBlob, source: candidate.source }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('Unable to load guarantee letter PDF preview.')
}

export default function GuaranteeLetterPdfPreview({ caseData, title }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [thumbnailUrls, setThumbnailUrls] = useState([])
  const [renderingPage, setRenderingPage] = useState(false)
  const [previewSource, setPreviewSource] = useState('generated')

  const blobRef = useRef(null)
  const pdfDocumentRef = useRef(null)
  const mainCanvasRef = useRef(null)
  const pageWrapperRef = useRef(null)

  const cacheKey = useMemo(() => JSON.stringify({
    id: caseData.id,
    status: caseData.status,
    assistanceType: caseData.assistanceType,
    updatedAt: caseData.updatedAt ?? '',
    caseNumber: caseData.caseNumber ?? '',
    amount: caseData.amount ?? '',
    client: caseData.client ?? null,
    burialDetails: caseData.burialDetails ?? null,
    hospitalDetails: caseData.hospitalDetails ?? null,
    medicalDetails: caseData.medicalDetails ?? null,
  }), [caseData])

  useEffect(() => {
    let cancelled = false
    let loadingTaskRef = null
    let pdfDocumentRefLocal = null

    async function loadPreview() {
      setLoading(true)
      setError('')
      setPageCount(0)
      setCurrentPage(1)
      setZoom(DEFAULT_ZOOM)
      setThumbnailUrls([])
      setPreviewSource('generated')

      if (mainCanvasRef.current) {
        const context = mainCanvasRef.current.getContext('2d')
        context?.clearRect(0, 0, mainCanvasRef.current.width, mainCanvasRef.current.height)
      }

      try {
        const { blob, source } = await loadGuaranteeLetterBlob(caseData)
        if (cancelled) return

        blobRef.current = blob
        setPreviewSource(source)
        const loadingTask = getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })
        loadingTaskRef = loadingTask
        const pdfDocument = await loadingTask.promise
        if (cancelled) {
          if (typeof loadingTask.destroy === 'function') {
            await loadingTask.destroy()
          }
          return
        }

        pdfDocumentRefLocal = pdfDocument
        pdfDocumentRef.current = pdfDocument
        setPageCount(pdfDocument.numPages)
        setLoading(false)

        const nextThumbs = Array.from({ length: pdfDocument.numPages }, () => null)
        for (let index = 1; index <= pdfDocument.numPages; index += 1) {
          const page = await pdfDocument.getPage(index)
          if (cancelled) return

          const baseViewport = page.getViewport({ scale: 1 })
          const scale = THUMBNAIL_WIDTH / baseViewport.width
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) continue

          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvasContext: context, viewport }).promise
          nextThumbs[index - 1] = canvas.toDataURL('image/png')
          if (!cancelled) {
            setThumbnailUrls([...nextThumbs])
          }
        }
      } catch (err) {
        if (cancelled) return
        blobRef.current = null
        pdfDocumentRef.current = null
        setLoading(false)
        setError(err?.response?.data?.message ?? err?.message ?? 'Unable to load guarantee letter PDF preview.')
      }
    }

    loadPreview()

    return () => {
      cancelled = true
      pdfDocumentRef.current = null
      if (pdfDocumentRefLocal && typeof pdfDocumentRefLocal.cleanup === 'function') {
        try {
          pdfDocumentRefLocal.cleanup()
        } catch {
          // ignore cleanup failures during unmount
        }
      }
      if (loadingTaskRef && typeof loadingTaskRef.destroy === 'function') {
        Promise.resolve(loadingTaskRef.destroy()).catch(() => {})
      }
    }
  }, [caseData, cacheKey])

  useEffect(() => {
    let cancelled = false
    let renderTask = null

    async function renderCurrentPage() {
      const pdfDocument = pdfDocumentRef.current
      const canvas = mainCanvasRef.current
      if (!pdfDocument || !canvas || loading || error || pageCount === 0) return

      setRenderingPage(true)

      try {
        const page = await pdfDocument.getPage(currentPage)
        if (cancelled) return

        const baseViewport = page.getViewport({ scale: 1 })
        const hostWidth = Math.max(640, Math.min(pageWrapperRef.current?.clientWidth ?? MAIN_PAGE_BASE_WIDTH, MAIN_PAGE_BASE_WIDTH))
        const fitScale = hostWidth / baseViewport.width
        const viewport = page.getViewport({ scale: fitScale * (zoom / 100) })
        const context = canvas.getContext('2d')
        if (!context) {
          throw new Error('Canvas rendering is not available in this browser.')
        }

        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        renderTask = page.render({ canvasContext: context, viewport })
        await renderTask.promise
        if (!cancelled) {
          setRenderingPage(false)
        }
      } catch (err) {
        if (cancelled) return
        setRenderingPage(false)
        setError(err?.message ?? 'Unable to render the selected guarantee letter page.')
      }
    }

    renderCurrentPage()

    return () => {
      cancelled = true
      if (renderTask) {
        try {
          renderTask.cancel()
        } catch {
          // ignore cancelled render task errors
        }
      }
    }
  }, [currentPage, zoom, loading, error, pageCount, cacheKey])

  const handleDownload = () => {
    const blob = blobRef.current
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${caseData.caseNumber}-guarantee-letter-preview.pdf`
    link.click()
    URL.revokeObjectURL(url)
  }

  const canGoPrev = currentPage > 1
  const canGoNext = currentPage < pageCount
  const previewSourceLabel = previewSource === 'signed'
    ? 'Preview source: signed guarantee letter PDF'
    : 'Preview source: generated guarantee letter PDF'

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between bg-[#3a3a3a] px-4 py-3 text-white">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileTextIcon className="h-4 w-4 text-slate-100" />
            <span className="truncate text-sm font-semibold">{title}</span>
          </div>
          <p className="mt-1 text-xs text-slate-300">{previewSourceLabel}</p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={!canGoPrev}
            className="rounded border border-slate-500 px-2 py-1 text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <div className="rounded bg-[#1f1f1f] px-3 py-1 font-medium">
            {pageCount > 0 ? `${currentPage} / ${pageCount}` : '- / -'}
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
            disabled={!canGoNext}
            className="rounded border border-slate-500 px-2 py-1 text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => setZoom((value) => clampZoom(value - 10))}
            className="rounded border border-slate-500 px-2 py-1 text-slate-100 transition-colors hover:bg-slate-600"
          >
            -
          </button>
          <div className="rounded bg-[#1f1f1f] px-3 py-1 font-medium">{zoom}%</div>
          <button
            type="button"
            onClick={() => setZoom((value) => clampZoom(value + 10))}
            className="rounded border border-slate-500 px-2 py-1 text-slate-100 transition-colors hover:bg-slate-600"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!blobRef.current}
            className="inline-flex items-center gap-1 rounded border border-slate-500 px-3 py-1 text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </div>

      <div className="relative flex min-h-[720px] bg-[#2f2f2f]">
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#2f2f2f] text-sm text-slate-300">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Loading guarantee letter preview...</span>
          </div>
        )}

        {!loading && error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#2f2f2f] px-6 text-center text-sm text-slate-300">
            <FileTextIcon className="h-8 w-8 text-slate-400" />
            <p>Preview unavailable.</p>
            <p className="max-w-xl text-xs text-slate-400">{error}</p>
          </div>
        )}

        <aside className={`w-44 shrink-0 overflow-y-auto border-r border-slate-700 bg-[#232323] px-3 py-4 ${loading || error ? 'invisible' : ''}`}>
          <div className="space-y-4">
            {Array.from({ length: pageCount }, (_, index) => {
              const pageNumber = index + 1
              const isActive = pageNumber === currentPage
              return (
                <button
                  key={`${cacheKey}-thumb-${pageNumber}`}
                  type="button"
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`block w-full rounded border p-2 text-center transition-colors ${
                    isActive
                      ? 'border-sky-400 bg-sky-950/40'
                      : 'border-slate-700 bg-[#2b2b2b] hover:border-slate-500 hover:bg-[#343434]'
                  }`}
                >
                  <div className="mx-auto flex min-h-[140px] items-center justify-center overflow-hidden rounded bg-white shadow-sm">
                    {thumbnailUrls[index] ? (
                      <img src={thumbnailUrls[index]} alt={`Guarantee letter page ${pageNumber}`} className="block w-full" />
                    ) : (
                      <div className="text-xs text-slate-400">Loading...</div>
                    )}
                  </div>
                  <div className={`mt-2 text-xs font-medium ${isActive ? 'text-sky-300' : 'text-slate-300'}`}>
                    {pageNumber}
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <div ref={pageWrapperRef} className={`flex-1 overflow-auto px-6 py-6 ${loading || error ? 'invisible' : ''}`}>
          <div className="flex min-h-full items-start justify-center">
            <div className="relative rounded-sm bg-white shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
              {renderingPage && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-black/10 text-xs text-slate-600">
                  Rendering page...
                </div>
              )}
              <canvas ref={mainCanvasRef} className="block rounded-sm bg-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
