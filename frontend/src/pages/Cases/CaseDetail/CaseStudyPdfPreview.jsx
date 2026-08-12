import { useEffect, useMemo, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import PdfJsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import { DownloadIcon, FileTextIcon } from '../../../components/ui/Icons'
import { fetchProtectedFileBlob } from '../../../lib/openProtectedFile'

if (!GlobalWorkerOptions.workerPort) {
  GlobalWorkerOptions.workerPort = new PdfJsWorker({ type: 'module' })
}

const SIGNATURE_STAGE_ORDER = ['prepared_by', 'for_review', 'recommending_approval', 'for_approval']
const MIN_ZOOM = 60
const MAX_ZOOM = 180
const DEFAULT_ZOOM = 100
const THUMBNAIL_WIDTH = 110
const MAIN_PAGE_BASE_WIDTH = 860
const MAX_PDF_PREVIEW_CACHE_ENTRIES = 8
const CASE_STUDY_LAYOUT_VERSION = 18
const pdfPreviewSessionCache = new Map()

function latestSignedStage(reportSignature) {
  if (!reportSignature?.stages) return null
  for (let index = SIGNATURE_STAGE_ORDER.length - 1; index >= 0; index -= 1) {
    const key = SIGNATURE_STAGE_ORDER[index]
    const stage = reportSignature.stages.find((item) => item.key === key)
    if (stage?.status === 'signed') return stage
  }
  return null
}

function previewCacheKey(caseData, source) {
  const reportSignature = caseData.reportSignature
  const stages = reportSignature?.stages ?? []
  return JSON.stringify({
    layoutVersion: CASE_STUDY_LAYOUT_VERSION,
    source,
    id: caseData.id,
    status: caseData.status,
    assistanceType: caseData.assistanceType,
    updatedAt: caseData.updatedAt ?? '',
    caseNumber: caseData.caseNumber ?? '',
    dateOfAssessment: caseData.dateOfAssessment ?? '',
    socialWorkerName: caseData.socialWorkerName ?? '',
    preparedBySignature: caseData.preparedBySignature ?? '',
    presentingProblem: caseData.presentingProblem ?? '',
    backgroundOfProblem: caseData.backgroundOfProblem ?? '',
    assessment: caseData.assessment ?? '',
    recommendation: caseData.recommendation ?? '',
    remarks: caseData.remarks ?? '',
    amount: caseData.amount ?? '',
    client: caseData.client ?? null,
    householdMembers: caseData.householdMembers ?? [],
    burialDetails: caseData.burialDetails ?? null,
    hospitalDetails: caseData.hospitalDetails ?? null,
    medicalDetails: caseData.medicalDetails ?? null,
    eyeglassDetails: caseData.eyeglassDetails ?? null,
    plainDetails: caseData.plainDetails ?? null,
    medicineDetails: caseData.medicineDetails ?? null,
    medicines: caseData.medicines ?? [],
    approvals: ['for_review', 'recommending_approval', 'for_approval'].map((stage) => {
      const approval = caseData.approvals?.[stage]
      return {
        stage,
        actedByName: approval?.actedByName ?? '',
        signatureUrl: approval?.signatureUrl ?? '',
        actedAt: approval?.actedAt ?? '',
      }
    }),
    reportSignature: {
      version: reportSignature?.version ?? 0,
      preparedAt: reportSignature?.preparedAt ?? '',
      activeStageKey: reportSignature?.activeStageKey ?? '',
      stages: stages.map((stage) => ({
        key: stage.key,
        status: stage.status,
        signedAt: stage.signedAt ?? '',
        signedFileUrl: stage.signedFileUrl ?? '',
      })),
    },
  })
}

function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
}

function getCachedPdfPreview(cacheKey) {
  const cached = pdfPreviewSessionCache.get(cacheKey)
  if (!cached) return null
  pdfPreviewSessionCache.delete(cacheKey)
  pdfPreviewSessionCache.set(cacheKey, cached)
  return cached
}

function setCachedPdfPreview(cacheKey, entry) {
  pdfPreviewSessionCache.delete(cacheKey)
  pdfPreviewSessionCache.set(cacheKey, entry)
  while (pdfPreviewSessionCache.size > MAX_PDF_PREVIEW_CACHE_ENTRIES) {
    const oldestKey = pdfPreviewSessionCache.keys().next().value
    if (!oldestKey) break
    pdfPreviewSessionCache.delete(oldestKey)
  }
}

