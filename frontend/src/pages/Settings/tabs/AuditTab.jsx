import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { ChevronLeftIcon, ChevronRightIcon } from '../../../components/ui/Icons'
import { AUDIT_PAGE_SIZE, formatAuditTime } from '../settingsConstants'

export default function AuditTab() {
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditSearchInput, setAuditSearchInput] = useState('')
  const [auditSearch, setAuditSearch] = useState('')
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data } = await api.get('/users/audit-trail', {
          params: {
            page: auditPage,
            limit: AUDIT_PAGE_SIZE,
            ...(auditSearch ? { search: auditSearch } : {}),
          },
        })
        if (!active) return
        setAuditLogs(data.logs || [])
        setAuditTotalPages(data.totalPages || 1)
        setAuditTotal(data.total || 0)
      } catch {
        if (active) toast.error('Failed to load audit trail')
      } finally {
        if (active) setAuditLoading(false)
      }
    })()
    return () => { active = false }
  }, [auditSearch, auditPage])

  const applyAuditSearch = (e) => {
    e.preventDefault()
    setAuditLoading(true)
    setAuditPage(1)
    setAuditSearch(auditSearchInput.trim())
  }

  const clearAuditSearch = () => {
    setAuditLoading(true)
    setAuditPage(1)
    setAuditSearchInput('')
    setAuditSearch('')
  }

  const changeAuditPage = (nextPage) => {
    setAuditLoading(true)
    setAuditPage(nextPage)
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Audit Trail</h2>
            <p className="text-sm text-slate-500">Employee document and approval actions.</p>
          </div>
          <form onSubmit={applyAuditSearch} className="flex w-full gap-2 md:w-auto">
            <input
              type="text"
              value={auditSearchInput}
              onChange={(e) => setAuditSearchInput(e.target.value)}
              placeholder="Search by employee ID or name"
              className="portal-input h-10 md:w-72"
            />
            <button type="submit" className="portal-button-secondary h-10 px-4">Search</button>
            {auditSearch && (
              <button type="button" onClick={clearAuditSearch} className="portal-button-secondary h-10 px-4">Clear</button>
            )}
          </form>
        </div>
      </div>
      {auditLoading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading audit trail...</div>
      ) : (
        <>
          <table className="table-base w-full table-auto">
            <thead>
              <tr>
                <th className="table-th px-5 py-3 text-left">Date/Time</th>
                <th className="table-th px-5 py-3 text-left">Employee</th>
                <th className="table-th px-5 py-3 text-left">Case</th>
                <th className="table-th px-5 py-3 text-left">Action</th>
                <th className="table-th px-5 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="table-td px-5 py-4 align-top text-xs text-slate-600">{formatAuditTime(log.changedAt)}</td>
                  <td className="table-td px-5 py-4 align-top">
                    <div className="font-medium text-slate-800">{log.user?.name ?? 'Unknown user'}</div>
                    <div className="mt-1 font-mono text-xs text-slate-500">ID: {log.user?.employeeId ?? '-'}</div>
                  </td>
                  <td className="table-td px-5 py-4 align-top">
                    <div className="font-medium text-slate-800">{log.case?.caseNumber ?? '-'}</div>
                    <div className="mt-1 text-xs text-slate-500">{log.case?.clientName ?? '-'}</div>
                  </td>
                  <td className="table-td px-5 py-4 align-top text-sm text-slate-800">{log.action}</td>
                  <td className="table-td px-5 py-4 align-top text-xs leading-relaxed text-slate-600">{log.notes || `${log.fromStatus} -> ${log.toStatus}`}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-td px-5 py-6 text-center text-slate-400">No audit records found.</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
            <span className="mr-2 text-xs text-slate-500">
              Page {auditPage} of {auditTotalPages} ({auditTotal} records)
            </span>
            <button
              type="button"
              onClick={() => changeAuditPage(Math.max(1, auditPage - 1))}
              disabled={auditPage <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => changeAuditPage(Math.min(auditTotalPages, auditPage + 1))}
              disabled={auditPage >= auditTotalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
