import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Ambulance } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/api'
import logo from '../../assets/logo.png'
import {
  ChartIcon, UsersIcon, PillIcon, CogIcon,
  LogoutIcon, DocumentIcon, FileTextIcon,
  CrossIcon, HospitalIcon, GlassesIcon, HeadstonIcon,
  ClipboardIcon, QrCodeIcon, DatabaseIcon, ChevronDownIcon,
  BellIcon, InboxIcon,
} from '../ui/Icons'
import MyProfileModal from '../shared/MyProfileModal'
import { allowedCaseTypesForUser, canAccessAllCases } from '../../utils/accessRules'
import { canAccessModule } from '../../utils/moduleAccess'

// How often the notification bell's badge count re-checks for newly-queued cases
// while a staff member is sitting on some other page (the top-bar counts only
// refresh on navigation otherwise, so someone parked on one screen would never
// see new work land in their queue).
const PENDING_POLL_MS = 45000

// ── Case sub-types ────────────────────────────────────────────────────────────
const CASE_CHILDREN = [
  { label: 'Medicine',  type: 'medicine',  Icon: PillIcon,     available: true  },
  { label: 'Medical',   type: 'medical',   Icon: CrossIcon,    available: true  },
  { label: 'Hospital',  type: 'hospital',  Icon: HospitalIcon, available: true  },
  { label: 'Burial',    type: 'burial',    Icon: HeadstonIcon, available: true  },
  { label: 'Eyeglass',  type: 'eyeglass',  Icon: GlassesIcon,  available: true  },
  { label: 'Plain AICS', type: 'plain',   Icon: FileTextIcon,  available: true  },
]

// ── Top-bar module tab styling (from the V.1.2 design) ────────────────────────
const TAB_BASE = 'inline-flex shrink-0 items-center gap-[6px] rounded-[8px] px-[9px] py-[7px] text-[12.5px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400'
const TAB_ACTIVE = 'bg-[#ecfdf5] text-[#065f46] font-semibold'
const TAB_IDLE = 'text-slate-600 font-medium hover:bg-slate-100 hover:text-[#0f2d52]'