async function loadPdfBlobWithFallback(caseId, source) {
  const endpoints = [
    `/api/cases/${caseId}/report-preview/pdf${source === 'generated' ? '?source=generated' : ''}`,
    `/api/cases/${caseId}/report/pdf`,
  ]

  let lastError = null

  for (const endpoint of endpoints) {
    try {
      const sourceBlob = await fetchProtectedFileBlob(endpoint)
      const pdfBlob = sourceBlob instanceof Blob
        ? sourceBlob
        : new Blob([sourceBlob], { type: 'application/pdf' })

      if (!pdfBlob.size) {
        throw new Error('The generated PDF preview is empty.')
      }

      return pdfBlob
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('Unable to load PDF preview.')
}

export default function CaseStudyPdfPreview({ caseData, title }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [thumbnailUrls, setThumbnailUrls] = useState([])
  const [renderingPage, setRenderingPage] = useState(false)

  const blobRef = useRef(null)
  const pdfDocumentRef = useRef(null)
  const mainCanvasRef = useRef(null)
  const pageWrapperRef = useRef(null)

  const reportSignature = caseData.reportSignature ?? null
  const latestStage = latestSignedStage(reportSignature)
  const [previewSource, setPreviewSource] = useState(latestStage ? 'signed' : 'generated')
  const previewSourceLabel = previewSource === 'signed' && latestStage
    ? `Signed preview from ${latestStage.label}`
    : 'Generated draft preview with current template'
  const currentSignerLabel = reportSignature?.activeStageKey
    ? reportSignature.stages.find((stage) => stage.key === reportSignature.activeStageKey)?.label ?? null
    : null
  const cacheKey = useMemo(() => previewCacheKey(caseData, previewSource), [caseData, previewSource])

  useEffect(() => {
    let cancelled = false
    let loadingTaskRef = null
    let pdfDocumentRefLocal = null

    async function loadPreview() {
      const cachedPreview = getCachedPdfPreview(cacheKey)
      setLoading(true)
      setError('')
      setPageCount(0)
      setCurrentPage(1)
      setZoom(DEFAULT_ZOOM)
      setThumbnailUrls(cachedPreview?.thumbnailUrls ?? [])

      if (mainCanvasRef.current) {
        const context = mainCanvasRef.current.getContext('2d')
        context?.clearRect(0, 0, mainCanvasRef.current.width, mainCanvasRef.current.height)
      }

      try {
        const pdfBlob = cachedPreview?.blob ?? await loadPdfBlobWithFallback(caseData.id, previewSource)
        if (cancelled) return

        blobRef.current = pdfBlob
        const loadingTask = getDocument({ data: new Uint8Array(await pdfBlob.arrayBuffer()) })
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

        const nextThumbs = cachedPreview?.pageCount === pdfDocument.numPages
          ? [...(cachedPreview.thumbnailUrls ?? Array.from({ length: pdfDocument.numPages }, () => null))]
          : Array.from({ length: pdfDocument.numPages }, () => null)
        setThumbnailUrls([...nextThumbs])
        setCachedPdfPreview(cacheKey, {
          blob: pdfBlob,
          pageCount: pdfDocument.numPages,
          thumbnailUrls: [...nextThumbs],
        })
        for (let index = 1; index <= pdfDocument.numPages; index += 1) {
          if (nextThumbs[index - 1]) continue
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
            setCachedPdfPreview(cacheKey, {
              blob: pdfBlob,
              pageCount: pdfDocument.numPages,
              thumbnailUrls: [...nextThumbs],
            })
          }
        }
      } catch (err) {
        if (cancelled) return
        blobRef.current = null
        pdfDocumentRef.current = null
        setLoading(false)
        setError(err?.response?.data?.message ?? err?.message ?? 'Unable to load PDF preview.')
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
  }, [caseData.id, cacheKey, previewSource])

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
        setError(err?.message ?? 'Unable to render the selected page.')
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
    link.download = `${caseData.caseNumber}-case-study-${previewSource}-preview.pdf`
    link.click()
    URL.revokeObjectURL(url)
  }

  const canGoPrev = currentPage > 1
  const canGoNext = currentPage < pageCount

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between bg-[#3a3a3a] px-4 py-3 text-white">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileTextIcon className="h-4 w-4 text-slate-100" />
            <span className="truncate text-sm font-semibold">{title}</span>
          </div>
          <p className="mt-1 text-xs text-slate-300">{previewSourceLabel}</p>
          {currentSignerLabel && (
            <p className="text-xs text-slate-400">Current signer: {currentSignerLabel}</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          {latestStage && (
            <div className="mr-2 flex rounded border border-slate-500 bg-[#2b2b2b] p-0.5">
              <button
                type="button"
                onClick={() => setPreviewSource('generated')}
                className={`rounded px-2 py-1 ${previewSource === 'generated' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
              >
                Generated Draft
              </button>
              <button
                type="button"
                onClick={() => setPreviewSource('signed')}
                className={`rounded px-2 py-1 ${previewSource === 'signed' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
              >
                Latest Signed
              </button>
            </div>
          )}
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
            <span>Loading PDF preview...</span>
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
                      <img src={thumbnailUrls[index]} alt={`Page ${pageNumber}`} className="block w-full" />
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
