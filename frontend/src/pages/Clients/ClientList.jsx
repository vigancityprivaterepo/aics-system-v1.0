import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { formatDate } from '../../lib/utils'
import { PlusIcon, SearchIcon, UsersIcon } from '../../components/ui/Icons'
import RfidScanButton from '../../components/RfidScanButton'

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
      {/* Page header */}
      <div className="mb-5 border-b border-slate-200 pb-4">
        <p className="portal-kicker">Registry</p>
        <h1 className="portal-page-title">Client Profile</h1>
        <p className="portal-page-subtitle">Registered beneficiaries and household records — {total} client{total !== 1 ? 's' : ''}.</p>
      </div>

      <div className="card mb-5 flex flex-wrap items-center gap-2.5 p-3.5">
        <div className="relative min-w-0 flex-[1_1_280px]">
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
        <RfidScanButton
          onClientFound={(client) => navigate(`/clients/${client.id}`)}
        />
        <Link to="/clients/new" className="portal-button-green" id="btn-new-client">
          <PlusIcon className="h-4 w-4" />
          New Client
        </Link>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Client Registry</p>
          <p className="text-xs text-slate-400">{total} record{total !== 1 ? 's' : ''}</p>
        </div>
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
                  <td className="table-cell font-mono text-xs font-semibold text-[#0f2d52]">{c.caseNumber.replace(/^AICS-/, 'CID-')}</td>
                  <td className="table-cell text-[13.5px] font-semibold text-slate-800">{c.lastName}, {c.firstName}</td>
                  <td className="table-cell text-xs">{formatDate(c.dateOfBirth)}</td>
                  <td className="table-cell text-xs">{c.sex}</td>
                  <td className="table-cell text-xs">{c.municipality}</td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1.5">
                      {c.is4ps && <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] text-slate-600">4Ps</span>}
                      {c.isPwd && <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] text-slate-600">PWD</span>}
                      {c.isSenior && <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] text-slate-600">Senior Citizen</span>}
                    </div>
                  </td>
                  <td className="table-cell text-right">
                    <span className="text-[12.5px] font-semibold text-[#059669]">View</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > LIMIT && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3.5">
            <p className="text-[12.5px] text-gray-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total.toLocaleString()} clients
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => { setLoading(true); setPage((p) => Math.max(1, p - 1)) }}
                disabled={page <= 1}
                className="h-[34px] rounded-lg border border-slate-300 bg-white px-3 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="inline-flex h-[34px] min-w-[34px] items-center justify-center rounded-lg bg-[#0f2d52] px-2 text-[12.5px] font-bold text-white">
                {page}
              </span>
              <button
                type="button"
                onClick={() => { setLoading(true); setPage((p) => Math.min(totalPages, p + 1)) }}
                disabled={page >= totalPages}
                className="h-[34px] rounded-lg border border-slate-300 bg-white px-3 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
