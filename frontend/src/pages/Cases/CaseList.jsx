import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { formatDate, formatClientName } from '../../lib/utils'
import StatusBadge from '../../components/ui/StatusBadge'
import { useAuthStore } from '../../store/authStore'
import { allowedCaseTypesForUser } from '../../utils/accessRules'
import { PlusIcon, SearchIcon, FolderIcon, EditIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, QrCodeIcon } from '../../components/ui/Icons'

const TYPE_LABEL = { medicine: 'Medicine', burial: 'Burial', hospital: 'Hospital', medical: 'Medical', eyeglass: 'Eyeglass', plain: 'Plain AICS' }
const ALL_CASE_TYPES = ['medicine', 'medical', 'hospital', 'burial', 'eyeglass', 'plain']
const QUEUE_LABEL = {
  needs_intake: 'Needs Intake',
  needs_encoding: 'Needs Encoding',
  ready_for_review: 'Ready for Review',
  waiting_for_recommender: 'Waiting for Recommender',
  waiting_for_approver: 'Waiting for Approver',
  ready_for_release: 'Ready for Release',
  released: 'Released',
  blocked_incomplete: 'Blocked / Incomplete',
}

function workflowApprovalMessages(caseRow) {
  const approvalSummary = caseRow.approvalSummary || {}
  const summaries = [
    approvalSummary.for_review,
    approvalSummary.recommending_approval,
    approvalSummary.for_approval,
  ].filter(Boolean)

  if (caseRow.status === 'recommending_approval') {
    return summaries.filter((summary) => summary.stage === 'for_review')
  }

  if (caseRow.status === 'for_approval') {
    return summaries.filter((summary) => ['for_review', 'recommending_approval'].includes(summary.stage))
  }

  if (caseRow.status === 'approved' || caseRow.status === 'released' || caseRow.status === 'rejected') {
    return summaries
  }

  return []
}

