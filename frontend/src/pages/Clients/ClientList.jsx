import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { formatDate } from '../../lib/utils'
import { PlusIcon, SearchIcon, UsersIcon, ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from '../../components/ui/Icons'

export default function ClientList() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const LIMIT = 15
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = searchInput.trim()
      setSearch(nextSearch)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
        if (search) params.append('search', search)
        const res = await api.get(`/clients?${params}`)
        if (!active) return
        setClients(res.data.clients || [])
        setTotal(res.data.total || 0)
      } catch {
        if (!active) return
        setClients([])
        setTotal(0)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [page, search])

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="portal-kicker">Registry</p>
          <h1 className="portal-page-title">Client Profiles</h1>
          <p className="portal-page-subtitle">{total} clients registered</p>
        </div>
        <Link to="/clients/new" className="portal-button-green" id="btn-new-client">
          <PlusIcon className="h-4 w-4" />
          New Client
        </Link>
      </div>

      <div className="card mb-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, client number, or address..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="portal-input pl-9"
            id="client-search-list"
          />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
          </div>
        ) : clients.length === 0 ? (
          <div className="portal-empty">
            <UsersIcon className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="font-medium text-slate-500">No clients found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header text-left">Client ID Number</th>
                <th className="table-header text-left">Full Name</th>
                <th className="table-header text-left">Date of Birth</th>
                <th className="table-header text-left">Sex</th>
                <th className="table-header text-left">Municipality</th>
                <th className="table-header text-left">Classifications</th>
                <th className="table-header" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="table-row cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                  <td className="table-cell font-mono text-xs text-brand-primary font-bold">{c.caseNumber.replace(/^AICS-/, 'CID-')}</td>
                  <td className="table-cell font-medium">{c.lastName}, {c.firstName}</td>
                  <td className="table-cell text-xs">{formatDate(c.dateOfBirth)}</td>
                  <td className="table-cell text-xs">{c.sex}</td>
                  <td className="table-cell text-xs">{c.municipality}</td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      {c.is4ps && <span className="badge badge-green">4Ps</span>}
                      {c.isPwd && <span className="badge badge-blue">PWD</span>}
                      {c.isSenior && <span className="badge badge-amber">SC</span>}
                    </div>
                  </td>
                  <td className="table-cell">
                    <ArrowRightIcon className="h-4 w-4 text-slate-300" />
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
