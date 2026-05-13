import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import logo from '../assets/logo.png'
import { isApplicantProfileComplete } from '../lib/profileCompletion'

const PORTAL_VERIFY_EMAIL_KEY = 'portal-verify-email'

export default function VerifyOtpPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const inputRefs = useRef([])

  const email = location.state?.email || searchParams.get('email') || sessionStorage.getItem(PORTAL_VERIFY_EMAIL_KEY) || ''
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!email) {
      navigate('/register', { replace: true })
      return
    }

    sessionStorage.setItem(PORTAL_VERIFY_EMAIL_KEY, email)
    inputRefs.current[0]?.focus()
  }, [email, navigate])

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return
    const next = [...digits]
    next[index] = value
    setDigits(next)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus()
  }

  const handlePaste = (event) => {
    const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setDigits(text.split(''))
      inputRefs.current[5]?.focus()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const otp = digits.join('')
    if (otp.length < 6) {
      toast.error('Enter the full 6-digit code')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/verify-otp', { email, otp })
      sessionStorage.removeItem(PORTAL_VERIFY_EMAIL_KEY)
      setAuth(res.data.token, res.data.applicant)
      toast.success('Email verified! Welcome to AICS Portal.')
      navigate(isApplicantProfileComplete(res.data.applicant) ? '/dashboard' : '/profile', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      const response = await api.post('/auth/resend-otp', { email })
      toast.success(response.data?.message || 'If the account still needs verification, a new code will be sent.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend code.')
    } finally {
      setResending(false)
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
            Complete your applicant registration by verifying the one-time code sent to your email address.
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
            <h2 className="font-display text-3xl font-bold text-[#0c2340]">Check Your Email</h2>
            <p className="mt-2 text-sm text-slate-500">We sent a 6-digit verification code to <strong>{email}</strong>.</p>

            <form onSubmit={handleSubmit} className="mt-8">
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      inputRefs.current[index] = element
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="h-14 w-11 rounded-lg border-2 border-slate-200 text-center text-xl font-bold text-slate-800 transition focus:border-[#10b981] focus:outline-none"
                  />
                ))}
              </div>

              <button type="submit" disabled={loading} className="mt-6 flex w-full items-center justify-center rounded-lg bg-[#0c4a3a] py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#064e3b] disabled:bg-slate-300 disabled:text-slate-500">
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-slate-500">
              Didn't receive the code?{' '}
              <button onClick={handleResend} disabled={resending} className="font-semibold text-[#059669] transition-colors hover:text-[#0c2340] disabled:opacity-50">
                {resending ? 'Sending...' : 'Resend'}
              </button>
            </p>

            <p className="mt-3 text-center text-sm text-slate-500">
              <Link to="/register" className="font-semibold text-[#059669] transition-colors hover:text-[#0c2340]">
                Back to register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
