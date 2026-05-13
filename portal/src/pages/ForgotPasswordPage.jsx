import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import logo from '../assets/logo.png'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
      toast.success('Reset link sent if that email is registered.')
    } catch {
      toast.error('Something went wrong. Please try again.')
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-300/80">Vigan AICS Applicant Portal</p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-white">City Government of Vigan</h1>
            <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-300">Province of Ilocos Sur</p>
          </div>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-slate-300/80">
            Recover your applicant account securely and regain access to your portal credentials.
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
            <h2 className="font-display text-3xl font-bold text-[#0c2340]">Forgot Password</h2>
            <p className="mt-2 text-sm text-slate-500">Enter your email address and we will send a password reset link.</p>

            {sent ? (
              <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                If <strong>{email}</strong> is registered, a password reset link has been sent. Check your inbox.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">Email Address</label>
                  <input
                    type="email"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#0c2340] placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <button type="submit" disabled={loading} className="flex w-full items-center justify-center rounded-lg bg-[#0c4a3a] py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#064e3b] disabled:bg-slate-300 disabled:text-slate-500">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            )}

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
