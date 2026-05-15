import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { PORTAL_SESSION_EXPIRED_EVENT } from './lib/session'
import { isApplicantProfileComplete } from './lib/profileCompletion'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyOtpPage from './pages/VerifyOtpPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import ApplyPage from './pages/ApplyPage'
import ApplicationsPage from './pages/ApplicationsPage'
import ApplicationDetailPage from './pages/ApplicationDetailPage'
import NotificationsPage from './pages/NotificationsPage'
import PortalLayout from './components/PortalLayout'

function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  const applicant = useAuthStore((s) => s.applicant)
  const location = useLocation()

  if (!token) return <Navigate to="/login" replace />
  if (!isApplicantProfileComplete(applicant) && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace state={{ profileCompletionRequired: true, redirectTo: location.pathname }} />
  }

  return children
}

function PublicRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  const applicant = useAuthStore((s) => s.applicant)
  return !token ? children : <Navigate to={isApplicantProfileComplete(applicant) ? '/dashboard' : '/profile'} replace />
}

function SessionExpiryListener() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    const handleSessionExpired = () => {
      logout()
      toast.error('Your session has expired. Please sign in again.')
      navigate('/login', { replace: true, state: { sessionExpired: true } })
    }

    window.addEventListener(PORTAL_SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(PORTAL_SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [logout, navigate])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <SessionExpiryListener />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/overview" element={<LandingPage />} />
        <Route path="/how-it-works" element={<LandingPage />} />
        <Route path="/typesofassistance" element={<LandingPage />} />
        <Route path="/faq" element={<LandingPage />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/verify" element={<VerifyOtpPage />} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<ProtectedRoute><PortalLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="apply" element={<ApplyPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="applications/:id" element={<ApplicationDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
