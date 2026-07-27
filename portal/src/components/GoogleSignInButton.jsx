import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { isApplicantProfileComplete } from '../lib/profileCompletion'
import { useAuthStore } from '../store/authStore'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let googleScriptPromise

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (googleScriptPromise) return googleScriptPromise

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })

  return googleScriptPromise
}

export default function GoogleSignInButton({ text = 'signin_with', disabled = false }) {
  const buttonRef = useRef(null)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!GOOGLE_CLIENT_ID) {
      toast.error('Google sign-in is not configured.')
      return undefined
    }

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current) return

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            if (!response?.credential || disabled) return

            setLoading(true)
            try {
              const res = await api.post('/auth/google', { credential: response.credential })
              setAuth(res.data.token, res.data.applicant)
              toast.success(`Welcome, ${res.data.applicant.firstName}!`)
              navigate(isApplicantProfileComplete(res.data.applicant) ? '/dashboard' : '/profile', { replace: true })
            } catch (err) {
              toast.error(err.response?.data?.message || 'Google sign-in failed. Please try again.')
            } finally {
              setLoading(false)
            }
          },
        })

        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          width: buttonRef.current.offsetWidth || 384,
        })
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) toast.error('Unable to load Google sign-in. Check your internet connection.')
      })

    return () => {
      cancelled = true
    }
  }, [disabled, navigate, setAuth, text])

  return (
    <div className="relative">
      <div ref={buttonRef} className={disabled || loading ? 'pointer-events-none opacity-60' : ''} />
      {(!ready || loading) && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-500">
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#0c4a3a]" />
          {loading ? 'Signing in with Google...' : 'Loading Google...'}
        </div>
      )}
    </div>
  )
}