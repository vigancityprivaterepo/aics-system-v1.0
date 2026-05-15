import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { formatPortalDateTime, formatPortalStatus } from '../lib/formatting'

const statusClasses = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  resubmission_required: 'bg-orange-100 text-orange-800',
  approved: 'bg-emerald-100 text-emerald-800',
  disapproved: 'bg-rose-100 text-rose-800',
  released: 'bg-violet-100 text-violet-800',
}

export default function ApplicationDetailPage() {
  const { id } = useParams()
  const [application, setApplication] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadApplication = async () => {
      try {
        const res = await api.get(`/applications/${id}`)
        if (!active) return
        setApplication(res.data.application)
      } catch (error) {
        if (active) {
          toast.error(error.response?.data?.message || 'Failed to load application')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadApplication()

    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="portal-surface flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
      </div>
    )
  }

  if (!application) {
    return (
      <div className="portal-surface px-6 py-16 text-center">
        <p className="font-display text-2xl font-bold text-brand-primary">Application not found</p>
        <Link to="/applications" className="portal-button-secondary mt-6">
          Back to Applications
        </Link>
      </div>
    )
  }

  const isDraft = application.status === 'draft'
  const isResubmission = application.status === 'resubmission_required'
  const isPortalApproved = application.status === 'approved' && !application.linkedCase
  const canDownloadGuaranteeLetter = !!application.linkedCase?.guaranteeLetterAvailable

  const handleGuaranteeLetterDownload = async () => {
    try {
      const res = await api.get(`/applications/${application.id}/guarantee-letter/pdf`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${application.linkedCase?.caseNumber || application.referenceNumber || 'application'}-guarantee-letter.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to download guarantee letter')
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-6">
      <section className="portal-surface overflow-hidden p-3 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="portal-page-title break-words text-[clamp(1.45rem,6vw,2.2rem)] leading-tight sm:text-[clamp(2.2rem,5vw,3.6rem)]">
              {application.referenceNumber || (isDraft ? 'Draft application' : 'Pending Reference Number')}
            </h1>
            <p className="portal-page-subtitle mt-2 max-w-2xl text-[13px] leading-6 sm:leading-7">
              Review your assistance request, supporting documents, and current evaluation status.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClasses[application.status] || statusClasses.draft}`}>
              {formatPortalStatus(application.status)}
            </span>
            {isDraft || isResubmission ? (
              <Link to={`/apply?draft=${application.id}`} className="portal-button-primary w-full justify-center text-sm sm:w-auto">
                {isDraft ? 'Continue Draft' : 'Continue Resubmission'}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {isDraft ? (
        <section className="portal-surface overflow-hidden border border-slate-300 bg-slate-50 px-3 py-4 sm:px-6 sm:py-5">
          <p className="portal-kicker text-slate-700">Draft In Progress</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold leading-snug text-brand-primary sm:text-xl">This application has not been submitted yet</h2>
              <p className="mt-2 text-xs leading-6 text-slate-700">
                Continue editing this draft, upload the required documents, and submit it when the details are complete.
              </p>
            </div>
            <Link to={`/apply?draft=${application.id}`} className="portal-button-primary inline-flex w-full justify-center md:w-auto">
              Continue Draft
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.25fr,0.95fr]">
        <div className="portal-surface overflow-hidden p-3 sm:p-6">
          <p className="portal-kicker">Request Summary</p>
          <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-4 sm:grid-cols-2">
            <div className="portal-panel p-3 sm:p-4">
              <p className="text-xs font-medium text-slate-500">Assistance Type</p>
              <p className="mt-2 text-sm font-medium capitalize text-slate-800">{application.assistanceType}</p>
            </div>
            {application.assistanceType === 'burial' && (
              <div className="portal-panel p-3 sm:p-4">
                <p className="text-xs font-medium text-slate-500">Name of the Deceased</p>
                <p className="mt-2 text-sm font-medium text-slate-800">{application.metadata?.deceasedName || 'Not provided'}</p>
              </div>
            )}
            {application.assistanceType === 'medical' && (
              <div className="portal-panel p-3 sm:col-span-2 sm:p-4">
                <p className="text-xs font-medium text-slate-500">Requested Medical Assistance</p>
                <p className="mt-2 text-sm font-medium text-slate-800">
                  {application.metadata?.medicalRequestedAssistance || application.metadata?.medicalType || 'Not provided'}
                </p>
              </div>
            )}
            <div className="portal-panel p-3 sm:p-4">
              <p className="text-xs font-medium text-slate-500">Contact Number</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{application.contactNumber || 'Not provided'}</p>
            </div>
            <div className="portal-panel p-3 sm:p-4">
              <p className="text-xs font-medium text-slate-500">{isDraft ? 'Last updated' : 'Submitted'}</p>
              <p className="mt-2 text-sm font-medium text-slate-800">
                {formatPortalDateTime(isDraft ? application.updatedAt : application.submittedAt)}
              </p>
            </div>
          </div>

          <div className="mt-4 portal-panel p-3 sm:mt-6 sm:p-4">
            <p className="text-xs font-medium text-slate-500">Reason for Assistance</p>
            <p className="mt-3 break-words text-sm leading-7 text-slate-700">{application.reason || 'No request details added yet.'}</p>
          </div>

          {application.assistanceType === 'burial' ? (
            <div className="mt-4 portal-panel p-3 sm:mt-6 sm:p-4">
              <p className="text-xs font-medium text-slate-500">Burial Details</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {application.metadata?.funeralHomeName ? (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500">Funeral Home</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">{application.metadata.funeralHomeName}</p>
                    {application.metadata.funeralHomeOwnerName ? (
                      <p className="text-xs text-slate-600">Owner: {application.metadata.funeralHomeOwnerName}</p>
                    ) : null}
                    {application.metadata.funeralHomeAddress ? (
                      <p className="text-xs text-slate-400">{application.metadata.funeralHomeAddress}</p>
                    ) : null}
                  </div>
                ) : null}
                <div>
                  <p className="text-xs text-slate-500">Deceased Address</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{application.metadata?.deceasedAddress || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Age</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{application.metadata?.deceasedAge ?? 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Occupation</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{application.metadata?.deceasedOccupation || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Civil Status</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{application.metadata?.deceasedCivilStatus || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Sex</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{application.metadata?.deceasedSex || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Type of Bill</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{application.metadata?.typeOfBill || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Date of Interment</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{application.metadata?.intermentDate || 'Not provided'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500">Place of Interment</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{application.metadata?.intermentPlace || 'Not provided'}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 portal-panel p-3 sm:mt-6 sm:p-4">
            <p className="text-xs font-medium text-slate-500">Household Members</p>
            {application.householdMembers?.length ? (
              <div className="mt-4 divide-y divide-slate-200">
                {application.householdMembers.map((member, index) => (
                  <div key={`${member.name}-${index}`} className="grid gap-1 py-3 md:grid-cols-4">
                    <p className="text-sm font-medium text-brand-primary">{member.name}</p>
                    <p className="text-sm text-slate-600">{member.relationship}</p>
                    <p className="text-sm text-slate-600">{member.age ? `Age ${member.age}` : 'Age not set'}</p>
                    <p className="text-sm text-slate-600">{member.occupation || 'Occupation not set'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No household members added.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <section className="portal-surface overflow-hidden p-3 sm:p-6">
            <p className="portal-kicker">Review Notes</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-slate-800">Current Processing Status</h2>
            <div className="mt-6 space-y-4">
              {application.status === 'released' ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-xs font-semibold text-emerald-700">Release Notice</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Your assistance request has been released by the office. You can also review this update in portal notifications.
                  </p>
                  <Link to="/notifications" className="portal-button-primary mt-4 inline-flex w-full justify-center text-sm sm:w-auto">
                    View Notifications
                  </Link>
                </div>
              ) : null}
              {canDownloadGuaranteeLetter ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-4">
                  <p className="text-xs font-semibold text-blue-700">Guarantee Letter</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Your guarantee letter is available in the portal. Download the PDF copy here anytime.
                  </p>
                  <button onClick={handleGuaranteeLetterDownload} className="portal-button-primary mt-4 inline-flex w-full justify-center text-sm sm:w-auto">
                    Download Guarantee Letter PDF
                  </button>
                </div>
              ) : null}
              {isPortalApproved ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-xs font-semibold text-emerald-700">Approved for Office Submission</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Your online application passed document screening. Please bring your requirements to the AICS office so staff can create and process your case.
                  </p>
                </div>
              ) : null}
              <div className="portal-panel p-3 sm:p-4">
                <p className="text-xs font-medium text-slate-500">Updated by office</p>
                <p className="mt-2 text-sm font-medium text-slate-800">{formatPortalDateTime(application.reviewedAt)}</p>
              </div>
            </div>
          </section>

          <section className="portal-surface overflow-hidden p-3 sm:p-6">
            <p className="portal-kicker">Supporting Documents</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-slate-800">Uploaded Files</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Uploaded documents can only be opened by authorized admin and employee accounts during review.
            </p>
            <div className="mt-4 space-y-3 sm:mt-6">
              {application.documents?.length ? application.documents.map((document) => (
                <div
                  key={document.id}
                  className="flex flex-col gap-2 rounded-md border border-slate-200 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{document.documentType}</p>
                    <p className="mt-1 break-all text-xs text-slate-500 sm:truncate">{document.originalName}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-500">Restricted</span>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No documents uploaded.</p>
              )}
            </div>
            {isResubmission ? (
              <div className="mt-6 rounded-md border border-orange-300 bg-orange-50 px-4 py-4">
                <p className="text-xs font-semibold text-orange-700">Resubmission Required</p>
                {application.adminNotes ? (
                  <div className="mt-3 rounded-md border border-orange-200 bg-white px-4 py-3">
                    <p className="text-xs font-medium text-slate-500">Staff Notes</p>
                    <p className="mt-1 text-sm leading-7 text-slate-700">{application.adminNotes}</p>
                  </div>
                ) : null}
                <Link to={`/apply?draft=${application.id}`} className="portal-button-primary mt-4 inline-flex w-full justify-center text-sm sm:w-auto">
                  Continue Resubmission
                </Link>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  )
}
