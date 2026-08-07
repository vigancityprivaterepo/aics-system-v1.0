import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import api from '../lib/api'
import { formatDate } from '../lib/utils'
import StatusBadge from '../components/ui/StatusBadge'
import {
  FolderIcon,
  UsersIcon,
  PillIcon,
  CrossIcon,
  HospitalIcon,
  HeadstonIcon,
  GlassesIcon,
  FileTextIcon,
  PlusIcon,
  ArrowRightIcon,
  ClockIcon,
} from '../components/ui/Icons'

const TYPE_META = {
  medicine: {
    label: 'Medicine',
    Icon: PillIcon,
    statColor: 'text-brand-green',
    badgeClass: 'badge-green',
    chartColor: '#10b981',
    gradientId: 'dashboard-medicine',
  },
  medical: {
    label: 'Medical',
    Icon: CrossIcon,
    statColor: 'text-blue-600',
    badgeClass: 'badge-blue',
    chartColor: '#2563eb',
    gradientId: 'dashboard-medical',
  },
  hospital: {
    label: 'Hospital',
    Icon: HospitalIcon,
    statColor: 'text-violet-600',
    badgeClass: 'badge-blue',
    chartColor: '#7c3aed',
    gradientId: 'dashboard-hospital',
  },
  burial: {
    label: 'Burial',
    Icon: HeadstonIcon,
    statColor: 'text-slate-600',
    badgeClass: 'badge-slate',
    chartColor: '#475569',
    gradientId: 'dashboard-burial',
  },
  eyeglass: {
    label: 'Eyeglass',
    Icon: GlassesIcon,
    statColor: 'text-amber-600',
    badgeClass: 'badge-amber',
    chartColor: '#d97706',
    gradientId: 'dashboard-eyeglass',
  },
  plain: {
    label: 'Plain AICS',
    Icon: FileTextIcon,
    statColor: 'text-teal-600',
    badgeClass: 'badge-teal',
    chartColor: '#0d9488',
    gradientId: 'dashboard-plain',
  },
}

const DASHBOARD_TYPE_ORDER = ['medicine', 'medical', 'hospital', 'burial', 'eyeglass', 'plain']
const PRIMARY_TYPE_CARDS = ['medicine', 'medical', 'hospital', 'burial', 'plain']

const MOCK_STATS = {
  todayCases: 12,
  weekCases: 47,
  monthCases: 183,
  pendingRequirements: 14,
  totalClients: 1249,
  byType: { medicine: 127, medical: 36, hospital: 24, burial: 56, eyeglass: 9 },
  byStatus: {
    intake: 14,
    encoding: 12,
    for_review: 6,
    recommending_approval: 2,
    for_approval: 1,
    approved: 31,
    released: 112,
    rejected: 4,
  },
}

const MOCK_CHARTS = {
  monthly: [
    { month: 'Nov', medicine: 28, medical: 7, hospital: 4, burial: 11, eyeglass: 1 },
    { month: 'Dec', medicine: 31, medical: 8, hospital: 5, burial: 14, eyeglass: 2 },
    { month: 'Jan', medicine: 35, medical: 9, hospital: 6, burial: 12, eyeglass: 2 },
    { month: 'Feb', medicine: 29, medical: 6, hospital: 5, burial: 16, eyeglass: 1 },
    { month: 'Mar', medicine: 42, medical: 10, hospital: 7, burial: 18, eyeglass: 2 },
    { month: 'Apr', medicine: 22, medical: 5, hospital: 4, burial: 8, eyeglass: 1 },
  ],
  topBarangays: [
    { name: 'Poblacion', cases: 28 },
    { name: 'Barangay 1', cases: 21 },
    { name: 'Barangay 2', cases: 19 },
    { name: 'Tamag', cases: 17 },
    { name: 'Barangay 5', cases: 14 },
  ],
}

