import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../../lib/api'

const EVENT_BADGE_CLASS = {
  status: 'border-blue-200 bg-blue-50 text-blue-700',
  edit: 'border-slate-200 bg-slate-50 text-slate-700',
  override: 'border-amber-200 bg-amber-50 text-amber-700',
  document_issue: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

function eventLabel(type) {
  if (type === 'document_issue') return 'Verification'
  return type.replace(/_/g, ' ')
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TabHistory() {
  const { caseData } = useOutletContext()
  const [history, setHistory] = useState({ retentionPolicy: null, events: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    ;(async () => {
      setLoading(true)
      try {
        const { data } = await api.get(`/cases/${caseData.id}/history`)
        if (!active) return
        setHistory({
          retentionPolicy: data.retentionPolicy ?? null,
          events: data.events ?? [],
        })
      } catch (err) {
        if (!active) return
        toast.error(err.response?.data?.message || 'Failed to load case history')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [caseData.id, caseData.updatedAt])

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="form-section-title">Case Audit Trail</div>
            <p className="mt-1 text-sm text-slate-500">
              Every logged status change, material edit, override, and verification issuance for this case.
            </p>
          </div>
          {history.retentionPolicy && ['released', 'rejected'].includes(caseData.status) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-semibold text-slate-800">Retention Policy</p>
              <p className="mt-1 text-slate-600">
                Archive after {history.retentionPolicy.caseRetentionDays} days.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Eligible on {history.retentionPolicy.eligibleAt ? formatDateTime(history.retentionPolicy.eligibleAt) : 'not applicable'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Loading case history...</div>
        ) : history.events.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No case history has been recorded yet.</div>
        ) : (
          <div className="space-y-4">
            {history.events.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${EVENT_BADGE_CLASS[event.type] || EVENT_BADGE_CLASS.edit}`}>
                        {eventLabel(event.type)}
                      </span>
                      <p className="font-semibold text-slate-900">{event.title}</p>
                    </div>
                    {event.description && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{event.description}</p>
                    )}
                    {event.actor && (
                      <p className="mt-2 text-xs text-slate-500">
                        By {event.actor.name}
                        {event.actor.employeeId ? ` (${event.actor.employeeId})` : ''}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{formatDateTime(event.occurredAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
