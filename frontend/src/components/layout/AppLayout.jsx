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
  ClipboardIcon, QrCodeIcon,
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
      className="px-3 pt-5 pb-1.5 text-[10px] font-semibold text-white/35 select-none tracking-wide"
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
        `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none
        focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          isActive
            ? 'bg-white/10 text-white border-l-2 border-white'
            : 'text-white/60 hover:bg-white/8 hover:text-white/90 border-l-2 border-transparent'
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
        `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none
        focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          isActive
            ? 'bg-white/10 text-white border-l-2 border-white'
            : 'text-white/60 hover:bg-white/8 hover:text-white/90 border-l-2 border-transparent'
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
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                  outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 border-l-2 ${
                  isActive
                    ? 'bg-white/10 text-white border-white'
                    : 'text-white/60 hover:bg-white/8 hover:text-white/90 border-transparent'
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
          <NavItem to="/medicines" Icon={PillIcon} label="Medicines" onClick={closeSidebar} />
          <NavItem to="/hospitals" Icon={HospitalIcon} label="Hospitals" onClick={closeSidebar} />
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
        <NavItem to="/medicines" Icon={PillIcon}     label="Medicines"      onClick={closeSidebar} />
        <NavItem to="/hospitals"     Icon={HospitalIcon}  label="Hospitals"      onClick={closeSidebar} />
        <NavItem to="/funeral-homes" Icon={HeadstonIcon}  label="Funeral Homes"  onClick={closeSidebar} />
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
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col
          bg-[#064e3b]
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 shrink-0">
          <img src={logo} alt="AICS Logo" className="h-9 w-9 shrink-0 rounded-full object-contain" />
          <div className="min-w-0">
            <p className="text-[10px] text-emerald-300/80 leading-tight">
              Republic of the Philippines
            </p>
            <p className="font-display text-sm font-bold text-white leading-tight truncate">
              Vigan — AICS
            </p>
            <p className="text-[10px] text-white/40 leading-tight truncate">
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
        <div className="shrink-0 border-t border-white/10 px-4 py-4 space-y-2">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full rounded-md px-3 py-2.5 hover:bg-white/10 transition-colors
              outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <div className="flex items-center gap-2.5">
              {user?.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user?.name || 'User'}
                  className="h-10 w-10 rounded-full border border-white/20 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const sibling = e.currentTarget.nextElementSibling
                    if (sibling) sibling.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={`${user?.photoUrl ? 'hidden' : ''} h-10 w-10 rounded-full border border-white/20 bg-white/10 text-white text-xs font-bold flex items-center justify-center`}>
                {initials}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-medium text-emerald-300/80">{roleLabel}</p>
                <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-white/40 mt-0.5">View profile</p>
              </div>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg border border-white/15 bg-white/5
              px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/15 hover:text-white
              outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <LogoutIcon className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <MyProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col md:ml-60">

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200
          bg-white px-4 py-3 shadow-sm md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Open navigation menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src={logo} alt="AICS Logo" className="h-4 w-4 object-contain" />
            <span className="font-display text-sm font-bold text-emerald-800">AICS CMS</span>
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
