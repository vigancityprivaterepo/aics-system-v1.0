import { useState, useEffect, useRef } from 'react'
import { DownloadIcon, FileTextIcon, ChevronDownIcon } from '../../../components/ui/Icons'
import api from '../../../lib/api'
import toast from 'react-hot-toast'
import BurialCaseStudyPreview from './BurialCaseStudyPreview'
import HospitalCaseStudyPreview from './HospitalCaseStudyPreview'
import MedicineCaseStudyPreview from './MedicineCaseStudyPreview'
import MedicalCaseStudyPreview from './MedicalCaseStudyPreview'
import EyeglassCaseStudyPreview from './EyeglassCaseStudyPreview'
import PlainCaseStudyPreview from './PlainCaseStudyPreview'
import GuaranteeLetterPanel from '../../../components/GuaranteeLetterPanel'

export default function StepReports({ caseData }) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isBurial = caseData.assistanceType === 'burial'
  const isHospital = caseData.assistanceType === 'hospital'
  const isMedicine = caseData.assistanceType === 'medicine'
  const isMedical = caseData.assistanceType === 'medical'
  const isEyeglass = caseData.assistanceType === 'eyeglass'
  const isPlain = caseData.assistanceType === 'plain'
  const hasGuaranteeLetter = isBurial || isHospital || isMedical
  const hasReports = isBurial || isHospital || isMedicine || isMedical || isEyeglass || isPlain

  const handleDownload = async (type) => {
    setDownloading(true)
    try {
      const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const PDF_MIME = 'application/pdf'
      const configMap = {
        docx:                  { endpoint: `/cases/${caseData.id}/report/docx`,                mime: DOCX_MIME, label: 'case-study',      ext: 'docx' },
        'gl-pdf':              { endpoint: `/cases/${caseData.id}/guarantee-letter/pdf`,       mime: PDF_MIME,  label: 'guarantee-letter', ext: 'pdf' },
        'gl-docx':             { endpoint: `/cases/${caseData.id}/report/gl-docx`,             mime: DOCX_MIME, label: 'guarantee-letter', ext: 'docx' },
        'endorsement-docx':    { endpoint: `/cases/${caseData.id}/report/endorsement-docx`,    mime: DOCX_MIME, label: 'endorsement',      ext: 'docx' },
        'acknowledgement-docx':{ endpoint: `/cases/${caseData.id}/report/acknowledgement-docx`,mime: DOCX_MIME, label: 'acknowledgement',   ext: 'docx' },
      }
      const config = configMap[type]
      if (!config) return

      const res = await api.get(config.endpoint, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: config.mime }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${caseData.caseNumber}-${config.label}.${config.ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Document generation requires backend connection')
    } finally {
      setDownloading(false)
    }
  }

  const templateTypeLabel = isHospital
    ? (caseData.hospitalDetails?.templateType === 'proxy' ? 'Proxy' : 'Personal')
    : null
  const medicineTemplateTypeLabel = isMedicine
    ? (caseData.medicineDetails?.templateType === 'proxy' ? 'Proxy' : 'Personal')
    : null
  const medicalTemplateTypeLabel = isMedical
    ? (caseData.medicalDetails?.templateType === 'proxy' ? 'Proxy' : 'Personal')
    : null
  const eyeglassTemplateTypeLabel = isEyeglass
    ? (caseData.eyeglassDetails?.templateType === 'proxy' ? 'Proxy' : 'Personal')
    : null

  return (
    <div className="card">
      <div className="form-section-title flex items-center gap-2">
        <FileTextIcon className="h-4 w-4 text-brand-primary" />
        Report Generation
      </div>

      {hasReports ? (
        <div ref={dropdownRef} className="relative inline-block">
          <button
            onClick={() => setOpen((v) => !v)}
            disabled={downloading}
            className="portal-button-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            id="btn-generate-report"
          >
            <DownloadIcon className="h-4 w-4" />
            {downloading ? 'Generating...' : 'Generate Report'}
            <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute left-0 mt-1 w-72 rounded-xl border border-slate-200 bg-white shadow-lg z-10 overflow-hidden">
              {isPlain ? (
                <button
                  onClick={() => { handleDownload('docx'); setOpen(false) }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <DownloadIcon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Plain AICS Case Study</p>
                    <p className="text-xs text-slate-400">Social case study report (.docx)</p>
                  </div>
                </button>
              ) : isEyeglass ? (
                <>
                  <button
                    onClick={() => { handleDownload('docx'); setOpen(false) }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors border-b border-slate-100"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <DownloadIcon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Eyeglass Case Study</p>
                      <p className="text-xs text-slate-400">
                        {eyeglassTemplateTypeLabel ? `Template: ${eyeglassTemplateTypeLabel} - ` : ''}
                        Social case study report (.docx)
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => { handleDownload('endorsement-docx'); setOpen(false) }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors border-b border-slate-100"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <DownloadIcon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Endorsement Letter</p>
                      <p className="text-xs text-slate-400">Eyeglass endorsement (.docx)</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { handleDownload('acknowledgement-docx'); setOpen(false) }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <DownloadIcon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Acknowledgement</p>
                      <p className="text-xs text-slate-400">Signed acknowledgement letter (.docx)</p>
                    </div>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { handleDownload('docx'); setOpen(false) }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors ${hasGuaranteeLetter ? 'border-b border-slate-100' : ''}`}
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <DownloadIcon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {isBurial ? 'Burial Case Study' : isHospital ? 'Hospital Case Study' : isMedical ? 'Medical Case Study' : 'Medicine Case Study'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {isHospital && templateTypeLabel ? `Template: ${templateTypeLabel} - ` : ''}
                        {isMedicine && medicineTemplateTypeLabel ? `Template: ${medicineTemplateTypeLabel} - ` : ''}
                        {isMedical && medicalTemplateTypeLabel ? `Template: ${medicalTemplateTypeLabel} - ` : ''}
                        Social case study report (.docx)
                      </p>
                    </div>
                  </button>
                  {hasGuaranteeLetter && (
                    <button
                      onClick={() => { handleDownload('gl-pdf'); setOpen(false) }}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors border-b border-slate-100"
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                        <DownloadIcon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Guarantee Letter PDF</p>
                        <p className="text-xs text-slate-400">Verifiable guarantee letter (.pdf)</p>
                      </div>
                    </button>
                  )}
                  {hasGuaranteeLetter && (
                    <button
                      onClick={() => { handleDownload('gl-docx'); setOpen(false) }}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors"
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <DownloadIcon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Guarantee Letter DOCX</p>
                        <p className="text-xs text-slate-400">Editable guarantee letter (.docx)</p>
                      </div>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400 italic">
          No report templates available for this assistance type.
        </div>
      )}

      <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-500 font-medium">
          Documents require DSWD templates with <code className="font-mono">{'{placeholder}'}</code> tags in the{' '}
          <code className="font-mono">
            {isBurial ? 'templates/Burial Case Study and GL/' : isHospital ? 'templates/Hospital Case Study and GL/' : isMedical ? 'templates/Medical Case Study and GL/' : isMedicine ? 'templates/Medicine Case Study/' : isEyeglass ? 'templates/Eyeglass Case Study and GL/' : isPlain ? 'templates/Plain AICS/' : 'templates/'}
          </code>{' '}
          folder.
        </p>
      </div>

      {isBurial && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="portal-label">Beneficiary</p>
            <p className="mt-1 font-semibold text-slate-800">{caseData.beneficiaryName || caseData.burialDetails?.deceasedName || 'No deceased name recorded'}</p>
            <p className="mt-1 text-xs text-slate-500">{caseData.beneficiaryAddress || caseData.burialDetails?.deceasedAddress || 'No deceased address recorded'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="portal-label">Proxy / Requestor</p>
            <p className="mt-1 font-semibold text-slate-800">{caseData.proxyName || `${caseData.client?.firstName || ''} ${caseData.client?.lastName || ''}`.trim() || 'Not recorded'}</p>
            <p className="mt-1 text-xs text-slate-500">{caseData.proxyRelationship || 'Relationship not recorded'}</p>
          </div>
        </div>
      )}

      {isBurial && (
        <div className="mt-6">
          <BurialCaseStudyPreview caseData={caseData} />
          <GuaranteeLetterPanel caseData={caseData} />
        </div>
      )}

      {isHospital && (
        <div className="mt-6">
          <HospitalCaseStudyPreview caseData={caseData} />
          <GuaranteeLetterPanel caseData={caseData} />
        </div>
      )}

      {isMedicine && (
        <div className="mt-6">
          <MedicineCaseStudyPreview caseData={caseData} />
        </div>
      )}

      {isMedical && (
        <div className="mt-6">
          <MedicalCaseStudyPreview caseData={caseData} />
          <GuaranteeLetterPanel caseData={caseData} />
        </div>
      )}

      {isEyeglass && (
        <div className="mt-6">
          <EyeglassCaseStudyPreview caseData={caseData} />
        </div>
      )}

      {isPlain && (
        <div className="mt-6">
          <PlainCaseStudyPreview caseData={caseData} />
        </div>
      )}
    </div>
  )
}
