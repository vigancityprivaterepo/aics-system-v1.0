import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import logo from '../assets/logo.png'
import api from '../lib/api'
import { isApplicantProfileComplete } from '../lib/profileCompletion'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const staffEmailPattern = /@aics\.dswd\.gov\.ph$/i

function getApiErrorMessage(err) {
  const data = err?.response?.data
  if (Array.isArray(data?.issues) && data.issues.length > 0) {
    return data.issues[0]?.message || data.message
  }
  return data?.message || 'Login failed'
}

export default function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  const [form, setForm] = useState({ email: '', password: '' })

  const fieldErrors = useMemo(() => {
    const nextErrors = {}
    if (!form.email.trim()) nextErrors.email = 'Email address is required.'
    else if (!emailPattern.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.'
    if (!form.password) nextErrors.password = 'Password is required.'
    else if (form.password.length < 8) nextErrors.password = 'Password must be at least 8 characters.'
    return nextErrors
  }, [form.email, form.password])

  const canSubmit = Object.keys(fieldErrors).length === 0 && !loading

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (error) setError('')
  }

  useEffect(() => {
    if (location.state?.sessionExpired) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (Object.keys(fieldErrors).length > 0) return

    setLoading(true)
    try {
      const normalizedEmail = form.email.trim().replace(/\.+$/, '')
      const res = await api.post('/auth/login', {
        email: normalizedEmail,
        password: form.password,
      })
      setAuth(res.data.token, res.data.applicant)
      toast.success(`Welcome back, ${res.data.applicant.firstName}!`)
      navigate(isApplicantProfileComplete(res.data.applicant) ? '/dashboard' : '/profile', { replace: true })
    } catch (err) {
      const normalizedEmail = form.email.trim().replace(/\.+$/, '')
      const message = getApiErrorMessage(err)
      if (err.response?.status === 403) {
        toast.error('Please verify your email first.')
        navigate(`/verify?email=${encodeURIComponent(normalizedEmail)}`, { state: { email: normalizedEmail } })
        return
      }
      if (staffEmailPattern.test(normalizedEmail)) {
        setError('This page is for applicant accounts only. Staff and admin users must sign in through the AICS staff portal using their username.')
        return
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const visibleEmailError = touched.email ? fieldErrors.email : ''
  const visiblePasswordError = touched.password ? fieldErrors.password : ''

  return (
    <div className="flex min-h-screen">
      <div
        className="relative hidden w-[42%] flex-col overflow-hidden lg:flex"
        style={{ background: 'linear-gradient(155deg, #064e3b 0%, #065f46 55%, #047857 100%)' }}
      >
        <div className="absolute -left-16 -top-16 h-72 w-52 rotate-12 rounded-full bg-white/5" />
        <div className="absolute -right-8 top-8 h-80 w-56 -rotate-6 rounded-full bg-white/5" />
        <div className="absolute left-1/4 top-1/3 h-48 w-36 rounded-full bg-white/4" />
        <div className="absolute -left-8 bottom-1/3 h-64 w-44 rotate-6 rounded-full bg-white/5" />
        <div className="absolute right-8 bottom-1/4 h-52 w-40 -rotate-12 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 left-1/3 h-56 w-44 rounded-full bg-white/4" />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-10 py-12 text-center">
          <img src={logo} alt="Vigan City Seal" className="h-28 w-28 object-contain drop-shadow-lg" />
          <div className="mt-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-300/80">
              Vigan AICS Applicant Portal
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-white">
              City Government of Vigan
            </h1>
            <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-300">
              Province of Ilocos Sur
            </p>
          </div>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-slate-300/80">
            A formal and accessible digital portal for residents applying for Assistance to Individuals in Crisis Situation.
          </p>
        </div>

        <div className="relative z-10 mx-6 mb-8 rounded-xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">AICS Office</p>
          <p className="mt-2 text-sm font-medium text-white">City Government of Vigan</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">City Hall, Vigan City, Ilocos Sur</p>
          <p className="mt-1 text-xs text-slate-400">Applicant Access Portal</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-[#064e3b] to-[#047857] px-5 py-3 lg:hidden">
          <img src={logo} alt="Seal" className="h-9 w-9 object-contain" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80">Vigan AICS Applicant Portal</p>
            <p className="text-sm font-bold text-white">City Government of Vigan</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-8 py-12 sm:px-12">
          <div className="w-full max-w-md">
            <h2 className="font-display text-3xl font-bold text-[#0c2340]">Welcome Back</h2>
            <p className="mt-2 text-sm text-slate-500">Sign in to your AICS applicant account</p>

            {error && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Email Address
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    className={`w-full rounded-lg border bg-white py-3 pl-10 pr-4 text-sm text-[#0c2340] placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10b981] ${visibleEmailError ? 'border-red-400' : 'border-slate-300'}`}
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                    aria-invalid={Boolean(visibleEmailError)}
                    required
                  />
                </div>
                {visibleEmailError && <p className="mt-1.5 text-xs text-red-600">{visibleEmailError}</p>}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="login-password" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-xs font-medium text-[#059669] transition-colors hover:text-[#0c2340]">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={`w-full rounded-lg border bg-white py-3 pl-10 pr-16 text-sm text-[#0c2340] placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10b981] ${visiblePasswordError ? 'border-red-400' : 'border-slate-300'}`}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setField('password', e.target.value)}
                    onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                    aria-invalid={Boolean(visiblePasswordError)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-[#0c2340]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {visiblePasswordError && <p className="mt-1.5 text-xs text-red-600">{visiblePasswordError}</p>}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0c4a3a] py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#064e3b] hover:shadow-[0_4px_16px_rgba(6,78,59,0.30)] active:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-[#059669] transition-colors hover:text-[#0c2340]">
                Register
              </Link>
            </p>
            </div>
        </div>

        <div className="border-t border-slate-100 px-8 py-4 text-center text-xs text-slate-400">
          (c) {new Date().getFullYear()} City Government of Vigan | By City Management Information Systems Division | AICS Program
        </div>
      </div>
    </div>
  )
}

