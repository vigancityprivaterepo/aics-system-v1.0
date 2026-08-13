import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/shared/ProtectedRoute'
import LoginPage from './pages/Auth/LoginPage'
import Dashboard from './pages/Dashboard'
import CaseList from './pages/Cases/CaseList'
import MyQueue from './pages/Cases/MyQueue'
import NewCase from './pages/Cases/NewCase'
import CaseDetailLayout from './pages/Cases/CaseDetail/CaseDetailLayout'
import TabClientProfile from './pages/Cases/CaseDetail/TabClientProfile'
import TabCaseStudy from './pages/Cases/CaseDetail/TabCaseStudy'
import TabCaseEdit from './pages/Cases/CaseDetail/TabCaseEdit'
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
import VehicleRequestsPage from './pages/VehicleRequests/VehicleRequestsPage'
import { useAuthStore } from './store/authStore'
import { firstAccessiblePath } from './utils/moduleAccess'

function HomeRedirect() {
  const user = useAuthStore((state) => state.user)
  return <Navigate to={firstAccessiblePath(user)} replace />
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

          <Route element={<ProtectedRoute moduleKey="dashboard" redirectTo="/" />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          <Route element={<ProtectedRoute moduleKey="clients" redirectTo="/" />}>
            <Route path="/clients" element={<ClientList />} />
            <Route path="/clients/new" element={<ClientForm />} />
            <Route path="/clients/:id" element={<ClientProfile />} />
          </Route>

          <Route element={<ProtectedRoute moduleKey="reports" redirectTo="/" />}>
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute moduleKey="portal_applications" redirectTo="/" />}>
            <Route path="/portal-applications" element={<PortalApplicationsPage />} />
          </Route>

          <Route element={<ProtectedRoute moduleKey="documents_verify" redirectTo="/" />}>
            <Route path="/documents/verify" element={<DocumentVerifierPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} moduleKey="settings" redirectTo="/" />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route element={<ProtectedRoute moduleKey="cases" redirectTo="/" />}>
            <Route path="/my-queue" element={<MyQueue />} />
            <Route path="/cases" element={<CaseList />} />
            <Route path="/cases/new" element={<NewCase />} />
            <Route path="/cases/:id" element={<CaseDetailLayout />}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<TabClientProfile />} />
              <Route path="case-study" element={<TabCaseStudy />} />
              <Route path="case-edit" element={<TabCaseEdit />} />
              <Route path="reports" element={<TabReports />} />
              <Route path="report" element={<Navigate to="../reports" replace />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute moduleKey="medicines" redirectTo="/" />}>
            <Route path="/medicines" element={<MedicineDatabase />} />
          </Route>

          <Route element={<ProtectedRoute moduleKey="vehicle_requests" redirectTo="/" />}>
            <Route path="/vehicle-requests" element={<VehicleRequestsPage />} />
          </Route>

          <Route element={<ProtectedRoute moduleKey="hospitals" redirectTo="/" />}>
            <Route path="/hospitals" element={<HospitalDatabase />} />
          </Route>

          <Route element={<ProtectedRoute moduleKey="funeral_homes" redirectTo="/" />}>
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
