import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/api'
import logo from '../../assets/logo.png'
import {
  ChartIcon, UsersIcon, PillIcon, CogIcon,
  LogoutIcon, MenuIcon, DocumentIcon, FileTextIcon,
  CrossIcon, HospitalIcon, GlassesIcon, HeadstonIcon,
  ClipboardIcon, QrCodeIcon, DatabaseIcon, ChevronDownIcon,
} from '../ui/Icons'
import MyProfileModal from '../shared/MyProfileModal'

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

// ── Collapsible Cases group ───────────────────────────────────────────────────
function CasesGroup({ onNavigate, pendingByType = {} }) {
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
          {CASE_CHILDREN.map((child) => {
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
function SidebarNav({ closeSidebar, isAdmin, isCityHealthOffice, pendingByType, portalSubmittedCount }) {
  if (isCityHealthOffice) {
    return (
      <nav
        className="flex-1 overflow-y-auto px-3 pb-4"
        role="navigation"
        aria-label="Main navigation"
      >
        <SectionLabel>Health Office</SectionLabel>
        <div className="space-y-0.5">
          <DatabaseGroup onNavigate={closeSidebar} isCHO={true} />
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
        <NavItem to="/dashboard" Icon={ChartIcon} label="Dashboard" onClick={closeSidebar} end />
        <NavItemWithBadge
          to="/portal-applications"
          Icon={ClipboardIcon}
          label="Portal Applications"
          onClick={closeSidebar}
          badge={portalSubmittedCount}
        />
        <NavItem to="/documents/verify" Icon={QrCodeIcon} label="QR Verifier" onClick={closeSidebar} />
        <CasesGroup onNavigate={closeSidebar} pendingByType={pendingByType} />
      </div>

      {/* ── DATA ── */}
      <SectionLabel>Data</SectionLabel>
      <div className="space-y-0.5">
        <NavItem to="/clients"  Icon={UsersIcon}    label="Client Profile" onClick={closeSidebar} />
        <DatabaseGroup onNavigate={closeSidebar} />
        <NavItem to="/reports"       Icon={DocumentIcon}  label="Reports"        onClick={closeSidebar} />
        {isAdmin && (
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
  const [portalSubmittedCount, setPortalSubmittedCount] = useState(0)
  const isCityHealthOffice = user?.role === 'city_health_office'

  useEffect(() => {
    if (isCityHealthOffice || !user?.approvalLevel?.length) return
    api.get('/cases/pending-approvals-by-type')
      .then((res) => setPendingByType(res.data.byType ?? {}))
      .catch(() => {})
    api.get('/applicant-applications?status=submitted&page=1&limit=1')
      .then((res) => setPortalSubmittedCount(res.data.total || 0))
      .catch(() => {})
  }, [isCityHealthOffice, location.pathname, user?.approvalLevel?.length])

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
    <div className="flex min-h-screen bg-[#f6f7f9]">

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
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
          md:translate-x-0`}
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
      <div className="flex flex-1 flex-col md:ml-60">

        {/* Desktop sticky top bar */}
        <header className="sticky top-0 z-30 hidden md:flex items-center justify-between gap-4
          border-b border-slate-200 bg-white/95 backdrop-blur-sm px-6 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="font-semibold text-emerald-800">Vigan AICS</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600">Case Management System</span>
          </div>
          <div className="flex items-center gap-3">
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
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200
          bg-white px-4 py-3 shadow-sm md:hidden">
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
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
