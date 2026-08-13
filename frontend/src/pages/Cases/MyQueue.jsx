import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { formatCurrency, formatClientName } from '../../lib/utils'
import { ClipboardIcon, ClockIcon, AlertTriangleIcon, CheckCircleIcon } from '../../components/ui/Icons'

const TYPE_LABEL = { medicine: 'Medicine', medical: 'Medical', hospital: 'Hospital', burial: 'Burial', eyeglass: 'Eyeglass', plain: 'Plain AICS' }

// Grouped by status (not the shared `queue` string, which collapses distinct
// situations like "you still need to submit this" and "someone else needs to
// review this" into the same `ready_for_review` value) so each section header
// says exactly what's being asked of the viewer.
const GROUPS = [
  { key: 'rejected', title: 'Disapproved — Needs Rework', statuses: ['rejected'] },
  { key: 'blocked', title: 'Needs Encoding — Blockers to Resolve', statuses: ['encoding'], onlyBlocked: true },
  { key: 'ready_to_submit', title: 'Ready to Submit for Review', statuses: ['encoding'], onlyBlocked: false },
  { key: 'intake', title: 'Needs Intake', statuses: ['intake'] },
  { key: 'for_review', title: 'Awaiting Your Review', statuses: ['for_review'] },
  { key: 'recommending_approval', title: 'Awaiting Your Recommendation', statuses: ['recommending_approval'] },
  { key: 'for_approval', title: 'Awaiting Your Final Approval', statuses: ['for_approval'] },
  { key: 'approved', title: 'Approved — Ready to Release', statuses: ['approved'] },
]

function sortByUrgency(cases) {
  return [...cases].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Infinity
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Infinity
    return aDue - bDue
  })
}

function CaseRow({ c }) {
  return (
    <Link
      to={`/cases/${c.id}`}
      className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-brand-primary">{c.caseNumber || '—'}</span>
          <span className="badge badge-slate text-[10px]">{TYPE_LABEL[c.assistanceType] ?? c.assistanceType}</span>
          {c.overdue && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600">
              <AlertTriangleIcon className="h-3 w-3" /> Overdue
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-slate-800">
          {c.beneficiaryName || formatClientName(c.client)}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{c.nextAction}</p>
        {c.isBlocked && c.blockers?.length > 0 && (
          <p className="mt-0.5 text-[11px] text-red-500">{c.blockers.length} blocker{c.blockers.length === 1 ? '' : 's'}: {c.blockers[0]}{c.blockers.length > 1 ? ` +${c.blockers.length - 1} more` : ''}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-right">
        <div>
          <p className="text-sm font-semibold text-slate-700">{c.amount != null ? formatCurrency(c.amount) : '—'}</p>
          {c.dueAt && (
            <p className={`mt-0.5 inline-flex items-center gap-1 text-[11px] ${c.overdue ? 'text-red-500' : 'text-slate-400'}`}>
              <ClockIcon className="h-3 w-3" />
              {c.overdue ? 'Was due' : 'Due'} {new Date(c.dueAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function MyQueue() {
  const navigate = useNavigate()
  const [cases, setCases] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.get('/cases', { params: { owner: 'me', limit: 200 } })
      .then((res) => { if (active) setCases(res.data.cases || []) })
      .catch((err) => {
        if (!active) return
        toast.error(err.response?.data?.message ?? 'Failed to load your queue')
        setCases([])
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const groups = GROUPS
    .map((group) => {
      const matched = (cases ?? []).filter((c) => {
        if (!group.statuses.includes(c.status)) return false
        if (group.onlyBlocked !== undefined && Boolean(c.isBlocked) !== group.onlyBlocked) return false
        return true
      })
      return { ...group, cases: sortByUrgency(matched) }
    })
    .filter((group) => group.cases.length > 0)

  const totalWaiting = groups.reduce((sum, g) => sum + g.cases.length, 0)
  const overdueCount = (cases ?? []).filter((c) => c.overdue).length

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="portal-kicker">Case Management</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-slate-900">
            <ClipboardIcon className="h-6 w-6 text-brand-green" />
            My Queue
          </h1>
          <p className="portal-page-subtitle">
            {loading
              ? 'Loading what needs your action…'
              : totalWaiting === 0
                ? "You're all caught up."
                : `${totalWaiting} case${totalWaiting === 1 ? '' : 's'} waiting on you${overdueCount > 0 ? `, ${overdueCount} overdue` : ''}.`}
          </p>
        </div>
        <button type="button" onClick={() => navigate('/cases')} className="portal-button-secondary">
          View All Cases
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
        </div>
      ) : totalWaiting === 0 ? (
        <div className="card portal-empty">
          <CheckCircleIcon className="mx-auto h-12 w-12 text-emerald-300 mb-3" />
          <p className="font-medium text-slate-600">Nothing waiting on you right now.</p>
          <p className="mt-1 text-sm text-slate-400">New cases will show up here as soon as they need your action.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.key} className="card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-sm font-semibold text-slate-700">{group.title}</p>
                <span className="badge badge-slate text-[10px]">{group.cases.length}</span>
              </div>
              <div>
                {group.cases.map((c) => <CaseRow key={c.id} c={c} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
