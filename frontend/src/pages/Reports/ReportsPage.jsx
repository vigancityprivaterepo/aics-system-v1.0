import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { DocumentIcon, UsersIcon, ChartIcon, ChevronLeftIcon, ChevronRightIcon, CheckCircleIcon, DownloadIcon } from '../../components/ui/Icons'

const peso = (n) => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

const STATUS_LABEL = {
  intake: 'Intake',
  encoding: 'Encoding',
  for_review: 'For Review',
  recommending_approval: 'Recommending Approval',
  for_approval: 'For Approval',
  approved: 'Approved',
  released: 'Released',
  rejected: 'Rejected',
}

const STATUS_COLOR = {
  intake: 'bg-slate-100 text-slate-600',
  encoding: 'bg-blue-100 text-blue-700',
  for_review: 'bg-violet-100 text-violet-700',
  recommending_approval: 'bg-indigo-100 text-indigo-700',
  for_approval: 'bg-sky-100 text-sky-700',
  approved: 'bg-emerald-100 text-emerald-700',
  released: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

const REPORT_TYPE_ORDER = ['medicine', 'medical', 'hospital', 'burial', 'eyeglass']

const TYPE_META = {
  medicine: { label: 'Medicine', color: 'bg-emerald-100 text-emerald-700' },
  medical: { label: 'Medical', color: 'bg-blue-100 text-blue-700' },
  hospital: { label: 'Hospital', color: 'bg-violet-100 text-violet-700' },
  burial: { label: 'Burial', color: 'bg-slate-100 text-slate-600' },
  eyeglass: { label: 'Eyeglass', color: 'bg-amber-100 text-amber-700' },
}

const TABS = [
  { key: 'summary', label: 'Summary', Icon: ChartIcon },
  { key: 'cases', label: 'Case Listing', Icon: DocumentIcon },
  { key: 'barangay', label: 'By Barangay', Icon: UsersIcon },
  { key: 'guarantee-letters', label: 'Guarantee Letters', Icon: CheckCircleIcon },
]
const CASES_PAGE_LIMIT = 10

function getTypeMeta(type) {
  return TYPE_META[type] ?? { label: type || 'Unknown', color: 'bg-slate-100 text-slate-600' }
}

function downloadBlobFile(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function PeriodPicker({ from, to, onChange }) {
  return (
    <div className="flex flex-wrap items-end gap-3 lg:gap-4">
      <div className="flex min-w-[190px] flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">From</label>
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => onChange(e.target.value, to)}
          className="portal-input py-2.5 text-sm"
        />
      </div>
      <div className="flex min-w-[190px] flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">To</label>
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => onChange(from, e.target.value)}
          className="portal-input py-2.5 text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {[
          { label: 'This Month', from: dayjs().startOf('month').format('YYYY-MM-DD'), to: dayjs().endOf('month').format('YYYY-MM-DD') },
          { label: 'Last Month', from: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), to: dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD') },
          { label: 'This Year', from: dayjs().startOf('year').format('YYYY-MM-DD'), to: dayjs().endOf('year').format('YYYY-MM-DD') },
        ].map((p) => (
          <button
            key={p.label}
            onClick={() => onChange(p.from, p.to)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SummaryTab({ data }) {
  if (!data) return <div className="py-16 text-center text-sm text-slate-400">No data for selected period.</div>

  const allStatuses = ['intake', 'encoding', 'for_review', 'recommending_approval', 'for_approval', 'approved', 'released', 'rejected']

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:gap-5 sm:grid-cols-4">
        {[
          { label: 'Total Cases', value: data.totalCases, sub: 'cases opened' },
          { label: 'Total Disbursed', value: peso(data.totalAmount), sub: 'amount released' },
          { label: 'New Clients', value: data.newClients, sub: 'registered this period' },
          { label: 'Avg per Case', value: data.totalCases ? peso(data.totalAmount / data.totalCases) : '—', sub: 'average assistance' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="card py-5 text-center">
            <p className="text-2xl font-bold text-brand-dark">{value}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-[11px] text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="card">
          <p className="form-section-title mb-4">By Assistance Type</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-left text-xs font-semibold text-slate-500">Type</th>
                <th className="pb-2 text-right text-xs font-semibold text-slate-500">Cases</th>
                <th className="pb-2 text-right text-xs font-semibold text-slate-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.byType.map((r) => {
                const meta = getTypeMeta(r.type)
                return (
                  <tr key={r.type}>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-medium">{r.count}</td>
                    <td className="py-2.5 text-right text-slate-600">{peso(r.amount)}</td>
                  </tr>
                )
              })}
              {data.byType.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-xs text-slate-400">No cases</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <p className="form-section-title mb-4">By Case Status</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-left text-xs font-semibold text-slate-500">Status</th>
                <th className="pb-2 text-right text-xs font-semibold text-slate-500">Cases</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {allStatuses.map((status) => {
                const row = data.byStatus.find((r) => r.status === status)
                const count = row?.count ?? 0
                return (
                  <tr key={status}>
                    <td className="py-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium">{count}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CasesTab({ data, filters, onFilterChange, page, totalPages, onPageChange }) {
  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="portal-kicker">Case Filters</p>
            <h3 className="mt-1 text-base font-semibold text-slate-800">Review and narrow report entries</h3>
          </div>
          {data && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
              {data.total} record{data.total !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_240px]">
          <select
            value={filters.type}
            onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
            className="portal-input py-2.5 text-sm"
          >
            <option value="">All Types</option>
            {REPORT_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {getTypeMeta(type).label}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className="portal-input py-2.5 text-sm"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {data && data.total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
              Showing {(page - 1) * CASES_PAGE_LIMIT + 1}-
              {Math.min(page * CASES_PAGE_LIMIT, data.total)} of {data.total}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="portal-kicker">Results</p>
            <h3 className="mt-1 text-base font-semibold text-slate-800">Case listing</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="table-base w-full min-w-full">
          <thead>
            <tr>
              <th className="table-th px-5 py-4 text-left">Case No.</th>
              <th className="table-th px-5 py-4 text-left">Client ID</th>
              <th className="table-th px-5 py-4 text-left">Client</th>
              <th className="table-th px-5 py-4 text-left">Barangay</th>
              <th className="table-th px-5 py-4 text-left">Type</th>
              <th className="table-th px-5 py-4 text-left">Status</th>
              <th className="table-th px-5 py-4 text-left">Social Worker</th>
              <th className="table-th px-5 py-4 text-right">Amount</th>
              <th className="table-th px-5 py-4 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.cases.map((c) => {
              const meta = getTypeMeta(c.assistanceType)
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="table-td px-5 py-4 align-top font-mono text-xs">{c.caseNumber || <span className="font-sans text-slate-400">—</span>}</td>
                  <td className="table-td px-5 py-4 align-top font-mono text-xs text-slate-500">{c.clientId || '—'}</td>
                  <td className="table-td px-5 py-4 align-top font-medium text-slate-800">
                    {c.clientName}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.is4ps && <span className="badge badge-green px-1 py-0 text-[9px]">4Ps</span>}
                      {c.isPwd && <span className="badge badge-blue px-1 py-0 text-[9px]">PWD</span>}
                      {c.isSenior && <span className="badge badge-amber px-1 py-0 text-[9px]">SC</span>}
                    </div>
                  </td>
                  <td className="table-td px-5 py-4 align-top text-xs leading-relaxed text-slate-600">{c.barangay}</td>
                  <td className="table-td px-5 py-4 align-top">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="table-td px-5 py-4 align-top">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="table-td px-5 py-4 align-top text-xs leading-relaxed text-slate-500">{c.socialWorkerName}</td>
                  <td className="table-td px-5 py-4 align-top text-right font-mono text-sm">{c.amount ? peso(c.amount) : '—'}</td>
                  <td className="table-td px-5 py-4 align-top text-xs text-slate-500">{c.createdAt}</td>
                </tr>
              )
            })}
            {(!data || data.cases.length === 0) && (
              <tr><td colSpan={8} className="table-td px-5 py-10 text-center text-slate-400">No cases found.</td></tr>
            )}
          </tbody>
          {data && data.cases.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={7} className="table-td px-5 py-4 text-xs font-semibold text-slate-500">TOTAL ({data.total} cases)</td>
                <td className="table-td px-5 py-4 text-right font-mono font-bold">
                  {peso(data.cases.reduce((s, c) => s + c.amount, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>
    </div>
  )
}

function BarangayTab({ data }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="portal-kicker">Coverage</p>
          <h3 className="mt-1 text-base font-semibold text-slate-800">Barangay distribution</h3>
        </div>
      </div>
      <div className="overflow-x-auto">
      <table className="table-base w-full min-w-full">
        <thead>
          <tr>
            <th className="table-th px-5 py-4 text-left">#</th>
            <th className="table-th px-5 py-4 text-left">Barangay</th>
            <th className="table-th px-5 py-4 text-left">Municipality</th>
            <th className="table-th px-5 py-4 text-right">Medicine</th>
            <th className="table-th px-5 py-4 text-right">Medical</th>
            <th className="table-th px-5 py-4 text-right">Hospital</th>
            <th className="table-th px-5 py-4 text-right">Burial</th>
            <th className="table-th px-5 py-4 text-right">Eyeglass</th>
            <th className="table-th px-5 py-4 text-right">Total Cases</th>
            <th className="table-th px-5 py-4 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data?.rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="table-td px-5 py-4 text-xs text-slate-400">{i + 1}</td>
              <td className="table-td px-5 py-4 font-medium text-slate-800">{r.barangay}</td>
              <td className="table-td px-5 py-4 text-xs text-slate-500">{r.municipality}</td>
              <td className="table-td px-5 py-4 text-right">{r.medicine}</td>
              <td className="table-td px-5 py-4 text-right">{r.medical}</td>
              <td className="table-td px-5 py-4 text-right">{r.hospital}</td>
              <td className="table-td px-5 py-4 text-right">{r.burial}</td>
              <td className="table-td px-5 py-4 text-right">{r.eyeglass}</td>
              <td className="table-td px-5 py-4 text-right font-bold">{r.total}</td>
              <td className="table-td px-5 py-4 text-right font-mono text-sm">{peso(r.amount)}</td>
            </tr>
          ))}
          {(!data || data.rows.length === 0) && (
            <tr><td colSpan={10} className="table-td px-5 py-10 text-center text-slate-400">No data.</td></tr>
          )}
        </tbody>
        {data && data.rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td colSpan={3} className="table-td px-5 py-4 text-xs font-semibold text-slate-500">
                TOTAL ({data.rows.length} barangays)
              </td>
              <td className="table-td px-5 py-4 text-right font-bold">{data.rows.reduce((s, r) => s + r.medicine, 0)}</td>
              <td className="table-td px-5 py-4 text-right font-bold">{data.rows.reduce((s, r) => s + r.medical, 0)}</td>
              <td className="table-td px-5 py-4 text-right font-bold">{data.rows.reduce((s, r) => s + r.hospital, 0)}</td>
              <td className="table-td px-5 py-4 text-right font-bold">{data.rows.reduce((s, r) => s + r.burial, 0)}</td>
              <td className="table-td px-5 py-4 text-right font-bold">{data.rows.reduce((s, r) => s + r.eyeglass, 0)}</td>
              <td className="table-td px-5 py-4 text-right font-bold">{data.rows.reduce((s, r) => s + r.total, 0)}</td>
              <td className="table-td px-5 py-4 text-right font-mono font-bold">{peso(data.rows.reduce((s, r) => s + r.amount, 0))}</td>
            </tr>
          </tfoot>
        )}
      </table>
      </div>
    </div>
  )
}

function GuaranteeLettersTab({ data }) {
  const [search, setSearch] = useState('')
  if (!data) return <div className="py-8 text-center text-sm text-slate-400">Loading...</div>

  const GL_TYPE_LABELS = { burial: 'Burial', hospital: 'Hospital', medical: 'Medical' }
  const GL_TYPE_COLORS = { burial: 'bg-slate-100 text-slate-600', hospital: 'bg-violet-100 text-violet-700', medical: 'bg-blue-100 text-blue-700' }
  const searchTerm = search.trim().toLowerCase()

  const filteredItems = !searchTerm
    ? data.items
    : data.items.filter((item) => {
      const typeLabel = GL_TYPE_LABELS[item.assistanceType] ?? item.assistanceType ?? ''
      const haystack = [
        item.caseNumber ?? '',
        item.clientName ?? '',
        typeLabel,
      ].join(' ').toLowerCase()
      return haystack.includes(searchTerm)
    })

  const signed = filteredItems.filter((i) => i.signedGlUrl).length
  const pending = filteredItems.length - signed

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="portal-kicker">GL Tracker</p>
          <h3 className="mt-1 text-base font-semibold text-slate-800">Guarantee Letter Status</h3>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
            <CheckCircleIcon className="h-3.5 w-3.5" /> {signed} Signed
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-500">
            {pending} Pending
          </span>
        </div>
      </div>
      <div className="border-b border-slate-100 px-5 py-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by case #, client name, or type"
          className="portal-input w-full py-2.5 text-sm md:max-w-md"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="table-base w-full min-w-[700px] text-sm">
          <thead>
            <tr>
              <th className="table-th px-5 py-4 text-left">Case #</th>
              <th className="table-th px-5 py-4 text-left">Client</th>
              <th className="table-th px-5 py-4 text-left">Type</th>
              <th className="table-th px-5 py-4 text-right">Amount</th>
              <th className="table-th px-5 py-4 text-left">GL Status</th>
              <th className="table-th px-5 py-4 text-left">Upload Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400 italic">
                  No guarantee letter cases matched your search.
                </td>
              </tr>
            ) : filteredItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="table-td px-5 py-4 font-mono text-xs">{item.caseNumber ?? '—'}</td>
                <td className="table-td px-5 py-4 font-medium text-slate-800">{item.clientName}</td>
                <td className="table-td px-5 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${GL_TYPE_COLORS[item.assistanceType] ?? 'bg-slate-100 text-slate-600'}`}>
                    {GL_TYPE_LABELS[item.assistanceType] ?? item.assistanceType}
                  </span>
                </td>
                <td className="table-td px-5 py-4 text-right font-mono text-sm">
                  {item.amount > 0 ? peso(item.amount) : '—'}
                </td>
                <td className="table-td px-5 py-4">
                  {item.signedGlUrl ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircleIcon className="h-3.5 w-3.5" /> Signed
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Pending</span>
                  )}
                </td>
                <td className="table-td px-5 py-4 text-xs text-slate-500">
                  {item.glUploadedAt ? dayjs(item.glUploadedAt).format('MMM D, YYYY') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400">
        {filteredItems.length} record{filteredItems.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

export default function ReportsPage() {
  const [tab, setTab] = useState('summary')
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [to, setTo] = useState(dayjs().endOf('month').format('YYYY-MM-DD'))
  const [caseFilters, setCaseFilters] = useState({ type: '', status: '' })
  const [casePage, setCasePage] = useState(1)

  const [summary, setSummary] = useState(null)
  const [cases, setCases] = useState(null)
  const [barangay, setBarangay] = useState(null)
  const [glData, setGlData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [s, c, b, gl] = await Promise.all([
          api.get(`/reports/summary?from=${from}&to=${to}`),
          api.get(`/reports/cases?from=${from}&to=${to}&type=${caseFilters.type}&status=${caseFilters.status}&page=${casePage}&limit=${CASES_PAGE_LIMIT}`),
          api.get(`/reports/barangay?from=${from}&to=${to}`),
          api.get(`/reports/guarantee-letters?from=${from}&to=${to}`),
        ])
        if (!active) return
        setSummary(s.data)
        setCases(c.data)
        setBarangay(b.data)
        setGlData(gl.data)
      } catch {
        if (active) toast.error('Failed to load report data')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [from, to, caseFilters, casePage])

  const handlePeriodChange = (f, t) => {
    setLoading(true)
    setFrom(f)
    setTo(t)
    setCasePage(1)
  }
  const totalCasePages = Math.max(1, Math.ceil((cases?.total ?? 0) / CASES_PAGE_LIMIT))

  const handleExport = async () => {
    const stamp = `${from}_to_${to}`
    try {
      const res = await api.get(`/reports/summary/docx?from=${from}&to=${to}`, {
        responseType: 'blob',
      })
      downloadBlobFile(res.data, `executive-summary-${stamp}.docx`)
    } catch {
      toast.error('Failed to export the executive summary template')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-5 print:hidden">
        <div>
          <p className="portal-kicker">AICS</p>
          <h1 className="portal-page-title">Reports</h1>
          <p className="portal-page-subtitle max-w-2xl">Generate and review case assistance reports.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} className="portal-button-secondary print:hidden flex items-center gap-2">
            <DownloadIcon className="h-4 w-4" />
            Export Executive Summary
          </button>
        </div>
      </div>

      <div className="card print:hidden">
        <div className="space-y-5">
          <div>
            <p className="portal-kicker">Report Period</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-800">Select the coverage window</h2>
          </div>
          <PeriodPicker from={from} to={to} onChange={handlePeriodChange} />
        </div>
      </div>

      <div className="print:hidden flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`-mb-px flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === tabItem.key
                ? 'border-brand-green text-brand-green'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tabItem.Icon className="h-4 w-4" />
            {tabItem.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-12 text-center text-sm text-slate-400">Loading report…</div>
      )}

      {!loading && (
        <>
          {tab === 'summary' && <SummaryTab data={summary} />}
          {tab === 'cases' && (
            <CasesTab
              data={cases}
              filters={caseFilters}
              onFilterChange={(f) => {
                setLoading(true)
                setCaseFilters(f)
                setCasePage(1)
              }}
              page={casePage}
              totalPages={totalCasePages}
              onPageChange={(nextPage) => {
                setLoading(true)
                setCasePage(nextPage)
              }}
            />
          )}
          {tab === 'barangay' && <BarangayTab data={barangay} />}
          {tab === 'guarantee-letters' && <GuaranteeLettersTab data={glData} />}
        </>
      )}
    </div>
  )
}