const MOCK_RECENT_CASES = [
  { id: '1', caseNumber: 'AICS-2026-04-000183', clientName: 'Santos, Maria', assistanceType: 'medicine', status: 'encoding', dateOfAssessment: '2026-04-19' },
  { id: '2', caseNumber: 'AICS-2026-04-000182', clientName: 'Reyes, Jose', assistanceType: 'burial', status: 'for_review', dateOfAssessment: '2026-04-19' },
  { id: '3', caseNumber: 'AICS-2026-04-000181', clientName: 'Cruz, Ana', assistanceType: 'medical', status: 'approved', dateOfAssessment: '2026-04-18' },
  { id: '4', caseNumber: 'AICS-2026-04-000180', clientName: 'Garcia, Pedro', assistanceType: 'hospital', status: 'released', dateOfAssessment: '2026-04-18' },
  { id: '5', caseNumber: 'AICS-2026-04-000179', clientName: 'Dela Cruz, Rosa', assistanceType: 'medicine', status: 'encoding', dateOfAssessment: '2026-04-17' },
  { id: '6', caseNumber: 'AICS-2026-04-000178', clientName: 'Bautista, Carlos', assistanceType: 'eyeglass', status: 'released', dateOfAssessment: '2026-04-17' },
]

function normalizeTypeCounts(byType) {
  if (!byType) {
    return Object.fromEntries(DASHBOARD_TYPE_ORDER.map((type) => [type, 0]))
  }

  if (Array.isArray(byType)) {
    return DASHBOARD_TYPE_ORDER.reduce((acc, type) => {
      const row = byType.find((entry) => entry?.type === type || entry?.assistanceType === type)
      acc[type] = Number(row?.count ?? row?._count?._all ?? 0)
      return acc
    }, {})
  }

  return DASHBOARD_TYPE_ORDER.reduce((acc, type) => {
    acc[type] = Number(byType[type] ?? 0)
    return acc
  }, {})
}

function normalizeMonthlyData(monthly) {
  const rows = (monthly || []).map((row) => {
    const normalized = { month: row?.month ?? '' }
    for (const type of DASHBOARD_TYPE_ORDER) {
      normalized[type] = Number(row?.[type] ?? 0)
    }
    return normalized
  })
  // Drop leading months where every type is zero
  const firstDataIdx = rows.findIndex((row) => DASHBOARD_TYPE_ORDER.some((t) => row[t] > 0))
  return firstDataIdx >= 0 ? rows.slice(firstDataIdx) : rows
}

function getTypeMeta(type) {
  return TYPE_META[type] ?? {
    label: type || 'Unknown',
    Icon: FolderIcon,
    statColor: 'text-slate-600',
    badgeClass: 'badge-slate',
    chartColor: '#64748b',
    gradientId: `dashboard-${type || 'unknown'}`,
  }
}

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

const PERIOD_KICKER = {
  day: 'Daily Trend',
  week: 'Weekly Trend',
  month: 'Monthly Trend',
  year: 'Yearly Trend',
}

