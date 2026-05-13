import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import { formatPortalStatus } from '../lib/formatting'

function DocumentIcon({ className = 'h-6 w-6' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="4" width="14" height="16" rx="1.5" />
      <path d="M8.5 9h7" />
      <path d="M8.5 13h7" />
      <path d="M8.5 17H13" />
    </svg>
  )
}

export default function DashboardPage() {
  const applicant = useAuthStore((s) => s.applicant)
  const [applications, setApplications] = useState([])
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    let active = true

    const loadDashboard = async () => {
      try {
        const [applicationsRes, notificationsRes] = await Promise.all([
          api.get('/applications/mine'),
          api.get('/applications/notifications'),
        ])

        if (!active) return

        setApplications(applicationsRes.data.applications || [])
        setNotifications(notificationsRes.data.notifications || [])
      } catch (error) {
        if (active && error.response?.status !== 404) {
          toast.error(error.response?.data?.message || 'Failed to load dashboard summary')
        }
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [])

  const draftApplications = applications.filter((application) => application.status === 'draft')
  const resubmissionApplications = applications.filter((application) => application.status === 'resubmission_required')
  const submittedApplications = applications.filter(
    (application) => application.status !== 'draft' && application.status !== 'resubmission_required'
  )
  const latestTrackedApplication = resubmissionApplications[0] || submittedApplications[0] || draftApplications[0] || null
  const activeApplication = applications.find((application) => !['disapproved', 'released'].includes(application.status)) || null
  const canStartNewApplication = !activeApplication
  const unreadNotifications = notifications.filter((notification) => !notification.read)
  const latestReleaseNotification = notifications[0] || null
  const latestPortalApprovedApplication = submittedApplications.find(
    (application) => application.status === 'approved' && !application.linkedCase
  ) || null
  const overviewCards = [
    {
      title: 'Drafts',
      description: draftApplications.length
        ? `${draftApplications.length} draft application${draftApplications.length > 1 ? 's are' : ' is'} ready to continue.`
        : 'No drafts are currently saved in your portal account.',
    },
    {
      title: 'Needs Action',
      description: resubmissionApplications.length
        ? `${resubmissionApplications.length} application${resubmissionApplications.length > 1 ? 's require' : ' requires'} corrected or additional documents.`
        : 'No applications currently need document corrections or resubmission.',
    },
    {
      title: 'Notifications',
      description: unreadNotifications.length
        ? `${unreadNotifications.length} unread notification${unreadNotifications.length > 1 ? 's are' : ' is'} available in your portal notifications.`
        : 'Case review, approval, and release updates appear here as your request progresses.',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <section className="portal-surface overflow-hidden">
        <div className="border-b border-emerald-800/10 bg-[#064e3b] px-6 py-6 text-white">
          <p className="text-xs font-medium text-emerald-100/80">Applicant Dashboard</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Welcome back, {applicant?.firstName || 'Applicant'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">
            Resume drafts, respond to document requests, and track your AICS application progress.
          </p>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="portal-panel p-4">
            <p className="portal-kicker">Client ID Number</p>
            <p className="mt-2 text-sm font-semibold text-brand-primary">
              {applicant?.clientCaseNumber || 'Pending client ID assignment'}
            </p>
            <p className="mt-1 text-xs leading-6 text-slate-500">
              This is your client record number used by the AICS office.
            </p>
          </div>
          {overviewCards.map((card) => (
            <div key={card.title} className="portal-panel p-4">
              <p className="portal-kicker">{card.title}</p>
              <p className="mt-2 text-xs leading-6 text-slate-600">{card.description}</p>
            </div>
          ))}
        </div>
      </section>

      {latestReleaseNotification ? (
        <section className="portal-surface border border-emerald-200 bg-emerald-50/60 px-6 py-5">
          <p className="portal-kicker text-emerald-800">Latest Notification</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-emerald-900">{latestReleaseNotification.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{latestReleaseNotification.message}</p>
            </div>
            <Link to="/notifications" className="portal-button-primary inline-flex">
              View Notifications
            </Link>
          </div>
        </section>
      ) : null}

      {resubmissionApplications.length > 0 ? (
        <section className="portal-surface border border-amber-200 bg-amber-50/60 px-6 py-5">
          <p className="portal-kicker text-amber-800">Action Needed</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-amber-900">Documents need resubmission</h2>
              <p className="mt-1 text-sm text-slate-600">
                One or more applications require additional or corrected documents before office review can continue.
              </p>
            </div>
            <Link to={`/apply?draft=${resubmissionApplications[0].id}`} className="portal-button-primary inline-flex bg-amber-600 border-amber-600 hover:bg-amber-700">
              Continue Resubmission
            </Link>
          </div>
        </section>
      ) : null}

      {latestPortalApprovedApplication ? (
        <section className="portal-surface border border-emerald-200 bg-emerald-50/60 px-6 py-5">
          <p className="portal-kicker text-emerald-800">Approved Application</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-emerald-900">Bring your requirements to the office</h2>
              <p className="mt-1 text-sm text-slate-600">
                Application {latestPortalApprovedApplication.referenceNumber || 'Pending reference number'} passed portal screening and is waiting for office document submission.
              </p>
            </div>
            <Link to={`/applications/${latestPortalApprovedApplication.id}`} className="portal-button-primary inline-flex">
              View Approved Application
            </Link>
          </div>
        </section>
      ) : null}

      <section className="portal-surface px-6 py-14">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
            <DocumentIcon className="h-6 w-6 text-slate-400" />
          </div>

          {!latestTrackedApplication ? (
            <>
              <h2 className="mt-5 font-display text-xl font-semibold text-slate-800">No application started yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Start your AICS application to create an official applicant record in the portal.
              </p>
              {canStartNewApplication ? (
                <Link to="/apply" className="portal-button-primary mt-6 inline-flex">
                  Apply Now
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <h2 className="mt-5 font-display text-xl font-semibold text-slate-800">
                {latestTrackedApplication.status === 'draft'
                  ? 'Current Draft'
                  : latestTrackedApplication.status === 'resubmission_required'
                    ? 'Resubmission In Progress'
                    : 'Latest Application'}
              </h2>
              <p className="mt-2 text-sm font-semibold text-emerald-800">
                {latestTrackedApplication.referenceNumber || 'Pending reference number'}
              </p>
              <p className="mt-1 text-sm text-slate-500 capitalize">
                Status: {formatPortalStatus(latestTrackedApplication.status)}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  to={latestTrackedApplication.status === 'draft' || latestTrackedApplication.status === 'resubmission_required'
                    ? `/apply?draft=${latestTrackedApplication.id}`
                    : `/applications/${latestTrackedApplication.id}`}
                  className="portal-button-primary inline-flex"
                >
                  {latestTrackedApplication.status === 'draft'
                    ? 'Continue Draft'
                    : latestTrackedApplication.status === 'resubmission_required'
                       ? 'Continue Resubmission'
                       : 'View Details'}
                </Link>
                <Link to="/applications" className="portal-button-secondary inline-flex">
                  View All Applications
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
