import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/shared/ProtectedRoute'
import LoginPage from './pages/Auth/LoginPage'
import Dashboard from './pages/Dashboard'
import CaseList from './pages/Cases/CaseList'
import NewCase from './pages/Cases/NewCase'
import CaseDetailLayout from './pages/Cases/CaseDetail/CaseDetailLayout'
import TabClientProfile from './pages/Cases/CaseDetail/TabClientProfile'
import TabCaseStudy from './pages/Cases/CaseDetail/TabCaseStudy'
import TabReports from './pages/Cases/CaseDetail/TabReports'
import ClientList from './pages/Clients/ClientList'
import ClientForm from './pages/Clients/ClientForm'
import ClientProfile from './pages/Clients/ClientProfile'
import MedicineDatabase from './pages/Medicines/MedicineDatabase'
import HospitalDatabase from './pages/Hospitals/HospitalDatabase'
import FuneralHomeDatabase from './pages/FuneralHomes/FuneralHomeDatabase'
import SettingsPage from './pages/Settings/SettingsPage'
import ReportsPage from './pages/Reports/ReportsPage'
import PortalApplicationsPage from './pages/PortalApplications/PortalApplicationsPage'
import DocumentVerifierPage from './pages/Documents/DocumentVerifierPage'
import { useAuthStore } from './store/authStore'

function HomeRedirect() {
  const user = useAuthStore((state) => state.user)
  return <Navigate to={user?.role === 'city_health_office' ? '/medicines' : '/dashboard'} replace />
}

function PlaceholderPage({ title }) {
  return (
    <div className="card">
      <p className="portal-kicker">Coming Soon</p>
      <h1 className="portal-page-title">{title}</h1>
      <p className="portal-page-subtitle">This module is not implemented yet.</p>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />

          <Route element={<ProtectedRoute roles={['admin', 'employee']} redirectTo="/medicines" />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/cases" element={<CaseList />} />
            <Route path="/cases/new" element={<NewCase />} />
            <Route path="/cases/:id" element={<CaseDetailLayout />}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<TabClientProfile />} />
              <Route path="case-study" element={<TabCaseStudy />} />
              <Route path="reports" element={<TabReports />} />
              <Route path="report" element={<Navigate to="../reports" replace />} />
            </Route>
            <Route path="/clients" element={<ClientList />} />
            <Route path="/clients/new" element={<ClientForm />} />
            <Route path="/clients/:id" element={<ClientProfile />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/portal-applications" element={<PortalApplicationsPage />} />
            <Route path="/documents/verify" element={<DocumentVerifierPage />} />

            <Route element={<ProtectedRoute roles={['admin']} redirectTo="/dashboard" />}>
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['admin', 'employee', 'city_health_office']} redirectTo="/medicines" />}>
            <Route path="/medicines" element={<MedicineDatabase />} />
            <Route path="/hospitals" element={<HospitalDatabase />} />
            <Route path="/funeral-homes" element={<FuneralHomeDatabase />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const initAuth = useAuthStore((state) => state.initAuth)

  useEffect(() => {
    initAuth()
  }, [initAuth])

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <AppRoutes />
    </BrowserRouter>
  )
}
