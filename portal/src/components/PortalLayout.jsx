import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import logo from '../assets/logo.png'
import api from '../lib/api'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { to: '/apply', label: 'Apply', icon: FileTextIcon },
  { to: '/applications', label: 'My Applications', icon: FolderIcon },
  { to: '/profile', label: 'Profile', icon: UserIcon },
]

function MenuIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 7.5h16" />
      <path d="M4 12h16" />
      <path d="M4 16.5h16" />
    </svg>
  )
}

function HomeIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  )
}

function FileTextIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  )
}

function FolderIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H10l2 2h7.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
    </svg>
  )
}

function UserIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 20a6 6 0 0 0-12 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  )
}

function BellIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6.5 9.5a5.5 5.5 0 1 1 11 0c0 5.5 2 6.5 2 6.5h-15s2-1 2-6.5" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  )
}

function LogoutIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}

export default function PortalLayout() {
  const { applicant, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    const loadNotificationCount = async () => {
      try {
        const res = await api.get('/applications/notifications')
        setNotificationCount(res.data.unreadCount || 0)
      } catch {
        setNotificationCount(0)
      }
    }

    loadNotificationCount()
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleNavClick = () => {
    setMobileMenuOpen(false)
  }

  const bellButton = (
    <Link
      to="/notifications"
      onClick={handleNavClick}
      className="relative inline-flex h-12 w-12 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
      aria-label="View notifications"
    >
      <BellIcon className="h-5 w-5" />
      {notificationCount > 0 ? (
        <span className="absolute right-1.5 top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
          {notificationCount > 9 ? '9+' : notificationCount}
        </span>
      ) : null}
    </Link>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-300 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-[#064e3b] via-[#065f46] to-[#047857] text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
            <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
              <img src={logo} alt="Vigan City Seal" className="h-10 w-10 shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-emerald-100/80">Vigan AICS Applicant Portal</p>
                <p className="truncate font-display text-lg font-bold text-white">City Government of Vigan</p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              {bellButton}
              <div className="hidden text-right lg:block">
                <p className="text-sm font-medium text-white">{applicant?.firstName} {applicant?.lastName}</p>
                <p className="text-xs text-emerald-100/80">Applicant Account</p>
              </div>
              <button
                onClick={handleLogout}
                className="hidden items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 lg:inline-flex"
              >
                Sign out
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 lg:hidden"
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle navigation menu"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="hidden border-t border-slate-300 bg-white lg:block">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:px-8 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to || (item.to === '/applications' && location.pathname.startsWith('/applications/'))
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={handleNavClick}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-100 hover:text-emerald-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <p className="text-sm text-slate-500">Manage your account, file AICS assistance requests, and track your application status online.</p>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-slate-300 bg-white lg:hidden">
            <div className="px-4 py-6">
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to || (item.to === '/applications' && location.pathname.startsWith('/applications/'))
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={handleNavClick}
                      className={`flex items-center gap-3 rounded-md px-3 py-3 text-base transition-colors ${
                        isActive ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-slate-700'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0 text-slate-500" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-base text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <LogoutIcon className="h-5 w-5 shrink-0 text-slate-500" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-7xl p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
