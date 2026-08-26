import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { formatCurrency, formatClientName } from '../../lib/utils'
import { ClockIcon, AlertTriangleIcon, CheckCircleIcon } from '../../components/ui/Icons'

const TYPE_LABEL = { medicine: 'Medicine', medical: 'Medical', hospital: 'Hospital', burial: 'Burial', eyeglass: 'Eyeglass', plain: 'Plain AICS' }
// Solid type chips from the V.1.2 design language.
const TYPE_CHIP = {
  medicine: 'bg-[#059669]', medical: 'bg-[#2563eb]', hospital: 'bg-[#9333ea]',
  burial: 'bg-[#64748b]', eyeglass: 'bg-[#f59e0b]', plain: 'bg-[#0d9488]',
}

// Grouped by status (not the shared `queue` string, which collapses distinct
// situations like "you still need to submit this" and "someone else needs to
// review this" into the same `ready_for_review` value) so each section header
// says exactly what's being asked of the viewer.
const GROUPS = [
  { key: 'rejected', title: 'Disapproved — Needs Rework', statuses: ['rejected'], pill: 'bg-[#dc2626]' },
  { key: 'blocked', title: 'Needs Encoding — Blockers to Resolve', statuses: ['encoding'], onlyBlocked: true, pill: 'bg-[#f59e0b]' },
  { key: 'ready_to_submit', title: 'Ready to Submit for Review', statuses: ['encoding'], onlyBlocked: false, pill: 'bg-[#f59e0b]' },
  { key: 'intake', title: 'Needs Intake', statuses: ['intake'], pill: 'bg-[#64748b]' },
  { key: 'for_review', title: 'Awaiting Your Review', statuses: ['for_review'], pill: 'bg-[#9333ea]' },
  { key: 'recommending_approval', title: 'Awaiting Your Recommendation', statuses: ['recommending_approval'], pill: 'bg-[#4f46e5]' },
  { key: 'for_approval', title: 'Awaiting Your Final Approval', statuses: ['for_approval'], pill: 'bg-[#2563eb]' },
  { key: 'approved', title: 'Approved — Ready to Release', statuses: ['approved'], pill: 'bg-[#059669]' },
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
      className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-[18px] py-[13px] last:border-b-0 transition-colors hover:bg-slate-50"
    >
      <div className="min-w-0 flex-[1_1_260px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[#0f2d52]">{c.caseNumber || '—'}</span>
          <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] text-white ${TYPE_CHIP[c.assistanceType] ?? 'bg-[#64748b]'}`}>
            {TYPE_LABEL[c.assistanceType] ?? c.assistanceType}
          </span>
          {c.overdue && (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#dc2626]">
              <AlertTriangleIcon className="h-3 w-3" /> Overdue
            </span>
          )}
        </div>
        <p className="mt-1.5 truncate text-[13.5px] font-semibold text-slate-800">
          {c.beneficiaryName || formatClientName(c.client)}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">{c.nextAction}</p>
        {c.isBlocked && c.blockers?.length > 0 && (
          <p className="mt-0.5 text-[11px] text-red-500">{c.blockers.length} blocker{c.blockers.length === 1 ? '' : 's'}: {c.blockers[0]}{c.blockers.length > 1 ? ` +${c.blockers.length - 1} more` : ''}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[13.5px] font-bold text-[#0f2d52]">{c.amount != null ? formatCurrency(c.amount) : '—'}</p>
        {c.dueAt && (
          <p className={`mt-[3px] inline-flex items-center gap-1 text-[11px] ${c.overdue ? 'text-[#dc2626]' : 'text-slate-400'}`}>
            <ClockIcon className="h-3 w-3" />
            {c.overdue ? 'Was due' : 'Due'} {new Date(c.dueAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
          </p>
        )}
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="portal-kicker">Case Management</p>
          <h1 className="portal-page-title">My Queue</h1>
          <p className="portal-page-subtitle">
            {loading
              ? 'Loading what needs your action…'
              : totalWaiting === 0
                ? "You're all caught up."
                : `${totalWaiting} case${totalWaiting === 1 ? '' : 's'} waiting on you${overdueCount > 0 ? `, ${overdueCount} overdue` : ''} — most urgent first.`}
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
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.key} className="overflow-hidden rounded-[14px] border border-slate-300/80 bg-white shadow-[0_1px_3px_rgba(15,45,82,0.06)]">
              <div className="flex items-center justify-between gap-2.5 border-b border-[#e8ecef] bg-[#f1f3f5] px-[18px] py-3.5">
                <h2 className="font-display text-[14.5px] font-bold text-[#0f2d52]">{group.title}</h2>
                <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11.5px] font-bold text-white ${group.pill}`}>
                  {group.cases.length}
                </span>
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
