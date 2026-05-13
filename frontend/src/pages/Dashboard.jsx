import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
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

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [charts, setCharts] = useState(null)
  const [recentCases, setRecentCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [trendPeriod, setTrendPeriod] = useState('month')

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
    () => DASHBOARD_TYPE_ORDER.filter((type) => monthlyTrend.some((row) => Number(row[type] ?? 0) > 0)),
    [monthlyTrend]
  )
  const pendingReviewCount =
    (stats?.byStatus?.for_review ?? 0) +
    (stats?.byStatus?.recommending_approval ?? 0) +
    (stats?.byStatus?.for_approval ?? 0) +
    (stats?.byStatus?.encoding ?? 0)

  const statCards = [
    { label: "Today's Cases", value: stats?.todayCases ?? '—', sub: 'Walk-ins today', Icon: FolderIcon, color: 'text-brand-primary' },
    { label: 'This Week', value: stats?.weekCases ?? '—', sub: 'Cases opened', Icon: ClockIcon, color: 'text-brand-primary' },
    { label: 'This Month', value: stats?.monthCases ?? '—', sub: 'Total cases', Icon: FolderIcon, color: 'text-brand-primary' },
    { label: 'Total Clients', value: stats?.totalClients ?? '—', sub: 'In database', Icon: UsersIcon, color: 'text-brand-primary' },
    ...PRIMARY_TYPE_CARDS.map((type) => {
      const meta = getTypeMeta(type)
      return {
        label: `${meta.label} Cases`,
        value: typeCounts[type] ?? '—',
        sub: 'Tracked this month',
        Icon: meta.Icon,
        color: meta.statColor,
      }
    }),
    {
      label: 'Pending Review',
      value: pendingReviewCount,
      sub: pendingReviewCount > 0 ? 'Needs attention' : 'No pending review',
      Icon: ClockIcon,
      color: pendingReviewCount > 0 ? 'text-red-600' : 'text-brand-primary',
      alert: pendingReviewCount > 0,
    },
    { label: 'Pending Intake', value: stats?.pendingRequirements ?? '—', sub: 'Needs case study start', Icon: FolderIcon, color: 'text-red-500' },
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="portal-page-title">Dashboard</h1>
          <p className="portal-page-subtitle">Overview of assistance cases and client activity</p>
        </div>
        <Link to="/cases/new" className="portal-button-green" id="btn-new-case">
          <PlusIcon className="h-4 w-4" />
          New Case
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-5">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`card-sm transition-shadow hover:shadow-md flex items-start gap-3 ${
              s.alert ? 'border-red-200 bg-red-50/70 shadow-[0_0_0_1px_rgba(220,38,38,0.08)]' : ''
            }`}
          >
            <div className={`mt-0.5 rounded-md p-2 shrink-0 ${s.alert ? 'bg-red-100 text-red-600 animate-pulse' : `bg-slate-50 ${s.color}`}`}>
              <s.Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-xs font-medium ${s.alert ? 'text-red-700' : 'text-slate-500'}`}>{s.label}</p>
                {s.alert ? <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" /> : null}
              </div>
              <p className={`mt-0.5 text-xl font-display font-bold ${s.color}`}>{s.value}</p>
              <p className={`text-[11px] ${s.alert ? 'text-red-500 font-medium' : 'text-slate-400'}`}>{s.sub}</p>
            </div>
          </div>
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
            <AreaChart data={monthlyTrend}>
              <defs>
                {activeChartTypes.map((type) => {
                  const meta = getTypeMeta(type)
                  return (
                    <linearGradient key={meta.gradientId} id={meta.gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={meta.chartColor} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={meta.chartColor} stopOpacity={0} />
                    </linearGradient>
                  )
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              {activeChartTypes.map((type) => {
                const meta = getTypeMeta(type)
                return (
                  <Area
                    key={type}
                    type="monotone"
                    dataKey={type}
                    name={meta.label}
                    stroke={meta.chartColor}
                    fill={`url(#${meta.gradientId})`}
                    strokeWidth={2}
                  />
                )
              })}
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="font-display text-base font-semibold text-slate-800 mb-0.5">Top Barangays</h3>
          <p className="text-xs text-slate-400 mb-4">Served this month</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts?.topBarangays || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={68} />
              <Tooltip />
              <Bar dataKey="cases" radius={[0, 4, 4, 0]}>
                {(charts?.topBarangays || []).map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#10b981' : '#0c2340'} fillOpacity={1 - i * 0.12} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-800">Recent Cases</h3>
            <p className="text-xs text-slate-400 mt-0.5">Latest activity</p>
          </div>
          <Link to="/cases" className="portal-button-secondary text-xs">
            View All <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header rounded-tl-lg text-left">Case Number</th>
                <th className="table-header text-left">Client</th>
                <th className="table-header text-left">Type</th>
                <th className="table-header text-left">Status</th>
                <th className="table-header rounded-tr-lg text-left">Date</th>
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
                    <td className="table-cell font-medium">{c.clientName}</td>
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
