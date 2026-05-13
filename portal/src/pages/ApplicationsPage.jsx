import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

function ApplicationRow({ application }) {
  const isDraft = application.status === 'draft'
  const needsResubmission = application.status === 'resubmission_required'
  const isPortalApproved = application.status === 'approved' && !application.linkedCase
  const primaryLink = isDraft || needsResubmission
    ? `/apply?draft=${application.id}`
    : `/applications/${application.id}`
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
    <div className="grid gap-4 px-6 py-5 lg:grid-cols-[1.4fr,0.9fr,0.9fr,auto] lg:items-center">
      <div>
        <p className="text-xs font-medium text-slate-500 capitalize">{application.assistanceType} assistance</p>
        <p className="mt-1 font-display text-lg font-semibold text-emerald-900">
          {application.referenceNumber || (isDraft ? 'Draft application' : 'Pending reference number')}
        </p>
        {application.assistanceType === 'burial' && application.metadata?.deceasedName && (
          <p className="mt-2 text-sm font-semibold text-slate-700">Deceased: {application.metadata.deceasedName}</p>
        )}
        <p className="mt-2 text-sm leading-7 text-slate-600">
          {application.reason || 'Continue this application to complete the request details.'}
        </p>
        {isDraft && (
          <p className="mt-2 text-sm font-semibold text-slate-700">
            This draft is not yet submitted to the office. Continue editing before final submission.
          </p>
        )}
        {needsResubmission && (
          <p className="mt-2 text-sm font-semibold text-orange-700">
            Additional or corrected documents are required. Continue this application and submit it again.
          </p>
        )}
        {isPortalApproved && (
          <p className="mt-2 text-sm font-semibold text-emerald-700">
            Approved after portal screening. Bring your requirements to the office so staff can create your case.
          </p>
        )}
        {application.status === 'released' && (
          <p className="mt-2 text-sm font-semibold text-emerald-700">
            Released by the office. Check notifications for the latest release update.
          </p>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">Status</p>
        <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClasses[application.status] || statusClasses.draft}`}>
          {formatPortalStatus(application.status)}
        </span>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">Last updated</p>
        <p className="mt-2 text-sm font-medium text-slate-700">{formatPortalDateTime(application.updatedAt)}</p>
        <p className="mt-1 text-xs text-slate-500">{application.documents?.length || 0} documents uploaded</p>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Link to={primaryLink} className="portal-button-secondary text-sm">
          {isDraft ? 'Continue Draft' : needsResubmission ? 'Continue Resubmission' : 'View Details'}
        </Link>
        {!isDraft && !needsResubmission ? (
          <Link to={`/applications/${application.id}`} className="portal-button-primary text-sm">
            View Timeline
          </Link>
        ) : null}
        {canDownloadGuaranteeLetter ? (
          <button onClick={handleGuaranteeLetterDownload} className="portal-button-primary text-sm">
            Download GL PDF
          </button>
        ) : null}
      </div>
    </div>
  )
}

function ApplicationsSection({ title, description, applications, emptyMessage }) {
  return (
    <section className="portal-surface overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
        <p className="portal-kicker">{title}</p>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
      {applications.length === 0 ? (
        <div className="px-6 py-8 text-sm text-slate-500">{emptyMessage}</div>
      ) : (
        <div className="divide-y divide-slate-200">
          {applications.map((application) => (
            <ApplicationRow key={application.id} application={application} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadApplications = async () => {
      try {
        const res = await api.get('/applications/mine')
        if (!active) return
        setApplications(res.data.applications || [])
      } catch (error) {
        if (!active) return
        toast.error(error.response?.data?.message || 'Failed to load applications')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadApplications()

    return () => {
      active = false
    }
  }, [])

  const draftApplications = applications.filter((application) => application.status === 'draft')
  const resubmissionApplications = applications.filter((application) => application.status === 'resubmission_required')
  const submittedApplications = applications.filter(
    (application) => application.status !== 'draft' && application.status !== 'resubmission_required'
  )
  const activeApplication = applications.find((application) => !['disapproved', 'released'].includes(application.status)) || null
  const canStartNewApplication = !activeApplication
  const hasApplications = applications.length > 0

  return (
    <div className="flex flex-col gap-6">
      <section className="portal-surface p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="portal-page-title">My Applications</h1>
            <p className="portal-page-subtitle">Resume drafts, complete resubmissions, and track submitted assistance requests.</p>
          </div>
          {canStartNewApplication ? (
            <Link to="/apply" className="portal-button-primary">
              Start New Application
            </Link>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You already have an active application. Continue it before creating another one.
            </div>
          )}
        </div>
      </section>

      {loading ? (
        <section className="portal-surface">
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
          </div>
        </section>
      ) : !hasApplications ? (
        <section className="portal-surface">
          <div className="px-6 py-16 text-center">
            <p className="font-display text-xl font-semibold text-slate-800">No applications yet</p>
            <p className="mt-2 text-sm text-slate-500">Create your first AICS online application to begin submission and tracking.</p>
            {canStartNewApplication ? (
              <Link to="/apply" className="portal-button-primary mt-6">
                Apply for Assistance
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          <ApplicationsSection
            title="Drafts"
            description="Applications you started but have not submitted to the office yet."
            applications={draftApplications}
            emptyMessage="No drafts in progress."
          />
          <ApplicationsSection
            title="Needs Resubmission"
            description="Applications that need additional or corrected documents before review can continue."
            applications={resubmissionApplications}
            emptyMessage="No applications currently need resubmission."
          />
          <ApplicationsSection
            title="Submitted / Under Review"
            description="Applications already submitted to the office for processing, review, approval, or release."
            applications={submittedApplications}
            emptyMessage="No submitted applications yet."
          />
        </>
      )}
    </div>
  )
}
