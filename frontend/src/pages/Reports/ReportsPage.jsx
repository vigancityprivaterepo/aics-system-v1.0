import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import {
  DocumentIcon,
  UsersIcon,
  ChartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  DownloadIcon,
} from '../../components/ui/Icons'

const peso = (n) => `PHP ${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

const REPORT_TYPE_ORDER = ['medicine', 'medical', 'hospital', 'burial', 'eyeglass', 'plain']
const REPORT_BASIS_OPTIONS = [
  { value: 'created', label: 'Created Date' },
  { value: 'assessment', label: 'Assessment Date' },
  { value: 'approved', label: 'Approved Date' },
  { value: 'released', label: 'Released Date' },
]
const CASES_PAGE_LIMIT = 10

const TYPE_META = {
  medicine: { label: 'Medicine', color: 'bg-emerald-100 text-emerald-700' },
  medical: { label: 'Medical', color: 'bg-blue-100 text-blue-700' },
  hospital: { label: 'Hospital', color: 'bg-violet-100 text-violet-700' },
  burial: { label: 'Burial', color: 'bg-slate-100 text-slate-600' },
  eyeglass: { label: 'Eyeglass', color: 'bg-amber-100 text-amber-700' },
  plain: { label: 'Plain AICS', color: 'bg-rose-100 text-rose-700' },
}

const TABS = [
  { key: 'summary', label: 'Summary', Icon: ChartIcon },
  { key: 'cases', label: 'Case Listing', Icon: DocumentIcon },
  { key: 'barangay', label: 'By Barangay', Icon: UsersIcon },
  { key: 'operations', label: 'Operations', Icon: CheckCircleIcon },
  { key: 'guarantee-letters', label: 'Guarantee Letters', Icon: CheckCircleIcon },
]

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

async function downloadApiFile(endpoint, fallbackFilename) {
  const response = await api.get(endpoint, { responseType: 'blob' })
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: 'application/octet-stream' })
  const disposition = String(response.headers?.['content-disposition'] ?? '')
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
  downloadBlobFile(blob, filenameMatch?.[1] ?? fallbackFilename)
}

function PeriodPicker({ from, to, basis, onChange, onBasisChange }) {
  return (
    <div className="flex flex-wrap items-end gap-3 lg:gap-4">
      <div className="flex min-w-[190px] flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Report Basis</label>
        <select
          value={basis}
          onChange={(e) => onBasisChange(e.target.value)}
          className="portal-input py-2.5 text-sm"
        >
          {REPORT_BASIS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
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
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.from, preset.to)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SummaryTab({ data, onTypeDrilldown, onStatusDrilldown }) {
  if (!data) return <div className="py-16 text-center text-sm text-slate-400">No data for selected period.</div>

  const allStatuses = ['intake', 'encoding', 'for_review', 'recommending_approval', 'for_approval', 'approved', 'released', 'rejected']

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:gap-5 sm:grid-cols-4">
        {[
          { label: 'Total Cases', value: data.totalCases, sub: data.basisLabel },
          { label: 'Total Amount', value: peso(data.totalAmount), sub: 'matching cases' },
          { label: 'Distinct Clients', value: data.distinctClients, sub: 'beneficiaries in report' },
          { label: 'Avg per Case', value: data.totalCases ? peso(data.totalAmount / data.totalCases) : '-', sub: 'average assistance' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="card py-5 text-center">
            <p className="text-2xl font-bold text-brand-dark">{value}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-[11px] text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: '4Ps', value: data.demographics?.is4ps ?? 0, color: 'bg-emerald-100 text-emerald-700' },
          { label: 'PWD', value: data.demographics?.isPwd ?? 0, color: 'bg-blue-100 text-blue-700' },
          { label: 'Senior Citizens', value: data.demographics?.isSenior ?? 0, color: 'bg-amber-100 text-amber-700' },
        ].map((item) => (
          <div key={item.label} className="card flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{item.value}</p>
            </div>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${item.color}`}>
              Beneficiaries
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <p className="form-section-title">By Assistance Type</p>
            <span className="text-xs text-slate-400">Click a row to open the matching cases</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-left text-xs font-semibold text-slate-500">Type</th>
                <th className="pb-2 text-right text-xs font-semibold text-slate-500">Cases</th>
                <th className="pb-2 text-right text-xs font-semibold text-slate-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.byType.map((row) => {
                const meta = getTypeMeta(row.type)
                return (
                  <tr key={row.type} className="hover:bg-slate-50">
                    <td className="py-2.5">
                      <button
                        type="button"
                        onClick={() => onTypeDrilldown(row.type)}
                        className="flex items-center gap-2 text-left"
                      >
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                      </button>
                    </td>
                    <td className="py-2.5 text-right font-medium">{row.count}</td>
                    <td className="py-2.5 text-right text-slate-600">{peso(row.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <p className="form-section-title">By Current Case Status</p>
            <span className="text-xs text-slate-400">Click a row to open the matching cases</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-left text-xs font-semibold text-slate-500">Status</th>
                <th className="pb-2 text-right text-xs font-semibold text-slate-500">Cases</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {allStatuses.map((status) => {
                const row = data.byStatus.find((item) => item.status === status)
                const count = row?.count ?? 0
                return (
                  <tr key={status} className="hover:bg-slate-50">
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => onStatusDrilldown(status)}
                        className="text-left"
                      >
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </button>
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

function CasesTab({ data, filters, basisLabel, onFilterChange, onResetFilters, page, totalPages, onPageChange }) {
  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="portal-kicker">Case Filters</p>
            <h3 className="mt-1 text-base font-semibold text-slate-800">Review and narrow report entries</h3>
            <p className="mt-1 text-xs text-slate-400">Listing sorted by {basisLabel.toLowerCase()}.</p>
          </div>
          {data && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
              {data.total} record{data.total !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            {Object.entries(STATUS_LABEL).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
          <input
            value={filters.barangay}
            onChange={(e) => onFilterChange({ ...filters, barangay: e.target.value })}
            placeholder="Barangay"
            className="portal-input py-2.5 text-sm"
          />
          <input
            value={filters.municipality}
            onChange={(e) => onFilterChange({ ...filters, municipality: e.target.value })}
            placeholder="Municipality"
            className="portal-input py-2.5 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          {data && data.total > 0 ? (
            <p className="text-xs text-slate-400">
              Showing {(page - 1) * CASES_PAGE_LIMIT + 1}-{Math.min(page * CASES_PAGE_LIMIT, data.total)} of {data.total}
            </p>
          ) : <span className="text-xs text-slate-400">No results yet</span>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetFilters}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Reset Filters
            </button>
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
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="table-base w-full min-w-full">
            <thead>
              <tr>
                <th className="table-th px-5 py-4 text-left">Case No.</th>
                <th className="table-th px-5 py-4 text-left">Client</th>
                <th className="table-th px-5 py-4 text-left">Barangay</th>
                <th className="table-th px-5 py-4 text-left">Type</th>
                <th className="table-th px-5 py-4 text-left">Status</th>
                <th className="table-th px-5 py-4 text-left">Social Worker</th>
                <th className="table-th px-5 py-4 text-right">Amount</th>
                <th className="table-th px-5 py-4 text-left">{basisLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.cases.map((row) => {
                const meta = getTypeMeta(row.assistanceType)
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="table-td px-5 py-4 align-top font-mono text-xs">
                      <Link to={`/cases/${row.id}/reports`} className="text-brand-green hover:underline">
                        {row.caseNumber || '-'}
                      </Link>
                    </td>
                    <td className="table-td px-5 py-4 align-top font-medium text-slate-800">
                      {row.clientName}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {row.is4ps && <span className="badge badge-green px-1 py-0 text-[9px]">4Ps</span>}
                        {row.isPwd && <span className="badge badge-blue px-1 py-0 text-[9px]">PWD</span>}
                        {row.isSenior && <span className="badge badge-amber px-1 py-0 text-[9px]">SC</span>}
                      </div>
                    </td>
                    <td className="table-td px-5 py-4 align-top text-xs leading-relaxed text-slate-600">
                      {row.barangay}
                      <div className="mt-1 text-[11px] text-slate-400">{row.municipality}</div>
                    </td>
                    <td className="table-td px-5 py-4 align-top">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="table-td px-5 py-4 align-top">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="table-td px-5 py-4 align-top text-xs leading-relaxed text-slate-500">{row.socialWorkerName}</td>
                    <td className="table-td px-5 py-4 align-top text-right font-mono text-sm">{row.amount ? peso(row.amount) : '-'}</td>
                    <td className="table-td px-5 py-4 align-top text-xs text-slate-500">{row.basisDate || '-'}</td>
                  </tr>
                )
              })}
              {(!data || data.cases.length === 0) && (
                <tr>
                  <td colSpan={8} className="table-td px-5 py-10 text-center text-slate-400">No cases found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function BarangayTab({ data, onDrilldown }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="portal-kicker">Coverage</p>
          <h3 className="mt-1 text-base font-semibold text-slate-800">Barangay distribution</h3>
        </div>
        <span className="text-xs text-slate-400">Click a row to open the matching cases</span>
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
              <th className="table-th px-5 py-4 text-right">Plain</th>
              <th className="table-th px-5 py-4 text-right">Total Cases</th>
              <th className="table-th px-5 py-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.rows.map((row, index) => (
              <tr
                key={`${row.barangay}-${row.municipality}`}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => onDrilldown(row)}
              >
                <td className="table-td px-5 py-4 text-xs text-slate-400">{index + 1}</td>
                <td className="table-td px-5 py-4 font-medium text-slate-800">{row.barangay}</td>
                <td className="table-td px-5 py-4 text-xs text-slate-500">{row.municipality}</td>
                <td className="table-td px-5 py-4 text-right">{row.medicine}</td>
                <td className="table-td px-5 py-4 text-right">{row.medical}</td>
                <td className="table-td px-5 py-4 text-right">{row.hospital}</td>
                <td className="table-td px-5 py-4 text-right">{row.burial}</td>
                <td className="table-td px-5 py-4 text-right">{row.eyeglass}</td>
                <td className="table-td px-5 py-4 text-right">{row.plain}</td>
                <td className="table-td px-5 py-4 text-right font-bold">{row.total}</td>
                <td className="table-td px-5 py-4 text-right font-mono text-sm">{peso(row.amount)}</td>
              </tr>
            ))}
            {(!data || data.rows.length === 0) && (
              <tr>
                <td colSpan={11} className="table-td px-5 py-10 text-center text-slate-400">No data.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OperationsTab({ data }) {
  if (!data) return <div className="py-16 text-center text-sm text-slate-400">No operations data.</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: 'Approved Cases', value: data.throughput.approvedCount, sub: data.basisLabel },
          { label: 'Released Cases', value: data.throughput.releasedCount, sub: data.basisLabel },
          { label: 'Pending Cases', value: data.throughput.pendingCount, sub: 'current status in cohort' },
        ].map((item) => (
          <div key={item.label} className="card text-center">
            <p className="text-2xl font-bold text-brand-dark">{item.value}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{item.label}</p>
            <p className="mt-1 text-[11px] text-slate-400">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="card">
          <p className="form-section-title mb-4">Turnaround Time</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average Days to Approval</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.turnaround.approvalAverageDays ?? '-'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average Days to Release</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.turnaround.releaseAverageDays ?? '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="form-section-title mb-4">Current Backlog by Stage</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-left text-xs font-semibold text-slate-500">Stage</th>
                <th className="pb-2 text-right text-xs font-semibold text-slate-500">Cases</th>
                <th className="pb-2 text-right text-xs font-semibold text-slate-500">Avg Days</th>
                <th className="pb-2 text-right text-xs font-semibold text-slate-500">Max Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.backlog.map((row) => (
                <tr key={row.status}>
                  <td className="py-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[row.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium">{row.count}</td>
                  <td className="py-2 text-right">{row.avgDays}</td>
                  <td className="py-2 text-right">{row.maxDays}</td>
                </tr>
              ))}
              {data.backlog.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-slate-400">No pending backlog in the selected cohort.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <p className="form-section-title mb-4">Staff Workload</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="pb-2 text-left text-xs font-semibold text-slate-500">Social Worker</th>
              <th className="pb-2 text-right text-xs font-semibold text-slate-500">Cases</th>
              <th className="pb-2 text-right text-xs font-semibold text-slate-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.workerLoad.slice(0, 10).map((row) => (
              <tr key={row.worker}>
                <td className="py-2 text-slate-800">{row.worker}</td>
                <td className="py-2 text-right font-medium">{row.cases}</td>
                <td className="py-2 text-right">{peso(row.amount)}</td>
              </tr>
            ))}
            {data.workerLoad.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-xs text-slate-400">No assigned workload for this cohort.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GuaranteeLettersTab({ data }) {
  const [search, setSearch] = useState('')
  if (!data) return <div className="py-8 text-center text-sm text-slate-400">Loading...</div>

  const typeLabels = { burial: 'Burial', hospital: 'Hospital', medical: 'Medical' }
  const typeColors = { burial: 'bg-slate-100 text-slate-600', hospital: 'bg-violet-100 text-violet-700', medical: 'bg-blue-100 text-blue-700' }
  const searchTerm = search.trim().toLowerCase()

  const filteredItems = !searchTerm
    ? data.items
    : data.items.filter((item) => {
      const typeLabel = typeLabels[item.assistanceType] ?? item.assistanceType ?? ''
      return [item.caseNumber ?? '', item.clientName ?? '', typeLabel].join(' ').toLowerCase().includes(searchTerm)
    })

  const signed = filteredItems.filter((item) => item.signedGlUrl).length
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
                <td className="table-td px-5 py-4 font-mono text-xs">
                  <Link to={`/cases/${item.id}/reports`} className="text-brand-green hover:underline">
                    {item.caseNumber ?? '-'}
                  </Link>
                </td>
                <td className="table-td px-5 py-4 font-medium text-slate-800">{item.clientName}</td>
                <td className="table-td px-5 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[item.assistanceType] ?? 'bg-slate-100 text-slate-600'}`}>
                    {typeLabels[item.assistanceType] ?? item.assistanceType}
                  </span>
                </td>
                <td className="table-td px-5 py-4 text-right font-mono text-sm">{item.amount > 0 ? peso(item.amount) : '-'}</td>
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
                  {item.glUploadedAt ? dayjs(item.glUploadedAt).format('MMM D, YYYY') : '-'}
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
  const [basis, setBasis] = useState('created')
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [to, setTo] = useState(dayjs().endOf('month').format('YYYY-MM-DD'))
  const [caseFilters, setCaseFilters] = useState({ type: '', status: '', barangay: '', municipality: '' })
  const [casePage, setCasePage] = useState(1)

  const [summary, setSummary] = useState(null)
  const [cases, setCases] = useState(null)
  const [barangay, setBarangay] = useState(null)
  const [operations, setOperations] = useState(null)
  const [glData, setGlData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const params = `from=${from}&to=${to}&basis=${basis}`
        const [summaryRes, casesRes, barangayRes, operationsRes, glRes] = await Promise.all([
          api.get(`/reports/summary?${params}`),
          api.get(`/reports/cases?${params}&type=${encodeURIComponent(caseFilters.type)}&status=${encodeURIComponent(caseFilters.status)}&barangay=${encodeURIComponent(caseFilters.barangay)}&municipality=${encodeURIComponent(caseFilters.municipality)}&page=${casePage}&limit=${CASES_PAGE_LIMIT}`),
          api.get(`/reports/barangay?${params}`),
          api.get(`/reports/operations?${params}`),
          api.get(`/reports/guarantee-letters?${params}`),
        ])
        if (!active) return
        setSummary(summaryRes.data)
        setCases(casesRes.data)
        setBarangay(barangayRes.data)
        setOperations(operationsRes.data)
        setGlData(glRes.data)
      } catch {
        if (active) toast.error('Failed to load report data')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [from, to, basis, caseFilters, casePage])

  const totalCasePages = Math.max(1, Math.ceil((cases?.total ?? 0) / CASES_PAGE_LIMIT))

  const handlePeriodChange = (nextFrom, nextTo) => {
    setLoading(true)
    setFrom(nextFrom)
    setTo(nextTo)
    setCasePage(1)
  }

  const handleBasisChange = (nextBasis) => {
    setLoading(true)
    setBasis(nextBasis)
    setCasePage(1)
  }

  const handleCasesFilterChange = (nextFilters) => {
    setLoading(true)
    setCaseFilters(nextFilters)
    setCasePage(1)
  }

  const handleResetFilters = () => {
    handleCasesFilterChange({ type: '', status: '', barangay: '', municipality: '' })
  }

  const openCaseDrilldown = (nextFilters) => {
    setTab('cases')
    setLoading(true)
    setCaseFilters((current) => ({ ...current, ...nextFilters }))
    setCasePage(1)
  }

  const handleExportSummaryDocx = async () => {
    try {
      await downloadApiFile(
        `/reports/summary/docx?from=${from}&to=${to}&basis=${basis}`,
        `executive-summary-${basis}-${from}_to_${to}.docx`,
      )
    } catch {
      toast.error('Failed to export the executive summary')
    }
  }

  const handleExportCurrentCsv = async () => {
    const baseParams = `from=${from}&to=${to}&basis=${basis}`
    const endpoints = {
      summary: `/reports/summary/csv?${baseParams}`,
      cases: `/reports/cases/csv?${baseParams}&type=${encodeURIComponent(caseFilters.type)}&status=${encodeURIComponent(caseFilters.status)}&barangay=${encodeURIComponent(caseFilters.barangay)}&municipality=${encodeURIComponent(caseFilters.municipality)}`,
      barangay: `/reports/barangay/csv?${baseParams}`,
      operations: `/reports/operations/csv?${baseParams}`,
      'guarantee-letters': `/reports/guarantee-letters/csv?${baseParams}`,
    }
    try {
      await downloadApiFile(endpoints[tab], `report-${tab}-${basis}-${from}_to_${to}.csv`)
    } catch {
      toast.error('Failed to export the current report')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="portal-kicker">AICS</p>
          <h1 className="portal-page-title">Reports</h1>
          <p className="portal-page-subtitle max-w-3xl">
            Generate executive, operational, geographic, and guarantee-letter reports with drill-down access to real case records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportSummaryDocx} className="portal-button-secondary flex items-center gap-2">
            <DownloadIcon className="h-4 w-4" />
            Executive Summary (.docx)
          </button>
          <button onClick={handleExportCurrentCsv} className="portal-button-secondary flex items-center gap-2">
            <DownloadIcon className="h-4 w-4" />
            Current View (.csv)
          </button>
        </div>
      </div>

      <div className="card">
        <div className="space-y-5">
          <div>
            <p className="portal-kicker">Report Controls</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-800">Select the coverage window and business date basis</h2>
          </div>
          <PeriodPicker
            from={from}
            to={to}
            basis={basis}
            onChange={handlePeriodChange}
            onBasisChange={handleBasisChange}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
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
        <div className="py-12 text-center text-sm text-slate-400">Loading report...</div>
      )}

      {!loading && (
        <>
          {tab === 'summary' && (
            <SummaryTab
              data={summary}
              onTypeDrilldown={(type) => openCaseDrilldown({ type, status: '', barangay: '', municipality: '' })}
              onStatusDrilldown={(status) => openCaseDrilldown({ status, type: '', barangay: '', municipality: '' })}
            />
          )}
          {tab === 'cases' && (
            <CasesTab
              data={cases}
              filters={caseFilters}
              basisLabel={cases?.basisLabel ?? 'Report Date'}
              onFilterChange={handleCasesFilterChange}
              onResetFilters={handleResetFilters}
              page={casePage}
              totalPages={totalCasePages}
              onPageChange={(nextPage) => {
                setLoading(true)
                setCasePage(nextPage)
              }}
            />
          )}
          {tab === 'barangay' && (
            <BarangayTab
              data={barangay}
              onDrilldown={(row) => openCaseDrilldown({ barangay: row.barangay, municipality: row.municipality, type: '', status: '' })}
            />
          )}
          {tab === 'operations' && <OperationsTab data={operations} />}
          {tab === 'guarantee-letters' && <GuaranteeLettersTab data={glData} />}
        </>
      )}
    </div>
  )
}
