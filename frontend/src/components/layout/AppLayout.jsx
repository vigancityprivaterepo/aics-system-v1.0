import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Ambulance } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/api'
import logo from '../../assets/logo.png'
import {
  ChartIcon, UsersIcon, PillIcon, CogIcon,
  LogoutIcon, MenuIcon, DocumentIcon, FileTextIcon,
  CrossIcon, HospitalIcon, GlassesIcon, HeadstonIcon,
  ClipboardIcon, QrCodeIcon, DatabaseIcon, ChevronDownIcon,
  BellIcon,
} from '../ui/Icons'
import MyProfileModal from '../shared/MyProfileModal'
import { allowedCaseTypesForUser, canAccessAllCases } from '../../utils/accessRules'
import { canAccessModule } from '../../utils/moduleAccess'

// How often the notification bell's badge count re-checks for newly-queued cases
// while a staff member is sitting on some other page (the sidebar counts only
// refresh on navigation otherwise, so someone parked on one screen would never
// see new work land in their queue).
const PENDING_POLL_MS = 45000

// ── Case sub-types ────────────────────────────────────────────────────────────
const CASE_CHILDREN = [
  { label: 'Medicine',  type: 'medicine',  Icon: PillIcon,     available: true  },
  { label: 'Medical',   type: 'medical',   Icon: CrossIcon,    available: true  },
  { label: 'Hospital',  type: 'hospital',  Icon: HospitalIcon, available: true  },
  { label: 'Burial',    type: 'burial',    Icon: HeadstonIcon, available: true  },
  { label: 'Eyeglass',  type: 'eyeglass',  Icon: GlassesIcon,   available: true  },
  { label: 'Plain AICS', type: 'plain',   Icon: FileTextIcon,  available: true  },
]

// ── Section label (non-interactive header) ────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p
      aria-hidden="true"
      className="px-3 pt-6 pb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-white/30 select-none"
    >
      {children}
    </p>
  )
}

// ── Simple nav link ───────────────────────────────────────────────────────────
function NavItem({ to, Icon, label, onClick, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 min-h-[44px] text-sm font-medium transition-all duration-150 outline-none
        focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          isActive
            ? 'bg-emerald-400/15 text-white shadow-sm'
            : 'text-white/55 hover:bg-white/8 hover:text-white'
        }`
      }
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span>{label}</span>
    </NavLink>
  )
}

function NavItemWithBadge({ to, Icon, label, onClick, badge = 0, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 min-h-[44px] text-sm font-medium transition-all duration-150 outline-none
        focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          isActive
            ? 'bg-emerald-400/15 text-white shadow-sm'
            : 'text-white/55 hover:bg-white/8 hover:text-white'
        }`
      }
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span>{label}</span>
      {badge > 0 && (
        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}

// ── Header notification bell ───────────────────────────────────────────────────
// Lets a reviewer/recommender/approver see what's waiting on them without leaving
// whatever page they're on. `items` and `count` both come from the same polled
// /cases/pending-approvals-by-type response in AppLayout — that endpoint counts
// cases by workflow STATUS (anyone holding that approval role sees the same
// queue), which is the same model the Dashboard's operational-queue tiles use.
// It deliberately does NOT reuse `/cases?owner=me`: that filter matches a single
// fixed assignee configured in Settings, which isn't necessarily this user even
// when they hold the role — mixing the two produced a badge that said "1" while
// the panel said "all caught up".
const NOTIFICATION_QUEUE_LABEL = {
  ready_for_review: 'Ready for Review',
  waiting_for_recommender: 'Waiting for Recommender',
  waiting_for_approver: 'Waiting for Approver',
}
const QUEUE_BY_STATUS = {
  for_review: 'ready_for_review',
  recommending_approval: 'waiting_for_recommender',
  for_approval: 'waiting_for_approver',
}

function NotificationBell({ count, items, viewAllHref, canView }) {
  const navigate = useNavigate()
  const location = useLocation()
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  if (!canView) return null

  const typeLabel = (type) => CASE_CHILDREN.find((child) => child.type === type)?.label ?? type

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200
          bg-slate-50 text-slate-500 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700
          focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        title="Notifications"
        aria-label="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full
            border-2 border-white bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            {count > 0 && <span className="text-xs text-slate-400">{count} pending</span>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">You're all caught up — nothing pending on your queue.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { setOpen(false); navigate(`/cases/${c.id}`) }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-brand-primary">{c.caseNumber ?? '—'}</span>
                        <span className="badge badge-slate text-[10px]">{typeLabel(c.assistanceType)}</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-slate-700">{c.beneficiaryName || c.clientName}</p>
                      <p className="mt-0.5 text-xs text-amber-600">{NOTIFICATION_QUEUE_LABEL[c.queue] || 'Pending your action'}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); navigate(viewAllHref) }}
            className="block w-full border-t border-slate-100 px-4 py-2.5 text-center text-xs font-medium text-brand-green hover:bg-slate-50"
          >
            View all pending
          </button>
        </div>
      )}
    </div>
  )
}

