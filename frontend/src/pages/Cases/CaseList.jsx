import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { formatDate } from '../../lib/utils'
import StatusBadge from '../../components/ui/StatusBadge'
import { PlusIcon, SearchIcon, FolderIcon, EditIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, QrCodeIcon } from '../../components/ui/Icons'

const STATUS_OPTIONS = ['intake', 'encoding', 'for_review', 'recommending_approval', 'for_approval', 'approved', 'released', 'rejected']
const TYPE_LABEL = { medicine: 'Medicine', burial: 'Burial', hospital: 'Hospital', medical: 'Medical', eyeglass: 'Eyeglass', plain: 'Plain AICS' }

export default function CaseList() {
  const [searchParams] = useSearchParams()
  const typeParam = searchParams.get('type') ?? ''
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const approvalStatusDefault = useMemo(() => {
    const levels = user?.approvalLevel ?? []
    if (levels.includes('reviewer'))    return 'for_review'
    if (levels.includes('recommender')) return 'recommending_approval'
    if (levels.includes('approver'))    return 'for_approval'
    return ''
  }, [user])

  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterTypeInput, setFilterTypeInput] = useState(typeParam)
  const [filterStatus, setFilterStatus] = useState(approvalStatusDefault)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [deletingId, setDeletingId] = useState(null)
  const LIMIT = 15
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const filterType = typeParam || filterTypeInput

  const fetchCases = async (targetPage = page, overrides = {}) => {
    try {
      const nextSearch = overrides.search ?? search
      const nextType = overrides.filterType ?? filterType
      const nextStatus = overrides.filterStatus ?? filterStatus
      const params = new URLSearchParams({ page: String(targetPage), limit: String(LIMIT) })
      if (nextSearch) params.append('search', nextSearch)
      if (nextType) params.append('type', nextType)
      if (nextStatus) params.append('status', nextStatus)
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
        if (filterStatus) params.append('status', filterStatus)
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
  }, [page, filterType, filterStatus, debouncedSearch])

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
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="portal-page-title">
            {typeParam ? `${TYPE_LABEL[typeParam] ?? typeParam} Cases` : 'All Cases'}
          </h1>
          <p className="portal-page-subtitle">{total} case{total !== 1 ? 's' : ''} found</p>
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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row bg-white border border-slate-200 rounded-lg px-4 py-3">
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
          {/* Hide type filter when locked from nav */}
          {!typeParam && (
            <select value={filterTypeInput} onChange={(e) => { setLoading(true); setFilterTypeInput(e.target.value); setPage(1) }} className="portal-input w-40" id="filter-type">
              <option value="">All Types</option>
              <option value="medicine">Medicine</option>
              <option value="medical">Medical</option>
              <option value="hospital">Hospital</option>
              <option value="burial">Burial</option>
              <option value="eyeglass">Eyeglass</option>
              <option value="plain">Plain AICS</option>
            </select>
          )}
          <select value={filterStatus} onChange={(e) => { setLoading(true); setFilterStatus(e.target.value); setPage(1) }} className="portal-input w-44" id="filter-status">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
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
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header text-left">Case ID #</th>
                <th className="table-header text-left">Client</th>
                <th className="table-header text-left">Type</th>
                <th className="table-header text-left">Status</th>
                <th className="table-header text-left">Social Worker</th>
                <th className="table-header text-left">Date</th>
                <th className="table-header text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell">
                    <Link to={`/cases/${c.id}`} className="font-mono text-xs font-bold text-brand-primary hover:underline">
                      {c.caseNumber || <span className="font-normal text-slate-400">—</span>}
                    </Link>
                  </td>
                  <td className="table-cell font-medium text-slate-800">
                    {c.client?.lastName}, {c.client?.firstName}
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
                  <td className="table-cell text-slate-500 text-xs">{c.socialWorkerName || '—'}</td>
                  <td className="table-cell text-slate-400 text-xs">{formatDate(c.dateOfAssessment)}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/cases/${c.id}`)}
                        title="Edit case"
                        className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <EditIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={deletingId === c.id}
                        title="Delete case"
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
            <span className="mr-2 text-xs text-slate-500">Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => { setLoading(true); setPage((p) => Math.max(1, p - 1)) }}
              disabled={page <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { setLoading(true); setPage((p) => Math.min(totalPages, p + 1)) }}
              disabled={page >= totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
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
