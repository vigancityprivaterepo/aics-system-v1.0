import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { openProtectedFile } from '../lib/openProtectedFile'
import { DownloadIcon, UploadIcon, CheckCircleIcon } from './ui/Icons'
import dayjs from 'dayjs'

const GL_TYPES = ['burial', 'hospital', 'medical']

function getSignedGlInfo(caseData) {
  const t = caseData.assistanceType
  if (t === 'burial')   return { url: caseData.burialDetails?.signedGlUrl,   at: caseData.burialDetails?.glUploadedAt }
  if (t === 'hospital') return { url: caseData.hospitalDetails?.signedGlUrl, at: caseData.hospitalDetails?.glUploadedAt }
  if (t === 'medical')  return { url: caseData.medicalDetails?.signedGlUrl,  at: caseData.medicalDetails?.glUploadedAt }
  return { url: null, at: null }
}

export default function GuaranteeLetterPanel({ caseData, onUploaded }) {
  const [downloadingDocx, setDownloadingDocx] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [uploading, setUploading]     = useState(false)

  if (!GL_TYPES.includes(caseData.assistanceType)) return null

  const { url: signedGlUrl, at: glUploadedAt } = getSignedGlInfo(caseData)
  const canUpload = caseData.status !== 'released' && caseData.status !== 'rejected'
  const typeLabel = caseData.assistanceType === 'burial' ? 'Funeral Home' :
                    caseData.assistanceType === 'hospital' ? 'Hospital' : 'Medical'

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadDocx = async () => {
    setDownloadingDocx(true)
    try {
      const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const res = await api.get(`/cases/${caseData.id}/report/gl-docx`, { responseType: 'blob' })
      downloadBlob(new Blob([res.data], { type: DOCX }), `${caseData.caseNumber}-guarantee-letter.docx`)
    } catch {
      toast.error('Document generation requires backend connection')
    } finally {
      setDownloadingDocx(false)
    }
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const PDF = 'application/pdf'
      const res = await api.get(`/cases/${caseData.id}/guarantee-letter/pdf`, { responseType: 'blob' })
      downloadBlob(new Blob([res.data], { type: PDF }), `${caseData.caseNumber}-guarantee-letter.pdf`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to download guarantee letter PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(
        `/cases/${caseData.id}/${caseData.assistanceType}/upload-gl`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      toast.success('Signed GL uploaded successfully')
      onUploaded?.()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to upload signed GL')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleOpenSignedGl = async () => {
    if (!signedGlUrl) return
    try {
      await openProtectedFile(signedGlUrl, `${caseData.caseNumber}-signed-guarantee-letter`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to open signed guarantee letter')
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="portal-kicker">Guarantee Letter</p>
          <h3 className="mt-0.5 text-base font-semibold text-slate-800">
            {typeLabel} Payment Letter
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="portal-button-primary inline-flex items-center gap-2 disabled:opacity-60"
          >
            <DownloadIcon className="h-4 w-4" />
            {downloadingPdf ? 'Generating PDF...' : 'Download GL (.pdf)'}
          </button>
          <button
            onClick={handleDownloadDocx}
            disabled={downloadingDocx}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            <DownloadIcon className="h-4 w-4" />
            {downloadingDocx ? 'Generating DOCX...' : 'Download GL (.docx)'}
          </button>
        </div>
      </div>

      {/* Signed GL section */}
      <div className="px-5 py-5 space-y-4">
        <p className="text-sm font-medium text-slate-700">Signed Guarantee Letter</p>

        {signedGlUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-800">Signed GL uploaded</p>
                {glUploadedAt && (
                  <p className="text-xs text-emerald-600">
                    {dayjs(glUploadedAt).format('MMMM D, YYYY h:mm A')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleOpenSignedGl}
                className="ml-auto shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                View
              </button>
            </div>
            {canUpload && (
              <p className="text-xs text-slate-400">Upload a new file below to replace the existing signed GL.</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No signed GL uploaded yet.</p>
        )}

        {canUpload && (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 hover:border-brand-primary hover:bg-brand-bg transition-all">
            <UploadIcon className="h-7 w-7 text-slate-400" />
            <p className="text-sm font-medium text-slate-600">
              {uploading ? 'Uploading...' : 'Click to upload signed GL'}
            </p>
            <p className="text-xs text-slate-400">PDF, JPG, PNG · Max 5 MB</p>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        )}

        {!canUpload && (
          <p className="text-xs text-slate-400 italic">
            GL upload is disabled for {caseData.status} cases.
          </p>
        )}
      </div>
    </div>
  )
}