function TabBadge({ count, tone = 'rose', pulse = false }) {
  if (!count) return null
  const bg = tone === 'red' ? 'bg-[#dc2626]' : tone === 'emerald' ? 'bg-[#059669]' : 'bg-[#f43f5e]'
  return (
    <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[10px] font-bold text-white ${bg} ${pulse ? 'animate-pulse' : ''}`}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

function ModuleTab({ to, Icon, label, badge = 0, badgeTone = 'rose', end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `${TAB_BASE} ${isActive ? TAB_ACTIVE : TAB_IDLE}`}
    >
      {Icon && <Icon className="h-[15px] w-[15px] shrink-0" />}
      {label}
      <TabBadge count={badge} tone={badgeTone} />
    </NavLink>
  )
}

// ── Dropdown module tab (Cases sub-types, Database) ───────────────────────────
// The panel uses fixed positioning anchored to the tab button rather than being
// an absolutely-positioned child, so it floats above the page instead of being
// clipped by an ancestor's layout.
function DropdownTab({ label, Icon, active, badge = 0, badgeTone = 'rose', badgePulse = false, items }) {
  const containerRef = useRef(null)
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState({ left: 0, top: 0 })

  const toggle = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setAnchor({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 232)), top: rect.bottom + 6 })
    }
    setOpen((v) => !v)
  }

  useEffect(() => { setOpen(false) }, [location.pathname, location.search])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    const handleEscape = (event) => { if (event.key === 'Escape') setOpen(false) }
    const handleScrollOrResize = () => setOpen(false)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('scroll', handleScrollOrResize, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    }
  }, [open])

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`${TAB_BASE} ${active ? TAB_ACTIVE : TAB_IDLE}`}
      >
        {Icon && <Icon className="h-[15px] w-[15px] shrink-0" />}
        {label}
        <TabBadge count={badge} tone={badgeTone} pulse={badgePulse} />
        <ChevronDownIcon className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="fixed z-40 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl"
          style={{ left: anchor.left, top: anchor.top }}
        >
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={item.title}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                item.active ? 'bg-[#ecfdf5] text-[#065f46]' : 'text-slate-600 hover:bg-slate-50 hover:text-[#0f2d52]'
              }`}
            >
              {item.Icon && <item.Icon className="h-4 w-4 shrink-0" />}
              {item.label}
              {(item.badge ?? 0) > 0 && (
                <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#f43f5e] px-[5px] text-[10px] font-bold text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
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
        className="relative inline-flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-slate-200
          bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#0f2d52]
          focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        title="Notifications"
        aria-label="Notifications"
      >
        <BellIcon className="h-[17px] w-[17px]" />
        {count > 0 && (
          <span className="absolute -right-[5px] -top-[5px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full
            border-2 border-white bg-[#dc2626] px-1 text-[10px] font-bold leading-none text-white">
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

// ── User chip with menu (profile / sign out) ──────────────────────────────────
function UserMenu({ user, roleLabel, initials, onProfile, onLogout }) {
  const containerRef = useRef(null)
  const location = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    const handleEscape = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-[10px] py-1 pl-1 pr-2 transition-colors hover:bg-slate-100
          outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        {user?.photoUrl ? (
          <img
            src={user.photoUrl}
            alt={user?.name || 'User'}
            className="h-[34px] w-[34px] rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const sibling = e.currentTarget.nextElementSibling
              if (sibling) sibling.classList.remove('hidden')
            }}
          />
        ) : null}
        <span className={`${user?.photoUrl ? 'hidden' : ''} inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#0f2d52] text-[12.5px] font-bold tracking-[0.02em] text-white`}>
          {initials}
        </span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="text-[13px] font-semibold text-slate-800">{user?.name || 'User'}</span>
          <span className="text-[11px] text-gray-500">{roleLabel}</span>
        </span>
        <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl">
          <div className="border-b border-slate-100 px-4 pb-2.5 pt-1.5 sm:hidden">
            <p className="truncate text-[13px] font-semibold text-slate-800">{user?.name || 'User'}</p>
            <p className="text-[11px] text-gray-500">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); onProfile() }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#0f2d52]"
          >
            <UsersIcon className="h-4 w-4 shrink-0" />
            My Profile
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onLogout() }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <LogoutIcon className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ── Module tabs (permission-aware) ────────────────────────────────────────────
function ModuleNav({ user, isAdmin, isCityHealthOffice, pendingByType, pendingStatuses = [], portalSubmittedCount, vehicleRequestsPendingCount }) {
  const location = useLocation()
  const visibleCaseTypes = allowedCaseTypesForUser(user, CASE_CHILDREN.map((child) => child.type))
  const allowedCaseTypes = canAccessAllCases(user) ? null : visibleCaseTypes
  const canAccess = (key) => canAccessModule(user, key)

  if (isCityHealthOffice) {
    return (
      <>
        {canAccess('vehicle_requests') && (
          <ModuleTab to="/vehicle-requests" Icon={Ambulance} label="Ambulance Requests" />
        )}
        {canAccess('medicines') && (
          <ModuleTab to="/medicines" Icon={PillIcon} label="Medicines" />
        )}
      </>
    )
  }

  const activeType = location.pathname === '/cases'
    ? new URLSearchParams(location.search).get('type')
    : null
  const casesActive = location.pathname.startsWith('/cases')
  // When this user holds exactly one approval role, a type with pending work links
  // straight to that queue (e.g. ?type=medicine&queue=ready_for_review) so a
  // reviewer/recommender/approver lands on only the cases awaiting their action
  // instead of scanning the full list. The Cases page's queue filter stays visible,
  // so clearing it to browse everything is one click.
  const pendingQueue = pendingStatuses.length === 1
    ? QUEUE_BY_STATUS[pendingStatuses[0]] ?? null
    : null
  const caseItems = [
    { to: '/cases', label: 'All Cases', Icon: FileTextIcon, active: casesActive && !activeType },
    ...CASE_CHILDREN
      .filter((child) => !allowedCaseTypes || allowedCaseTypes.includes(child.type))
      .map((child) => {
        const badge = pendingByType[child.type] ?? 0
        return {
          to: badge > 0 && pendingQueue
            ? `/cases?type=${child.type}&queue=${pendingQueue}`
            : `/cases?type=${child.type}`,
          label: child.label,
          Icon: child.Icon,
          active: activeType === child.type,
          badge,
          title: badge > 0 && pendingQueue
            ? `Open the ${badge} ${child.label.toLowerCase()} case${badge === 1 ? '' : 's'} pending your action`
            : undefined,
        }
      }),
  ]

  // Sum of the per-type badges shown inside the dropdown, so the tab total always
  // matches what the open menu displays.
  const casesPendingTotal = caseItems.reduce((sum, item) => sum + (item.badge ?? 0), 0)

  const databaseRoutes = ['/medicines', '/hospitals', '/funeral-homes']
  const databaseActive = databaseRoutes.includes(location.pathname)
  const databaseItems = [
    canAccess('medicines') && { to: '/medicines', label: 'Medicines', Icon: PillIcon, active: location.pathname === '/medicines' },
    canAccess('hospitals') && { to: '/hospitals', label: 'Hospitals', Icon: HospitalIcon, active: location.pathname === '/hospitals' },
    canAccess('funeral_homes') && { to: '/funeral-homes', label: 'Funeral Homes', Icon: HeadstonIcon, active: location.pathname === '/funeral-homes' },
  ].filter(Boolean)

  return (
    <>
      {canAccess('dashboard') && <ModuleTab to="/dashboard" Icon={ChartIcon} label="Dashboard" end />}
      {/* No badge here: pendingTotal counts role-based approval stages (what the bell
          shows), while the My Queue page lists owner=me cases — pinning the role count
          on this tab reads as "12 in my queue" when the queue can be empty. */}
      {canAccess('cases') && <ModuleTab to="/my-queue" Icon={InboxIcon} label="My Queue" />}
      {canAccess('cases') && (
        <DropdownTab label="Cases" Icon={FileTextIcon} active={casesActive} items={caseItems} badge={casesPendingTotal} badgeTone="red" badgePulse />
      )}
      {/* Clustered beside Cases on purpose: case makers hop between cases, vehicle
          requests, and client profiles constantly, so the three tabs sit together. */}
      {canAccess('vehicle_requests') && (
        <ModuleTab to="/vehicle-requests" Icon={Ambulance} label="Vehicle Requests" badge={vehicleRequestsPendingCount} />
      )}
      {canAccess('clients') && <ModuleTab to="/clients" Icon={UsersIcon} label="Client Profile" />}
      {canAccess('portal_applications') && (
        <ModuleTab to="/portal-applications" Icon={ClipboardIcon} label="Portal Applications" badge={portalSubmittedCount} />
      )}
      {canAccess('documents_verify') && <ModuleTab to="/documents/verify" Icon={QrCodeIcon} label="QR Verifier" />}
      {databaseItems.length > 0 && (
        <DropdownTab label="Database" Icon={DatabaseIcon} active={databaseActive} items={databaseItems} />
      )}
      {canAccess('reports') && <ModuleTab to="/reports" Icon={DocumentIcon} label="Reports" />}
      {isAdmin && canAccess('settings') && <ModuleTab to="/settings" Icon={CogIcon} label="Settings" />}
    </>
  )
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function AppLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [profileOpen, setProfileOpen] = useState(false)
  const [pendingByType, setPendingByType] = useState({})
  const [pendingTotal, setPendingTotal] = useState(0)
  const [pendingRecentCases, setPendingRecentCases] = useState([])
  const [pendingStatuses, setPendingStatuses] = useState([])
  const [portalSubmittedCount, setPortalSubmittedCount] = useState(0)
  const [vehicleRequestsPendingCount, setVehicleRequestsPendingCount] = useState(0)
  const isCityHealthOffice = user?.role === 'city_health_office'
  const canAccessCasesModule = canAccessModule(user, 'cases')
  const canAccessPortalApplications = canAccessModule(user, 'portal_applications')
  const canAccessVehicleRequests = canAccessModule(user, 'vehicle_requests')

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

  useEffect(() => {
    // Only administrative employees approve incoming ambulance requests, so the
    // badge is only meaningful (and only fetched) for that non-CHO branch.
    if (!canAccessVehicleRequests || isCityHealthOffice) {
      setVehicleRequestsPendingCount(0)
      return
    }
    api.get('/vehicle-requests/pending-count')
      .then((res) => setVehicleRequestsPendingCount(res.data.count || 0))
      .catch(() => {})
  }, [canAccessVehicleRequests, isCityHealthOffice, location.pathname])

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

  const initials = String(user?.name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U'

  const showNewCase = canAccessCasesModule && !isCityHealthOffice

  return (
    // No overflow-x-hidden on this wrapper: an overflow clip here would become the
    // header's scroll container and break position:sticky. <main> guards width instead.
    <div className="min-h-screen min-w-0 bg-[#e5e8ec] pb-10">

      {/* ── Sticky top bar ── */}
      {/* Two stacked rows, like Tabler's reference header: brand + utility
          cluster on their own row, module nav on a second row underneath.
          The white bar itself is full-bleed, but its content sits in the
          same mx-auto max-w-[1560px] column as <main> below, so the brand
          mark and nav line up with the page content instead of hugging the
          viewport edges while the body content is centered. */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        {/* Row 1: brand + utility cluster */}
        <div className="mx-auto flex h-16 w-full max-w-[1560px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 py-1.5">
            <img src={logo} alt="City of Vigan seal" className="h-9 w-9 shrink-0 object-contain" />
            <span className="flex flex-col leading-tight">
              <span className="whitespace-nowrap font-display text-[15px] font-black tracking-[-0.01em] text-[#065f46]">Vigan AICS</span>
              <span className="whitespace-nowrap text-[10.5px] font-medium text-gray-500">Case Management System</span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            {showNewCase && (
              <button
                type="button"
                onClick={() => navigate('/cases/new')}
                className="inline-flex h-[38px] items-center gap-[7px] rounded-[10px] border border-[#10b981] bg-[#10b981] px-3.5
                  text-[13px] font-semibold text-white transition-colors hover:border-[#059669] hover:bg-[#059669]
                  outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                <span className="hidden sm:inline">New Case</span>
              </button>
            )}
            <NotificationBell
              count={pendingTotal}
              items={pendingRecentCases}
              viewAllHref={pendingViewAllHref}
              canView={canViewNotifications}
            />
            <div className="mx-0.5 h-8 w-px bg-slate-200" />
            <UserMenu
              user={user}
              roleLabel={roleLabel}
              initials={initials}
              onProfile={() => setProfileOpen(true)}
              onLogout={handleLogout}
            />
          </div>
        </div>

        {/* Row 2: module nav — justify-between spreads the tabs across the
            full row instead of clumping them on the left with dead space
            after the last one; the items wrap amongst themselves if there
            are too many for one line, but never scroll, so every module
            stays visible with no arrows needed. The City Health Office role
            only has two tabs, so justify-between would shove them to
            opposite corners of the row — keep those two clumped together
            on the left instead. */}
        <nav
          aria-label="Primary modules"
          className={`mx-auto flex w-full max-w-[1560px] flex-wrap items-center ${isCityHealthOffice ? 'justify-start' : 'justify-between'} gap-1 border-t border-slate-100 px-4 py-1.5 sm:px-6`}
        >
          <ModuleNav
            user={user}
            isAdmin={user?.role === 'admin'}
            isCityHealthOffice={isCityHealthOffice}
            pendingByType={pendingByType}
            pendingStatuses={pendingStatuses}
            portalSubmittedCount={portalSubmittedCount}
            vehicleRequestsPendingCount={vehicleRequestsPendingCount}
          />
        </nav>
      </header>

      <MyProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* ── Page content ── */}
      <main className="mx-auto min-w-0 w-full max-w-[1560px] overflow-x-hidden px-4 py-5 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
