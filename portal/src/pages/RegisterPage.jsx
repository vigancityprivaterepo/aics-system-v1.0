import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import logo from '../assets/logo.png'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const mobilePattern = /^(09|\+639)\d{9}$/

function getPasswordStrength(value) {
  if (!value) return 0
  let score = 0
  if (value.length >= 8) score++
  if (/[A-Z]/.test(value)) score++
  if (/[0-9]/.test(value)) score++
  if (/[^A-Za-z0-9]/.test(value)) score++
  return Math.max(score, 1)
}

const STRENGTH_LABELS = [
  '',
  'Weak - add uppercase letters or numbers',
  'Fair - add a number or symbol',
  'Good - add a special character',
  'Strong password',
]
const STRENGTH_SEG_COLOR = ['', 'bg-red-400', 'bg-orange-400', 'bg-green-500', 'bg-[#0c2340]']
const STRENGTH_TEXT_COLOR = ['', 'text-red-500', 'text-orange-500', 'text-green-600', 'text-[#0c2340]']

export default function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
  })
  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
    mobileNumber: false,
    password: false,
    confirmPassword: false,
  })

  const passwordStrength = getPasswordStrength(form.password)

  const fieldErrors = useMemo(() => {
    const nextErrors = {}
    if (!form.firstName.trim()) nextErrors.firstName = 'First name is required.'
    if (!form.lastName.trim()) nextErrors.lastName = 'Last name is required.'
    if (!form.email.trim()) nextErrors.email = 'Email address is required.'
    else if (!emailPattern.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.'
    if (form.mobileNumber.trim() && !mobilePattern.test(form.mobileNumber.trim().replace(/\s/g, ''))) {
      nextErrors.mobileNumber = 'Enter a valid Philippine mobile number.'
    }
    if (!form.password) nextErrors.password = 'Password is required.'
    else if (form.password.length < 8) nextErrors.password = 'Password must be at least 8 characters.'
    if (!form.confirmPassword) nextErrors.confirmPassword = 'Please confirm your password.'
    else if (form.confirmPassword !== form.password) nextErrors.confirmPassword = 'Passwords do not match.'
    return nextErrors
  }, [form])

  const canSubmit = Object.keys(fieldErrors).length === 0 && !loading

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (error) setError('')
  }

  const showError = (key) => (touched[key] ? fieldErrors[key] : '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      mobileNumber: true,
      password: true,
      confirmPassword: true,
    })
    if (Object.keys(fieldErrors).length > 0) return

    setLoading(true)
    try {
      const response = await api.post('/auth/register', {
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        mobileNumber: form.mobileNumber.trim() || undefined,
      })
      toast.success(response.data?.message || 'Check your email for the verification code.')
      navigate(`/verify?email=${encodeURIComponent(form.email.trim())}`, { state: { email: form.email.trim() } })
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
          <p className="mt-1 text-xs text-slate-400">Applicant Registration</p>
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

        <div className="flex flex-1 items-center justify-center overflow-y-auto px-8 py-10 sm:px-12">
          <div className="w-full max-w-md">
            <h2 className="font-display text-3xl font-bold text-[#0c2340]">Create Account</h2>
            <p className="mt-2 text-sm text-slate-500">Register to begin your AICS online application</p>

            {error && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="register-first-name" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    First Name
                  </label>
                  <input
                    id="register-first-name"
                    type="text"
                    autoComplete="given-name"
                    className={`w-full rounded-lg border bg-white px-4 py-3 text-sm text-[#0c2340] placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10b981] ${showError('firstName') ? 'border-red-400' : 'border-slate-300'}`}
                    placeholder="Juan"
                    value={form.firstName}
                    onChange={(e) => setField('firstName', e.target.value)}
                    onBlur={() => setTouched((current) => ({ ...current, firstName: true }))}
                    required
                  />
                  {showError('firstName') && <p className="mt-1.5 text-xs text-red-600">{showError('firstName')}</p>}
                </div>

                <div>
                  <label htmlFor="register-last-name" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    Last Name
                  </label>
                  <input
                    id="register-last-name"
                    type="text"
                    autoComplete="family-name"
                    className={`w-full rounded-lg border bg-white px-4 py-3 text-sm text-[#0c2340] placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10b981] ${showError('lastName') ? 'border-red-400' : 'border-slate-300'}`}
                    placeholder="dela Cruz"
                    value={form.lastName}
                    onChange={(e) => setField('lastName', e.target.value)}
                    onBlur={() => setTouched((current) => ({ ...current, lastName: true }))}
                    required
                  />
                  {showError('lastName') && <p className="mt-1.5 text-xs text-red-600">{showError('lastName')}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="register-email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Email Address
                </label>
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className={`w-full rounded-lg border bg-white px-4 py-3 text-sm text-[#0c2340] placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10b981] ${showError('email') ? 'border-red-400' : 'border-slate-300'}`}
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                  required
                />
                {showError('email') && <p className="mt-1.5 text-xs text-red-600">{showError('email')}</p>}
              </div>

              <div>
                <label htmlFor="register-mobile" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Mobile Number
                </label>
                <input
                  id="register-mobile"
                  type="tel"
                  autoComplete="tel"
                  className={`w-full rounded-lg border bg-white px-4 py-3 text-sm text-[#0c2340] placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10b981] ${showError('mobileNumber') ? 'border-red-400' : 'border-slate-300'}`}
                  placeholder="09XXXXXXXXX"
                  value={form.mobileNumber}
                  onChange={(e) => setField('mobileNumber', e.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, mobileNumber: true }))}
                />
                {showError('mobileNumber') && <p className="mt-1.5 text-xs text-red-600">{showError('mobileNumber')}</p>}
              </div>

              <div>
                <label htmlFor="register-password" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`w-full rounded-lg border bg-white px-4 py-3 pr-16 text-sm text-[#0c2340] placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10b981] ${showError('password') ? 'border-red-400' : 'border-slate-300'}`}
                    placeholder="Create a password"
                    value={form.password}
                    onChange={(e) => setField('password', e.target.value)}
                    onBlur={() => setTouched((current) => ({ ...current, password: true }))}
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
                {showError('password') ? (
                  <p className="mt-1.5 text-xs text-red-600">{showError('password')}</p>
                ) : form.password ? (
                  <>
                    <div className="mt-2 flex gap-1">
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className={`h-[3px] flex-1 rounded-sm transition-colors duration-300 ${index < passwordStrength ? STRENGTH_SEG_COLOR[passwordStrength] : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <p className={`mt-1 text-[11px] ${STRENGTH_TEXT_COLOR[passwordStrength]}`}>{STRENGTH_LABELS[passwordStrength]}</p>
                  </>
                ) : null}
              </div>

              <div>
                <label htmlFor="register-confirm-password" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="register-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`w-full rounded-lg border bg-white px-4 py-3 pr-16 text-sm text-[#0c2340] placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10b981] ${showError('confirmPassword') ? 'border-red-400' : 'border-slate-300'}`}
                    placeholder="Repeat your password"
                    value={form.confirmPassword}
                    onChange={(e) => setField('confirmPassword', e.target.value)}
                    onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((value) => !value)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-[#0c2340]"
                    aria-label={showConfirm ? 'Hide confirmed password' : 'Show confirmed password'}
                  >
                    {showConfirm ? (
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
                {showError('confirmPassword') && <p className="mt-1.5 text-xs text-red-600">{showError('confirmPassword')}</p>}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0c4a3a] py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#064e3b] hover:shadow-[0_4px_16px_rgba(6,78,59,0.30)] active:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#059669] transition-colors hover:text-[#0c2340]">
                Sign In
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


