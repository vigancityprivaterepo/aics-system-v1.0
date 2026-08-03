import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { openProtectedFile } from '../lib/openProtectedFile'
import { CheckCircleIcon, DownloadIcon, RefreshIcon, UploadIcon } from './ui/Icons'

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function CaseStudySignaturePanel({ caseData, onUpdated }) {
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const fileInputRef = useRef(null)
  const replacementInputRef = useRef(null)

  const reportSignature = caseData.reportSignature
  if (!reportSignature) return null

  const activeStage = reportSignature.activeStageKey
    ? reportSignature.stages.find((stage) => stage.key === reportSignature.activeStageKey)
    : null
  const canDownloadCurrentPdf = Boolean(reportSignature.currentDownload?.endpoint)

  const handleDownload = async () => {
    if (!reportSignature.currentDownload?.endpoint) return
    setDownloading(true)
    try {
      const res = await api.get(reportSignature.currentDownload.endpoint, { responseType: 'blob' })
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }), reportSignature.currentDownload.fileName)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to download case study PDF for signing')
    } finally {
      setDownloading(false)
    }
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const confirmed = window.confirm(
      `Upload "${file.name}" for ${activeStage?.label ?? 'the current signer'}? This will forward the case to the next stage.`,
    )
    if (!confirmed) {
      event.target.value = ''
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post(`/cases/${caseData.id}/report-signature/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onUpdated?.({ reportSignature: data.reportSignature })
      toast.success('Signed case study PDF uploaded')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to upload signed case study PDF')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleReplacement = async (event) => {
    const file = event.target.files?.[0]
    const replaceableStage = reportSignature.replaceableStage
    if (!file || !replaceableStage) return

    const confirmed = window.confirm(
      `Replace the latest ${replaceableStage.label} upload with "${file.name}"? The old file will be retained in the audit history.`,
    )
    if (!confirmed) {
      event.target.value = ''
      return
    }

    setReplacing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('stageKey', replaceableStage.key)
      formData.append('reason', 'Incorrect signed PDF was uploaded.')
      await api.post(`/cases/${caseData.id}/report-signature/replace`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await onUpdated?.()
      toast.success(`${replaceableStage.label} signed PDF replaced`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to replace the signed case study PDF')
    } finally {
      setReplacing(false)
      event.target.value = ''
    }
  }

  const handleOpenFinal = async () => {
    if (!reportSignature.finalSignedReportUrl) return
    try {
      await openProtectedFile(reportSignature.finalSignedReportUrl, `${caseData.caseNumber}-signed-case-study.pdf`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to open final signed case study report')
    }
  }

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="portal-kicker">Case Study Signature</p>
          <h3 className="mt-0.5 text-base font-semibold text-slate-800">PNPKI Signing Workflow</h3>
          <p className="mt-1 text-xs text-slate-500">
            Download the current case study PDF, sign it, upload it, then forward the case to the next signer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || !canDownloadCurrentPdf}
            className="portal-button-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <DownloadIcon className="h-4 w-4" />
            {downloading ? 'Downloading...' : 'Download Current PDF'}
          </button>
          {reportSignature.replaceableStage && (
            <>
              <button
                type="button"
                onClick={() => replacementInputRef.current?.click()}
                disabled={replacing}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshIcon className="h-4 w-4" />
                {replacing ? 'Replacing...' : 'Replace Latest Upload'}
              </button>
              <input
                ref={replacementInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={replacing}
                onChange={handleReplacement}
              />
            </>
          )}
          {reportSignature.finalSignedReportUrl && (
            <button
              type="button"
              onClick={handleOpenFinal}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <CheckCircleIcon className="h-4 w-4" />
              View Final Signed Report
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {activeStage && (
            <p className="text-xs text-slate-600">
              Current signer: <span className="font-semibold text-slate-800">{activeStage.label}</span>
              {activeStage.assignedName ? ` - ${activeStage.assignedName}` : ''}
            </p>
          )}
          {reportSignature.preparedAt && (
            <p className="mt-1 text-xs text-slate-500">Started {formatDateTime(reportSignature.preparedAt)}</p>
          )}
          {reportSignature.finalSignedReportUrl && (
            <p className="mt-1 text-xs text-emerald-700">Final signed case study is ready.</p>
          )}
        </div>

        {reportSignature.canUploadCurrentStage && (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 hover:border-brand-primary hover:bg-brand-bg transition-all">
            <UploadIcon className="h-7 w-7 text-slate-400" />
            <p className="text-sm font-medium text-slate-600">
              {uploading ? 'Uploading...' : `Upload Signed PDF for ${activeStage?.label ?? 'Current Signer'}`}
            </p>
            <p className="text-xs text-slate-400">PDF only, max 10 MB</p>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? 'Uploading...' : 'Choose Signed PDF'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </div>
        )}

        {!reportSignature.canUploadCurrentStage && activeStage && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {!canDownloadCurrentPdf
              ? activeStage.key === 'for_review'
                ? 'Reviewer can download only after the case maker uploads the signed PDF.'
                : activeStage.key === 'recommending_approval'
                  ? 'Recommender can download only after the case maker and reviewer upload their signed PDFs.'
                  : activeStage.key === 'for_approval'
                    ? 'Approver can download only after the case maker, reviewer, and recommender upload their signed PDFs.'
                    : 'Current signer can download once the previous required signatures are complete.'
              : activeStage.assignedName
                ? `Waiting for ${activeStage.assignedName} to sign and upload the PDF.`
                : `Waiting for an authorized ${activeStage.label.toLowerCase()} signer to sign and upload the PDF.`}
          </div>
        )}
      </div>
    </div>
  )
}
