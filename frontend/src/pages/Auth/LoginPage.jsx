import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import logo from '../../assets/logo.png'
import { firstAccessiblePath } from '../../utils/moduleAccess'

function FeatureItem({ icon, children }) {
  return (
    <li className="flex items-start gap-[11px]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-emerald-200">
        {icon}
      </span>
      <span className="text-[13px] leading-normal text-white/90">{children}</span>
    </li>
  )
}

export default function LoginPage() {
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(form.identifier, form.password)
    if (result.success) {
      toast.success('Welcome back!')
      navigate(firstAccessiblePath(result.user))
    } else {
      toast.error(result.message || 'Invalid credentials')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#e5e8ec]">
      {/* Header */}
      <header className="border-b border-[#065f46] bg-[#064e3b] text-white">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-6 py-3">
          <img src={logo} alt="City of Vigan seal" className="h-[38px] w-[38px] object-contain" />
          <div>
            <p className="text-[10.5px] tracking-[0.04em] text-emerald-200/85">Republic of the Philippines</p>
            <p className="font-display text-sm font-bold leading-tight">Vigan AICS Case Management System</p>
          </div>
        </div>
      </header>

      {/* Split card */}
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="grid w-full max-w-[1000px] grid-cols-1 overflow-hidden rounded-[20px] bg-white shadow-[0_18px_50px_rgba(6,78,59,0.16),0_2px_6px_rgba(15,45,82,0.06)] min-[940px]:grid-cols-[1.05fr_1fr]">

          {/* Brand panel */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#059669] p-10 text-white min-[940px]:flex">
            <div className="absolute -right-[70px] -top-[60px] h-[230px] w-[230px] rounded-full bg-white/[0.07]" aria-hidden="true" />
            <div className="absolute -bottom-[90px] right-5 h-[200px] w-[200px] rounded-full bg-emerald-400/[0.22]" aria-hidden="true" />

            <div className="relative">
              <img src={logo} alt="" className="h-[60px] w-[60px] object-contain" />
              <h2 className="mt-[22px] max-w-[20ch] font-display text-[25px] font-black leading-tight [text-wrap:pretty]">
                Assistance to Individuals in Crisis Situation
              </h2>
              <p className="mt-3 max-w-[34ch] text-[13.5px] leading-relaxed text-white/[0.78] [text-wrap:pretty]">
                City Social Welfare and Development Office — case intake, six-stage approval, and guarantee letter issuance in one system.
              </p>
            </div>

            <ul className="relative mt-8 flex flex-col gap-3.5">
              <FeatureItem icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5c2 1.6 4.4 2.3 6.5 2.6v5.4c0 4.3-2.6 7.5-6.5 9-3.9-1.5-6.5-4.7-6.5-9V6.1c2.1-.3 4.5-1 6.5-2.6Z" /><path d="m9.5 12.5 1.8 1.8 3.7-3.8" /></svg>
              }>
                Every approval and release is audit-logged
              </FeatureItem>
              <FeatureItem icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M15 14h1.5v1.5H18V14h2v3.5h-2V19H20v1h-3.5v-2H15v2h-1v-6Z" /></svg>
              }>
                QR-verifiable guarantee letters at the provider
              </FeatureItem>
              <FeatureItem icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><circle cx="8.5" cy="11" r="2" /><path d="M13 9.5h5" /><path d="M13 13h3" /><path d="M6.5 16.5h4" /></svg>
              }>
                RFID lookup pulls up a client in one tap
              </FeatureItem>
            </ul>

            <p className="relative mt-8 text-[11.5px] text-white/60">Protected under RA 10173 — Data Privacy Act of 2012</p>
          </div>

          {/* Sign-in form */}
          <div className="flex min-w-0 flex-col justify-center px-9 py-11">
            <span className="inline-flex items-center gap-[7px] self-start rounded-full bg-[#ecfdf5] px-[11px] py-[5px] text-[11px] font-bold uppercase tracking-[0.05em] text-[#047857]">
              Staff Sign-in
            </span>
            <h1 className="mt-4 font-display text-[26px] font-bold tracking-[-0.01em] text-[#0f2d52]">Sign in to AICS</h1>
            <p className="mt-1.5 text-[13.5px] text-gray-500">Use the account issued by the CSWDO administrator.</p>

            <form onSubmit={handleSubmit} className="mt-[26px] flex flex-col gap-4">
              <div>
                <label htmlFor="identifier" className="mb-[7px] block text-[13px] font-semibold text-slate-700">Username</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.5 19.5v-1.2a3.3 3.3 0 0 0-3.3-3.3h-2.4a3.3 3.3 0 0 0-3.3 3.3v1.2" /><circle cx="12" cy="9" r="3" /></svg>
                  </span>
                  <input
                    id="identifier"
                    type="text"
                    required
                    value={form.identifier}
                    onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                    autoComplete="username"
                    placeholder="Enter your username"
                    className="h-[50px] w-full rounded-xl border-2 border-slate-300 bg-white pl-[42px] pr-3.5 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-[#10b981] focus:outline-none focus:ring-4 focus:ring-emerald-500/[0.16]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-[7px] block text-[13px] font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="1.8" /><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" /></svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-[50px] w-full rounded-xl border-2 border-slate-300 bg-white pl-[42px] pr-[46px] text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-[#10b981] focus:outline-none focus:ring-4 focus:ring-emerald-500/[0.16]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[9px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12s3-7 9.5-7 9.5 7 9.5 7-3 7-9.5 7S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" /><path d="m4 20 16-16" /></svg>
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12s3-7 9.5-7 9.5 7 9.5 7-3 7-9.5 7S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <label className="inline-flex items-center gap-[9px] text-[13px] text-slate-600">
                <input type="checkbox" className="h-4 w-4 accent-[#059669]" />
                Keep me signed in on this workstation
              </label>

              <button
                type="submit"
                disabled={isLoading}
                id="btn-login"
                className="mt-1 inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-[#059669] bg-[#059669] text-[14.5px] font-bold text-white shadow-[0_6px_16px_rgba(5,150,105,0.28)] transition-colors hover:border-[#047857] hover:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-3.5 text-center text-[11.5px] text-slate-400">
        2026 City Government of Vigan &bull; City Management Information Systems Division &bull; AICS Program
      </footer>
    </div>
  )
}