// ── Collapsible Cases group ───────────────────────────────────────────────────
function CasesGroup({ onNavigate, pendingByType = {}, allowedTypes = null }) {
  const location = useLocation()
  const activeType = location.pathname === '/cases'
    ? new URLSearchParams(location.search).get('type')
    : null

  const isChildActive = (type) => activeType === type

  return (
    <div>
      {/* Section label — same style as Main / Data */}
      <SectionLabel>Cases</SectionLabel>

      {/* Children — always visible */}
      <div
        id="cases-submenu"
        role="group"
        aria-label="Case types"
      >
        <div className="mt-0.5 space-y-0.5">
          {CASE_CHILDREN.filter((child) => !allowedTypes || allowedTypes.includes(child.type)).map((child) => {
            const isActive = isChildActive(child.type)
            if (!child.available) {
              return (
                <span
                  key={child.type}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/25 cursor-not-allowed select-none"
                  title="Coming soon"
                >
                  <child.Icon className="h-4 w-4 shrink-0 text-white/20" />
                  {child.label}
                  <span className="ml-auto text-[9px] uppercase tracking-wide text-white/20">Soon</span>
                </span>
              )
            }
            return (
              <Link
                key={child.type}
                to={`/cases?type=${child.type}`}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150
                  outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  isActive
                    ? 'bg-emerald-400/15 text-white shadow-sm'
                    : 'text-white/55 hover:bg-white/8 hover:text-white'
                }`}
              >
                <child.Icon className="h-4 w-4 shrink-0" />
                {child.label}
                {(pendingByType[child.type] ?? 0) > 0 && (
                  <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {pendingByType[child.type] > 99 ? '99+' : pendingByType[child.type]}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DatabaseGroup({ onNavigate, isCHO = false }) {
  const location = useLocation()
  const databaseRoutes = isCHO
    ? ['/medicines']
    : ['/medicines', '/hospitals', '/funeral-homes']
  const isDatabaseRoute = databaseRoutes.includes(location.pathname)
  const [open, setOpen] = useState(isDatabaseRoute)

  useEffect(() => {
    if (isDatabaseRoute) {
      setOpen(true)
    }
  }, [isDatabaseRoute])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="database-submenu"
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 outline-none
          focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          isDatabaseRoute
            ? 'bg-emerald-400/15 text-white shadow-sm'
            : 'text-white/55 hover:bg-white/8 hover:text-white'
        }`}
      >
        <DatabaseIcon className="h-4 w-4 shrink-0" />
        <span>Database</span>
        <ChevronDownIcon className={`ml-auto h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div id="database-submenu" role="group" aria-label="Database modules" className="mt-1 space-y-0.5 overflow-hidden">
          <div className="space-y-0.5">
            <NavLink
              to="/medicines"
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg py-2 pr-3 pl-8 text-sm font-medium transition-all duration-150 outline-none
                focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  isActive
                    ? 'bg-emerald-400/15 text-white shadow-sm'
                    : 'text-white/55 hover:bg-white/8 hover:text-white'
                }`
              }
            >
              <PillIcon className="h-4 w-4 shrink-0" />
              <span>Medicines</span>
            </NavLink>
            {!isCHO && (
              <>
                <NavLink
                  to="/hospitals"
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg py-2 pr-3 pl-8 text-sm font-medium transition-all duration-150 outline-none
                    focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      isActive
                        ? 'bg-emerald-400/15 text-white shadow-sm'
                        : 'text-white/55 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <HospitalIcon className="h-4 w-4 shrink-0" />
                  <span>Hospitals</span>
                </NavLink>
                <NavLink
                  to="/funeral-homes"
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg py-2 pr-3 pl-8 text-sm font-medium transition-all duration-150 outline-none
                    focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      isActive
                        ? 'bg-emerald-400/15 text-white shadow-sm'
                        : 'text-white/55 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <HeadstonIcon className="h-4 w-4 shrink-0" />
                  <span>Funeral Homes</span>
                </NavLink>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sidebar content ───────────────────────────────────────────────────────────
function SidebarNav({ closeSidebar, user, isAdmin, isCityHealthOffice, pendingByType, portalSubmittedCount }) {
  const visibleCaseTypes = allowedCaseTypesForUser(user, CASE_CHILDREN.map((child) => child.type))
  const allowedCaseTypes = canAccessAllCases(user) ? null : visibleCaseTypes
  const canAccessDashboard = canAccessModule(user, 'dashboard')
  const canAccessPortalApplications = canAccessModule(user, 'portal_applications')
  const canAccessDocumentVerifier = canAccessModule(user, 'documents_verify')
  const canAccessVehicleRequests = canAccessModule(user, 'vehicle_requests')
  const canAccessCasesModule = canAccessModule(user, 'cases')
  const canAccessClients = canAccessModule(user, 'clients')
  const canAccessMedicines = canAccessModule(user, 'medicines')
  const canAccessHospitals = canAccessModule(user, 'hospitals')
  const canAccessFuneralHomes = canAccessModule(user, 'funeral_homes')
  const canAccessReports = canAccessModule(user, 'reports')
  const canAccessSettings = canAccessModule(user, 'settings')
  if (isCityHealthOffice) {
    return (
      <nav
        className="flex-1 overflow-y-auto px-3 pb-4"
        role="navigation"
        aria-label="Main navigation"
      >
        <SectionLabel>Health Office</SectionLabel>
        <div className="space-y-0.5">
          {canAccessVehicleRequests ? (
            <NavItem to="/vehicle-requests" Icon={Ambulance} label="Ambulance Requests" onClick={closeSidebar} />
          ) : null}
          {canAccessMedicines ? <DatabaseGroup onNavigate={closeSidebar} isCHO={true} /> : null}
        </div>
      </nav>
    )
  }

  return (
    <nav
      className="flex-1 overflow-y-auto px-3 pb-4"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* ── MAIN ── */}
      <SectionLabel>Main</SectionLabel>
      <div className="space-y-0.5">
        {canAccessDashboard ? <NavItem to="/dashboard" Icon={ChartIcon} label="Dashboard" onClick={closeSidebar} end /> : null}
        {canAccessPortalApplications ? (
          <NavItemWithBadge
            to="/portal-applications"
            Icon={ClipboardIcon}
            label="Portal Applications"
            onClick={closeSidebar}
            badge={portalSubmittedCount}
          />
        ) : null}
        {canAccessDocumentVerifier ? <NavItem to="/documents/verify" Icon={QrCodeIcon} label="QR Verifier" onClick={closeSidebar} /> : null}
        {canAccessVehicleRequests ? <NavItem to="/vehicle-requests" Icon={Ambulance} label="Vehicle Requests" onClick={closeSidebar} /> : null}
        {canAccessCasesModule ? <CasesGroup onNavigate={closeSidebar} pendingByType={pendingByType} allowedTypes={allowedCaseTypes} /> : null}
      </div>

      {/* ── DATA ── */}
      <SectionLabel>Data</SectionLabel>
      <div className="space-y-0.5">
        {canAccessClients ? <NavItem to="/clients" Icon={UsersIcon} label="Client Profile" onClick={closeSidebar} /> : null}
        {(canAccessMedicines || canAccessHospitals || canAccessFuneralHomes) ? <DatabaseGroup onNavigate={closeSidebar} /> : null}
        {canAccessReports ? <NavItem to="/reports" Icon={DocumentIcon} label="Reports" onClick={closeSidebar} /> : null}
        {isAdmin && canAccessSettings && (
          <NavItem to="/settings" Icon={CogIcon} label="Settings" onClick={closeSidebar} />
        )}
      </div>
    </nav>
  )
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function AppLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [pendingByType, setPendingByType] = useState({})
  const [pendingTotal, setPendingTotal] = useState(0)
  const [pendingRecentCases, setPendingRecentCases] = useState([])
  const [pendingStatuses, setPendingStatuses] = useState([])
  const [portalSubmittedCount, setPortalSubmittedCount] = useState(0)
  const isCityHealthOffice = user?.role === 'city_health_office'
  const canAccessCasesModule = canAccessModule(user, 'cases')
  const canAccessPortalApplications = canAccessModule(user, 'portal_applications')

  useEffect(() => {
    if (!canAccessCasesModule || isCityHealthOffice || !user?.approvalLevel?.length) {
      setPendingByType({})
      setPendingTotal(0)
      setPendingRecentCases([])
      setPendingStatuses([])
      return
    }
    let cancelled = false
    const fetchPending = () => {
      api.get('/cases/pending-approvals-by-type')
        .then((res) => {
          if (cancelled) return
          setPendingByType(res.data.byType ?? {})
          setPendingTotal(res.data.total ?? 0)
          setPendingRecentCases(res.data.recentCases ?? [])
          setPendingStatuses(res.data.pendingStatuses ?? [])
        })
        .catch(() => {})
    }
    fetchPending()
    const interval = setInterval(fetchPending, PENDING_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [canAccessCasesModule, isCityHealthOffice, location.pathname, user?.approvalLevel?.length])

  useEffect(() => {
    if (!canAccessPortalApplications || isCityHealthOffice) {
      setPortalSubmittedCount(0)
      return
    }
    api.get('/applicant-applications?status=submitted&page=1&limit=1')
      .then((res) => setPortalSubmittedCount(res.data.total || 0))
      .catch(() => {})
  }, [canAccessPortalApplications, isCityHealthOffice, location.pathname])

  const canViewNotifications = canAccessCasesModule && !isCityHealthOffice && !!user?.approvalLevel?.length
  // A user can hold more than one approval role at once (reviewer + recommender, say);
  // only route to a single filtered queue when there's exactly one in play, otherwise
  // send them to the unfiltered list rather than guessing which queue they meant.
  const pendingViewAllHref = pendingStatuses.length === 1
    ? `/cases?queue=${QUEUE_BY_STATUS[pendingStatuses[0]] ?? ''}`
    : '/cases'

  const handleLogout = () => {
    logout()
    navigate('/login')
    toast.success('Logged out successfully')
  }

  const roleLabel =
    user?.role === 'admin' ? 'Administrator'
    : user?.role === 'city_health_office' ? 'City Health Office'
    : 'Employee'

  const closeSidebar = () => setSidebarOpen(false)
  const initials = String(user?.name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U'

  return (
    <div className="flex min-h-screen min-w-0 overflow-x-hidden bg-[#f6f7f9]">

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-62 flex-col
          bg-[#053d2e]
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0`}
        style={{ width: '15rem' }}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-4 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
            <img src={logo} alt="AICS Logo" className="h-7 w-7 rounded-lg object-contain" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-[13px] font-bold text-white leading-tight truncate">
              Vigan AICS
            </p>
            <p className="text-[10px] text-emerald-400/70 leading-tight truncate">
              Case Management System
            </p>
          </div>
        </div>

        {/* Nav */}
        <SidebarNav
          closeSidebar={closeSidebar}
          user={user}
          isAdmin={user?.role === 'admin'}
          isCityHealthOffice={isCityHealthOffice}
          pendingByType={pendingByType}
          portalSubmittedCount={portalSubmittedCount}
        />

        {/* User + Logout */}
        <div className="shrink-0 px-3 py-3 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full rounded-xl px-3 py-2.5 hover:bg-white/8 transition-colors text-left
              outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <div className="flex items-center gap-2.5">
              {user?.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user?.name || 'User'}
                  className="h-9 w-9 rounded-full border-2 border-white/15 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const sibling = e.currentTarget.nextElementSibling
                    if (sibling) sibling.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={`${user?.photoUrl ? 'hidden' : ''} h-9 w-9 shrink-0 rounded-full border-2 border-emerald-500/30 bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center justify-center`}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-emerald-400/60 truncate">{roleLabel}</p>
              </div>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2
              text-xs text-white/50 transition-colors hover:bg-white/8 hover:text-white/80
              outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <LogoutIcon className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <MyProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-60">

        {/* Desktop sticky top bar */}
        <header className="sticky top-0 z-30 hidden min-w-0 lg:flex items-center justify-between gap-4
          border-b border-slate-200 bg-white/95 backdrop-blur-sm px-6 py-3 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-500">
            <span className="shrink-0 font-semibold text-emerald-800">Vigan AICS</span>
            <span className="text-slate-300">/</span>
            <span className="truncate text-slate-600">Case Management System</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <NotificationBell
              count={pendingTotal}
              items={pendingRecentCases}
              viewAllHref={pendingViewAllHref}
              canView={canViewNotifications}
            />
            <span className="text-xs text-slate-400">{new Date().toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
            <button
              onClick={() => setProfileOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 pl-2 pr-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">{initials}</span>
              {user?.name?.split(' ')[0] || 'User'}
            </button>
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex min-w-0 items-center gap-3 border-b border-slate-200
          bg-white px-4 py-3 shadow-sm lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2.5 text-slate-600 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open navigation menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src={logo} alt="AICS Logo" className="h-5 w-5 object-contain" />
            <span className="font-display text-sm font-bold text-emerald-800">Vigan AICS</span>
          </div>
          <div className="ml-auto">
            <NotificationBell
              count={pendingTotal}
              items={pendingRecentCases}
              viewAllHref={pendingViewAllHref}
              canView={canViewNotifications}
            />
          </div>
        </header>

        {/* Page content */}
        <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
