import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { formatPortalDateTime, formatPortalStatus } from '../lib/formatting'

function BellIcon({ className = 'h-6 w-6' }) {
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
      <path d="M6.5 9.5a5.5 5.5 0 1 1 11 0c0 5.5 2 6.5 2 6.5h-15s2-1 2-6.5" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  )
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    const loadNotifications = async () => {
      try {
        const res = await api.get('/applications/notifications')
        if (!active) return
        setNotifications(res.data.notifications || [])
      } catch (error) {
        if (active) {
          toast.error(error.response?.data?.message || 'Failed to load notifications')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadNotifications()

    return () => {
      active = false
    }
  }, [])

  const unreadCount = notifications.filter((notification) => !notification.read).length

  const handleToggleRead = async (notification, read) => {
    setSaving(true)
    try {
      await api.post('/applications/notifications/read', {
        notifications: [{ id: notification.id, applicationId: notification.applicationId }],
        read,
      })
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, read } : item
      )))
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update notification')
    } finally {
      setSaving(false)
    }
  }

  const handleMarkAllRead = async () => {
    const unreadNotifications = notifications.filter((notification) => !notification.read)
    if (!unreadNotifications.length) return

    setSaving(true)
    try {
      await api.post('/applications/notifications/read', {
        notifications: unreadNotifications.map((notification) => ({
          id: notification.id,
          applicationId: notification.applicationId,
        })),
        read: true,
      })
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })))
      toast.success('All notifications marked as read')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update notifications')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="portal-surface p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="portal-kicker">Applicant Updates</p>
            <h1 className="portal-page-title">Notifications</h1>
            <p className="portal-page-subtitle">
              {unreadCount
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All notifications are read'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={saving || unreadCount === 0}
            className="portal-button-secondary text-sm disabled:opacity-50"
          >
            Mark All as Read
          </button>
        </div>
      </section>

      <section className="portal-surface overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-16">
            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-brand-primary">
                <BellIcon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold text-brand-primary">No Notifications Yet</h2>
              <p className="mt-3 max-w-md text-sm leading-7 text-slate-600">
                Review, approval, and release updates from the office will appear here as your case progresses.
              </p>
              <Link to="/applications" className="portal-button-primary mt-6">
                View My Applications
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {notifications.map((notification) => (
              <div key={notification.id} className={`px-6 py-5 ${notification.read ? 'bg-white' : 'bg-emerald-50/50'}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="portal-kicker text-emerald-700">{notification.title}</p>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        notification.read
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {notification.read ? 'Read' : 'Unread'}
                      </span>
                    </div>
                    <h2 className="mt-2 font-display text-2xl font-bold text-brand-primary">
                      {notification.referenceNumber}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{notification.message}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {formatPortalStatus(notification.status || 'update')}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">{formatPortalDateTime(notification.createdAt)}</p>
                </div>

                {notification.notes ? (
                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Office Notes</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{notification.notes}</p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link to={`/applications/${notification.applicationId}`} className="portal-button-primary text-sm">
                    View Application
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleToggleRead(notification, !notification.read)}
                    disabled={saving}
                    className="portal-button-secondary text-sm disabled:opacity-50"
                  >
                    {notification.read ? 'Mark as Unread' : 'Mark as Read'}
                  </button>
                  {notification.linkedCase?.caseNumber ? (
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                      Case #{notification.linkedCase.caseNumber}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