export default function CaseList() {
  const [searchParams] = useSearchParams()
  const typeParam = searchParams.get('type') ?? ''
  const queueParam = searchParams.get('queue') ?? ''
  const blockedParam = searchParams.get('blocked') === 'true'
  const overdueParam = searchParams.get('overdue') === 'true'
  const ownerParam = searchParams.get('owner') ?? ''
  const dateFromParam = searchParams.get('dateFrom') ?? ''
  const dateToParam = searchParams.get('dateTo') ?? ''
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const allowedCaseTypes = allowedCaseTypesForUser(user, ALL_CASE_TYPES)

  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterTypeInput, setFilterTypeInput] = useState(typeParam)
  const [filterQueue, setFilterQueue] = useState(queueParam)
  const [filterBlocked, setFilterBlocked] = useState(blockedParam)
  const [filterOverdue, setFilterOverdue] = useState(overdueParam)
  const [filterOwner, setFilterOwner] = useState(ownerParam)
  const [dateFrom, setDateFrom] = useState(dateFromParam)
  const [dateTo, setDateTo] = useState(dateToParam)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [deletingId, setDeletingId] = useState(null)
  const LIMIT = 15
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const filterType = typeParam || filterTypeInput

  useEffect(() => {
    if (typeParam && !allowedCaseTypes.includes(typeParam)) {
      navigate('/cases?type=medical', { replace: true })
    }
  }, [allowedCaseTypes, navigate, typeParam])

  const fetchCases = async (targetPage = page, overrides = {}) => {
    try {
      const nextSearch = overrides.search ?? search
      const nextType = overrides.filterType ?? filterType
      const nextQueue = overrides.filterQueue ?? filterQueue
      const nextBlocked = overrides.filterBlocked ?? filterBlocked
      const nextOverdue = overrides.filterOverdue ?? filterOverdue
      const nextOwner = overrides.filterOwner ?? filterOwner
      const nextDateFrom = overrides.dateFrom ?? dateFrom
      const nextDateTo = overrides.dateTo ?? dateTo
      const params = new URLSearchParams({ page: String(targetPage), limit: String(LIMIT) })
      if (nextSearch) params.append('search', nextSearch)
      if (nextType) params.append('type', nextType)
      if (nextQueue) params.append('queue', nextQueue)
      if (nextBlocked) params.append('blocked', 'true')
      if (nextOverdue) params.append('overdue', 'true')
      if (nextOwner) params.append('owner', nextOwner)
      if (nextDateFrom) params.append('dateFrom', nextDateFrom)
      if (nextDateTo) params.append('dateTo', nextDateTo)
      const res = await api.get(`/cases?${params}`)
      setCases(res.data.cases || [])
      setTotal(res.data.total || 0)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to load cases')
      setCases([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
        if (debouncedSearch) params.append('search', debouncedSearch)
        if (filterType) params.append('type', filterType)
        if (filterQueue) params.append('queue', filterQueue)
        if (filterBlocked) params.append('blocked', 'true')
        if (filterOverdue) params.append('overdue', 'true')
        if (filterOwner) params.append('owner', filterOwner)
        if (dateFrom) params.append('dateFrom', dateFrom)
        if (dateTo) params.append('dateTo', dateTo)
        const res = await api.get(`/cases?${params}`)
        if (!active) return
        setCases(res.data.cases || [])
        setTotal(res.data.total || 0)
      } catch (err) {
        if (!active) return
        toast.error(err.response?.data?.message ?? 'Failed to load cases')
        setCases([])
        setTotal(0)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [page, filterType, filterQueue, filterBlocked, filterOverdue, filterOwner, dateFrom, dateTo, debouncedSearch])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete case ${c.caseNumber}? This cannot be undone.`)) return
    setDeletingId(c.id)
    try {
      await api.delete(`/cases/${c.id}`)
      toast.success(`Case ${c.caseNumber} deleted`)
      fetchCases()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete case')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="portal-kicker">
            {typeParam ? `Cases › ${TYPE_LABEL[typeParam] ?? typeParam}` : 'Case Management'}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
            {typeParam ? `${TYPE_LABEL[typeParam] ?? typeParam} Cases` : 'All Cases'}
          </h1>
          <p className="portal-page-subtitle">{total} case{total !== 1 ? 's' : ''} found in total</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/documents/verify" className="portal-button-secondary">
            <QrCodeIcon className="h-4 w-4" />
            QR Verifier
          </Link>
          <Link
            to={typeParam ? `/cases/new?type=${typeParam}` : '/cases/new'}
            className="portal-button-green"
            id="btn-new-case"
          >
            <PlusIcon className="h-4 w-4" />
            {typeParam ? `New ${TYPE_LABEL[typeParam] ?? typeParam} Case` : 'New Case'}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 p-3">
          <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by case id number or client name..."
              value={search}
              onChange={(e) => {
                setLoading(true)
                setSearch(e.target.value)
                setPage(1)
              }}
              className="portal-input pl-9"
              id="case-search"
            />
          </div>
          {!typeParam && (
            <select value={filterTypeInput} onChange={(e) => { setLoading(true); setFilterTypeInput(e.target.value); setPage(1) }} className="portal-input w-40" id="filter-type">
              <option value="">All Types</option>
              {allowedCaseTypes.map((type) => (
                <option key={type} value={type}>{TYPE_LABEL[type]}</option>
              ))}
            </select>
          )}
          <select value={filterQueue} onChange={(e) => { setLoading(true); setFilterQueue(e.target.value); setPage(1) }} className="portal-input w-52" id="filter-queue">
            <option value="">All Queues</option>
            {Object.entries(QUEUE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100 mt-1">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={filterBlocked} onChange={(e) => { setLoading(true); setFilterBlocked(e.target.checked); setPage(1) }} className="accent-emerald-600" />
              Blocked only
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={filterOverdue} onChange={(e) => { setLoading(true); setFilterOverdue(e.target.checked); setPage(1) }} className="accent-emerald-600" />
              Overdue only
            </label>
            <select value={filterOwner} onChange={(e) => { setLoading(true); setFilterOwner(e.target.value); setPage(1) }} className="portal-input w-40" id="filter-owner">
              <option value="">All Owners</option>
              <option value="me">My Work</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600" htmlFor="filter-date-from">
              From
              <input
                type="date"
                id="filter-date-from"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => { setLoading(true); setDateFrom(e.target.value); setPage(1) }}
                className="portal-input w-40"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600" htmlFor="filter-date-to">
              To
              <input
                type="date"
                id="filter-date-to"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => { setLoading(true); setDateTo(e.target.value); setPage(1) }}
                className="portal-input w-40"
              />
            </label>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setLoading(true); setDateFrom(''); setDateTo(''); setPage(1) }}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 underline"
              >
                Clear dates
              </button>
            )}
          </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            {typeParam ? `${TYPE_LABEL[typeParam] ?? typeParam} Cases` : 'All Cases'}
          </p>
          <p className="text-xs text-slate-400">{total} result{total !== 1 ? 's' : ''}</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
          </div>
        ) : cases.length === 0 ? (
          <div className="portal-empty">
            <FolderIcon className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="font-medium text-slate-500">No cases found</p>
            <p className="text-sm text-slate-400 mt-1">Try adjusting your filters or open a new case.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="table-header text-left">Case ID #</th>
                  <th className="table-header text-left">Client</th>
                  <th className="table-header text-left">Type</th>
                  <th className="table-header text-left">Status</th>
                  <th className="table-header text-left">Workflow</th>
                  <th className="table-header text-left">Social Worker</th>
                  <th className="table-header text-left">Date</th>
                  <th className="table-header text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
              {cases.map((c) => {
                const approvalMessages = workflowApprovalMessages(c)
                const canEdit = !!c.permissions?.canEdit
                const canDelete = !!c.permissions?.canDelete
                return (
                <tr
                  key={c.id}
                  className="table-row cursor-pointer focus-within:bg-slate-50 hover:bg-slate-50"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate(`/cases/${c.id}`)
                    }
                  }}
                  title="Open case"
                >
                  <td className="table-cell">
                    <Link to={`/cases/${c.id}`} className="font-mono text-xs font-bold text-brand-primary hover:underline">
                      {c.caseNumber || <span className="font-normal text-slate-400">—</span>}
                    </Link>
                  </td>
                  <td className="table-cell font-medium text-slate-800">
                    {c.beneficiaryName || formatClientName(c.client)}
                    {c.beneficiaryName && (
                      <p className="mt-0.5 text-xs font-normal text-slate-400">
                        Filed under {formatClientName(c.client)}
                      </p>
                    )}
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${
                      c.assistanceType === 'medicine' ? 'badge-green' :
                      c.assistanceType === 'hospital' ? 'badge-blue' :
                      c.assistanceType === 'medical' ? 'badge-blue' :
                      c.assistanceType === 'eyeglass' ? 'badge-amber' :
                      c.assistanceType === 'plain' ? 'badge-slate' : 'badge-slate'
                    }`}>
                      {c.assistanceType === 'medicine' ? 'Medicine' :
                       c.assistanceType === 'hospital' ? 'Hospital' :
                       c.assistanceType === 'medical' ? 'Medical' :
                       c.assistanceType === 'eyeglass' ? 'Eyeglass' :
                       c.assistanceType === 'plain' ? 'Plain AICS' : 'Burial'}
                    </span>
                  </td>
                  <td className="table-cell"><StatusBadge status={c.status} /></td>
                  <td className="table-cell">
                    <div className="space-y-1">
                      <span className={`badge ${c.isBlocked ? 'badge-red' : c.overdue ? 'badge-amber' : 'badge-slate'}`}>
                        {QUEUE_LABEL[c.queue] || c.queue}
                      </span>
                      <p className="text-[11px] text-slate-500">{c.nextAction}</p>
                      {approvalMessages.map((summary) => {
                        const verb =
                          summary.action === 'rejected'
                            ? 'disapproved'
                            : summary.stage === 'for_review'
                              ? 'reviewed'
                              : summary.stage === 'recommending_approval'
                                ? 'recommended'
                                : 'approved'

                        return (
                          <p key={`${c.id}-${summary.stage}`} className="text-[11px] text-slate-600">
                            {summary.actorName} {verb} this application on {formatDate(summary.actedAt)}.
                          </p>
                        )
                      })}
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        {c.isBlocked ? <span className="text-red-600 font-medium">{c.blockers?.length || 0} blocker(s)</span> : null}
                        {c.overdue ? <span className="text-amber-600 font-medium">Overdue</span> : null}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-slate-500 text-xs">{c.socialWorkerName || '—'}</td>
                  <td className="table-cell text-slate-400 text-xs">{formatDate(c.dateOfAssessment)}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          navigate(`/cases/${c.id}`)
                        }}
                        title={canEdit ? 'Open case' : 'View reports'}
                        className="rounded p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        {canEdit ? <EditIcon className="h-4 w-4" /> : <FolderIcon className="h-4 w-4" />}
                      </button>
                      {canDelete ? (
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDelete(c)
                          }}
                          disabled={deletingId === c.id}
                          title="Delete case"
                          className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                )
              })}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
            <span className="mr-2 text-xs text-slate-500">Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => { setLoading(true); setPage((p) => Math.max(1, p - 1)) }}
              disabled={page <= 1}
              className="inline-flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { setLoading(true); setPage((p) => Math.min(totalPages, p + 1)) }}
              disabled={page >= totalPages}
              className="inline-flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
