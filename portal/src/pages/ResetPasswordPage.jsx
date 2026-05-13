import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import logo from '../assets/logo.png'
import { useAuthStore } from '../store/authStore'

function getPasswordStrength(value) {
  if (!value) return 0
  let score = 0
  if (value.length >= 8) score++
  if (/[A-Z]/.test(value)) score++
  if (/[0-9]/.test(value)) score++
  if (/[^A-Za-z0-9]/.test(value)) score++
  return Math.max(score, 1)
}

const STRENGTH_LABELS = ['', 'Weak - add uppercase letters or numbers', 'Fair - add a number or symbol', 'Good - add a special character', 'Strong password']
const STRENGTH_SEG_COLOR = ['', 'bg-red-400', 'bg-orange-400', 'bg-green-500', 'bg-[#0c2340]']
const STRENGTH_TEXT_COLOR = ['', 'text-red-500', 'text-orange-500', 'text-green-600', 'text-[#0c2340]']

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const email = params.get('email') || ''
  const token = params.get('token') || ''
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ newPassword: '', confirm: '' })

  useEffect(() => {
    if (email && token) {
      logout()
    }
  }, [email, token, logout])

  const passwordStrength = getPasswordStrength(form.newPassword)

  const fieldErrors = useMemo(() => {
    const nextErrors = {}
    if (!form.newPassword) nextErrors.newPassword = 'Password is required.'
    else if (form.newPassword.length < 8) nextErrors.newPassword = 'Password must be at least 8 characters.'
    if (!form.confirm) nextErrors.confirm = 'Please confirm your password.'
    else if (form.newPassword !== form.confirm) nextErrors.confirm = 'Passwords do not match.'
    return nextErrors
  }, [form])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (Object.keys(fieldErrors).length > 0) {
      toast.error(Object.values(fieldErrors)[0])
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { email, token, newPassword: form.newPassword })
      logout()
      toast.success('Password reset successfully. Please sign in.')
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (!email || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-600">Invalid or expired reset link.</p>
          <Link to="/forgot-password" className="mt-5 inline-flex rounded-lg bg-[#0c4a3a] px-5 py-3 text-sm font-semibold text-white">
            Request new link
          </Link>
        </div>
      </div>
    )
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-300/80">Vigan AICS Applicant Portal</p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-white">City Government of Vigan</h1>
            <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-300">Province of Ilocos Sur</p>
          </div>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-slate-300/80">
            Set a new password to restore secure access to your applicant portal account.
          </p>
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
            <h2 className="font-display text-3xl font-bold text-[#0c2340]">Set New Password</h2>
            <p className="mt-2 text-sm text-slate-500">Create a new password for {email}.</p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">New Password</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#0c2340] placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                  required
                  value={form.newPassword}
                  onChange={(e) => setForm((state) => ({ ...state, newPassword: e.target.value }))}
                  placeholder="Minimum 8 characters"
                />
                {!fieldErrors.newPassword && form.newPassword ? (
                  <>
                    <div className="mt-2 flex gap-1">
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className={`h-[3px] flex-1 rounded-sm transition-colors duration-300 ${index < passwordStrength ? STRENGTH_SEG_COLOR[passwordStrength] : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <p className={`mt-1 text-[11px] ${STRENGTH_TEXT_COLOR[passwordStrength]}`}>{STRENGTH_LABELS[passwordStrength]}</p>
                  </>
                ) : fieldErrors.newPassword ? (
                  <p className="mt-1.5 text-xs text-red-600">{fieldErrors.newPassword}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">Confirm Password</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#0c2340] placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                  required
                  value={form.confirm}
                  onChange={(e) => setForm((state) => ({ ...state, confirm: e.target.value }))}
                  placeholder="Re-enter new password"
                />
                {fieldErrors.confirm && <p className="mt-1.5 text-xs text-red-600">{fieldErrors.confirm}</p>}
              </div>

              <button type="submit" disabled={loading} className="flex w-full items-center justify-center rounded-lg bg-[#0c4a3a] py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#064e3b] disabled:bg-slate-300 disabled:text-slate-500">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              <Link to="/login" className="font-semibold text-[#059669] transition-colors hover:text-[#0c2340]">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
