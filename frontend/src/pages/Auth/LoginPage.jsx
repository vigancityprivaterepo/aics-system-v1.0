import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import logo from '../../assets/logo.png'

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
      navigate(result.user?.role === 'city_health_office' ? '/medicines' : '/dashboard')
    } else {
      toast.error(result.message || 'Invalid credentials')
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      {/* Header */}
      <div className="bg-emerald-900 border-b border-emerald-800 text-white">
        <div className="mx-auto max-w-7xl px-6 py-3.5 flex items-center gap-3">
          <img src={logo} alt="AICS Logo" className="h-9 w-9 rounded-full object-contain" />
          <div>
            <p className="text-[10px] text-emerald-300/80">Republic of the Philippines</p>
            <p className="font-display text-sm font-bold text-white leading-tight">
              Vigan AICS Case Management System
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-md overflow-hidden">
            {/* Emerald accent top bar */}
            <div className="h-1 bg-emerald-600" />

            <div className="px-8 pt-7 pb-8">
              <div className="mb-6">
                <h1 className="font-display text-xl font-bold text-slate-800">Sign in to AICS</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Assistance to Individuals in Crisis Situation
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="identifier" className="portal-label">Username or Email</label>
                  <input
                    id="identifier"
                    type="text"
                    required
                    value={form.identifier}
                    onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                    className="portal-input"
                    placeholder="Enter your username or email"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="portal-label">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="portal-input pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="portal-button-green w-full py-2.5 text-sm mt-2"
                  id="btn-login"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            Protected under RA 10173 — Data Privacy Act of 2012
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white px-6 py-3.5 text-center text-xs text-slate-400">
        2026 City Government of Vigan &bull; City Management Information Systems Division &bull; AICS Program
      </div>
    </div>
  )
}