const QUEUE_META = {
  needs_intake: { label: 'Needs Intake', query: 'queue=needs_intake', color: 'text-slate-700 bg-slate-50' },
  needs_encoding: { label: 'Needs Encoding', query: 'queue=needs_encoding', color: 'text-blue-700 bg-blue-50' },
  ready_for_review: { label: 'Ready for Review', query: 'queue=ready_for_review', color: 'text-amber-700 bg-amber-50' },
  waiting_for_recommender: { label: 'Waiting for Recommender', query: 'queue=waiting_for_recommender', color: 'text-indigo-700 bg-indigo-50' },
  waiting_for_approver: { label: 'Waiting for Approver', query: 'queue=waiting_for_approver', color: 'text-violet-700 bg-violet-50' },
  ready_for_release: { label: 'Ready for Release', query: 'queue=ready_for_release', color: 'text-emerald-700 bg-emerald-50' },
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [charts, setCharts] = useState(null)
  const [recentCases, setRecentCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [trendPeriod, setTrendPeriod] = useState('month')
  const [trendType, setTrendType] = useState('all')

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats'),
      api.get(`/dashboard/charts?period=${trendPeriod}`),
      api.get('/cases?limit=6&sort=created_at:desc'),
    ]).then(([s, c, r]) => {
      setStats(s.data)
      setCharts(c.data)
      setRecentCases(r.data.cases || [])
    }).catch(() => {
      setStats(MOCK_STATS)
      setCharts(MOCK_CHARTS)
      setRecentCases(MOCK_RECENT_CASES)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading) return
    api.get(`/dashboard/charts?period=${trendPeriod}`)
      .then((c) => setCharts(c.data))
      .catch(() => setCharts(MOCK_CHARTS))
  }, [trendPeriod])

  const typeCounts = useMemo(() => normalizeTypeCounts(stats?.byType), [stats])
  const monthlyTrend = useMemo(() => normalizeMonthlyData(charts?.monthly), [charts])
  const activeChartTypes = useMemo(
    () => {
      const availableTypes = DASHBOARD_TYPE_ORDER.filter((type) => monthlyTrend.some((row) => Number(row[type] ?? 0) > 0))
      if (trendType === 'all') return availableTypes
      return availableTypes.includes(trendType) ? [trendType] : []
    },
    [monthlyTrend, trendType]
  )
  const pendingReviewCount =
    (stats?.byStatus?.for_review ?? 0) +
    (stats?.byStatus?.recommending_approval ?? 0) +
    (stats?.byStatus?.for_approval ?? 0) +
    (stats?.byStatus?.encoding ?? 0)
  const queueCards = Object.entries(QUEUE_META).map(([key, meta]) => ({
    key,
    ...meta,
    count: Number(stats?.workflowQueues?.[key] ?? 0),
  }))

  const statCards = [
    { label: "Today's Cases", value: stats?.todayCases ?? '—', sub: 'Walk-ins today', Icon: FolderIcon, variant: 'stat-card-green' },
    { label: 'This Week', value: stats?.weekCases ?? '—', sub: 'Cases opened this week', Icon: ClockIcon, variant: 'stat-card-blue' },
    { label: 'This Month', value: stats?.monthCases ?? '—', sub: 'Total cases this month', Icon: FolderIcon, variant: 'stat-card-teal' },
    { label: 'Total Clients', value: stats?.totalClients ?? '—', sub: 'Registered in database', Icon: UsersIcon, variant: 'stat-card-violet' },
    ...PRIMARY_TYPE_CARDS.map((type) => {
      const meta = getTypeMeta(type)
      const variantMap = {
        medicine: 'stat-card-green',
        medical: 'stat-card-blue',
        hospital: 'stat-card-violet',
        burial: 'stat-card-slate',
        plain: 'stat-card-teal',
      }
      return {
        label: `${meta.label} Cases`,
        value: typeCounts[type] ?? '—',
        sub: 'Tracked this month',
        Icon: meta.Icon,
        variant: variantMap[type] || 'stat-card-slate',
      }
    }),
    {
      label: 'Pending Review',
      value: pendingReviewCount,
      sub: pendingReviewCount > 0 ? 'Needs attention now' : 'No pending cases',
      Icon: ClockIcon,
      variant: pendingReviewCount > 0 ? 'stat-card-red' : 'stat-card-slate',
      alert: pendingReviewCount > 0,
    },
    { label: 'Pending Intake', value: stats?.pendingRequirements ?? '—', sub: 'Awaiting case study start', Icon: FolderIcon, variant: 'stat-card-amber' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="portal-page-title">Dashboard</h1>
          <p className="portal-page-subtitle">Overview of assistance cases and client activity</p>
        </div>
        <Link to="/cases/new" className="portal-button-green" id="btn-new-case">
          <PlusIcon className="h-4 w-4" />
          New Case
        </Link>
      </div>

      {/* Stat cards — colourful icon blocks */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`stat-card ${s.variant}`}
          >
            <div className="stat-card-icon">
              <s.Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-slate-500 leading-tight">{s.label}</p>
                {s.alert ? <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-ping shrink-0" /> : null}
              </div>
              <p className="mt-1 text-xl font-display font-bold text-slate-800">{s.value}</p>
              <p className={`text-[10px] mt-0.5 ${s.alert ? 'text-red-500 font-medium' : 'text-slate-400'}`}>{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Queue cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {queueCards.map((queue) => (
          <Link
            key={queue.key}
            to={`/cases?${queue.query}`}
            className="queue-card group"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Operational Queue</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 group-hover:text-emerald-800 transition-colors">{queue.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Tap to open filtered list</p>
            </div>
            <div className={`rounded-xl px-3 py-2 text-right min-w-[4rem] ${queue.color}`}>
              <p className="text-2xl font-display font-bold leading-none">{queue.count}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide mt-0.5 opacity-70">cases</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-800">Cases by Type</h3>
              <p className="text-xs text-slate-400 mt-0.5">{PERIOD_KICKER[trendPeriod]}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <select
                value={trendType}
                onChange={(event) => setTrendType(event.target.value)}
                className="min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 outline-none transition focus:border-brand-primary"
              >
                <option value="all">All Types</option>
                {DASHBOARD_TYPE_ORDER.map((type) => {
                  const meta = getTypeMeta(type)
                  return (
                    <option key={type} value={type}>
                      {meta.label}
                    </option>
                  )
                })}
              </select>
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTrendPeriod(opt.value)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      trendPeriod === opt.value
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-slate-500">
                {activeChartTypes.map((type) => {
                  const meta = getTypeMeta(type)
                  return (
                    <span key={type} className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: meta.chartColor }} />
                      {meta.label}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="relative transition-opacity">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyTrend} barCategoryGap="20%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              />
              {activeChartTypes.map((type) => {
                const meta = getTypeMeta(type)
                return (
                  <Bar
                    key={type}
                    dataKey={type}
                    name={meta.label}
                    fill={meta.chartColor}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                  />
                )
              })}
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Top Barangays — pie chart */}
        <div className="card flex flex-col">
          <div className="mb-4">
            <h3 className="font-display text-base font-bold text-slate-800">Top Barangays</h3>
            <p className="text-xs text-slate-400 mt-0.5">Served this month</p>
          </div>

          {(() => {
            const data = charts?.topBarangays || []
            const total = data.reduce((sum, d) => sum + (d.cases || 0), 0)
            const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#64748b']

            if (data.length === 0) {
              return <p className="text-center text-xs text-slate-400 py-10">No data available</p>
            }

            const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
              if (percent < 0.07) return null
              const RADIAN = Math.PI / 180
              const radius = innerRadius + (outerRadius - innerRadius) * 0.55
              const x = cx + radius * Math.cos(-midAngle * RADIAN)
              const y = cy + radius * Math.sin(-midAngle * RADIAN)
              return (
                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
                  fontSize={11} fontWeight={700}>
                  {`${(percent * 100).toFixed(0)}%`}
                </text>
              )
            }

            return (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey="cases"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={48}
                      paddingAngle={2}
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {data.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value} case${value !== 1 ? 's' : ''}`, name]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Custom legend */}
                <div className="mt-3 space-y-1.5">
                  {data.map((entry, i) => {
                    const pct = total > 0 ? Math.round((entry.cases / total) * 100) : 0
                    return (
                      <div key={entry.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="text-xs text-slate-600 truncate">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-slate-800">{entry.cases}</span>
                          <span className="w-9 text-right text-[10px] text-slate-400">{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Recent Cases */}
      <div className="card">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-slate-800">Recent Cases</h3>
            <p className="text-xs text-slate-400 mt-0.5">Last 6 cases across all types</p>
          </div>
          <Link to="/cases" className="portal-button-secondary text-xs">
            View All <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto -mx-6">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="table-header text-left first:pl-6">Case Number</th>
                <th className="table-header text-left">Client</th>
                <th className="table-header text-left">Type</th>
                <th className="table-header text-left">Status</th>
                <th className="table-header text-left last:pr-6">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentCases.map((c) => {
                const meta = getTypeMeta(c.assistanceType)
                return (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell">
                      <Link to={`/cases/${c.id}`} className="font-mono text-xs font-semibold text-brand-primary hover:underline">
                        {c.caseNumber}
                      </Link>
                    </td>
                    <td className="table-cell font-medium">
                      {c.beneficiaryName || c.clientName}
                      {c.beneficiaryName && (
                        <p className="mt-0.5 text-xs font-normal text-slate-400">
                          Filed under {c.clientName}
                        </p>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="table-cell text-xs text-slate-400">{formatDate(c.dateOfAssessment)}</td>
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
