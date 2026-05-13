import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  IdCardIcon,
  SearchIcon,
  TrashIcon,
} from '../../components/ui/Icons'

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ApplicantAccountsPage() {
  const [applicants, setApplicants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const LIMIT = 10

  const fetchApplicants = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (search.trim()) params.set('search', search.trim())
      const res = await api.get(`/applicants?${params.toString()}`)
      setApplicants(res.data.applicants || [])
      setTotal(res.data.total || 0)
      setTotalPages(res.data.totalPages || 1)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load applicants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchApplicants()
    }, 300)

    return () => clearTimeout(timer)
  }, [page, search])

  const handleDeleteApplicant = async (applicant) => {
    const confirmed = window.confirm(
      `Delete applicant ${applicant.email}?\n\nThis removes the portal account and its portal applications. Linked client records and staff cases will remain.`,
    )
    if (!confirmed) return

    try {
      await api.delete(`/applicants/${applicant.id}`)
      toast.success('Applicant deleted')
      if (applicants.length === 1 && page > 1) {
        setPage((current) => current - 1)
      } else {
        fetchApplicants()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete applicant')
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <p className="portal-kicker">Administration</p>
        <h1 className="portal-page-title">Applicant Accounts</h1>
        <p className="portal-page-subtitle">Review and delete applicant portal accounts managed by the admin office.</p>
      </div>

      <section className="card mb-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search by email, name, or mobile number"
            className="portal-input pl-9"
          />
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
          </div>
        ) : applicants.length === 0 ? (
          <div className="portal-empty">
            <IdCardIcon className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="font-medium text-slate-500">No applicant accounts found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header text-left">Applicant</th>
                <th className="table-header text-left">Mobile</th>
                <th className="table-header text-left">Status</th>
                <th className="table-header text-left">Portal Applications</th>
                <th className="table-header text-left">Linked Client</th>
                <th className="table-header text-left">Created</th>
                <th className="table-header text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((applicant) => (
                <tr key={applicant.id} className="table-row">
                  <td className="table-cell">
                    <p className="font-medium text-slate-800">{applicant.lastName}, {applicant.firstName}</p>
                    <p className="text-xs text-slate-500">{applicant.email}</p>
                  </td>
                  <td className="table-cell text-xs">{applicant.mobileNumber || '—'}</td>
                  <td className="table-cell">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${applicant.isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {applicant.isVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </td>
                  <td className="table-cell text-xs">{applicant.applicationCount}</td>
                  <td className="table-cell text-xs font-mono text-brand-primary">{applicant.clientCaseNumber || '—'}</td>
                  <td className="table-cell text-xs">{formatDateTime(applicant.createdAt)}</td>
                  <td className="table-cell">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDeleteApplicant(applicant)}
                        className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > LIMIT && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
            <span className="mr-2 text-xs text-slate-500">Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      <p className="mt-3 text-xs text-slate-500">{total} applicant account{total === 1 ? '' : 's'} found</p>
    </div>
  )
}
