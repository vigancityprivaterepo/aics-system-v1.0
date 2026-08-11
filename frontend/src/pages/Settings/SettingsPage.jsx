import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import {
  UsersIcon, ClockIcon, IdCardIcon, ShieldCheckIcon, FileTextIcon, DatabaseIcon, FolderIcon, ChevronDownIcon,
} from '../../components/ui/Icons'
import ApplicantAccountsPage from '../Applicants/ApplicantAccountsPage'
import NarrativeOptionsSettings from './NarrativeOptionsSettings'
import UsersTab from './tabs/UsersTab'
import AuditTab from './tabs/AuditTab'
import CaseFormatTab from './tabs/CaseFormatTab'
import ModuleAccessTab from './tabs/ModuleAccessTab'
import BackupTab from './tabs/BackupTab'
import { normalizeModuleAccessConfig, DEFAULT_MODULE_ACCESS_CONFIG } from './settingsConstants'

const TABS = [
  { key: 'users',  label: 'User Access Control', description: 'Staff accounts and roles', icon: UsersIcon },
  { key: 'audit',  label: 'Audit Trail', description: 'Document and approval history', icon: ClockIcon },
  { key: 'format', label: 'Case Number Format', description: 'ID codes and approval chain', icon: IdCardIcon },
  { key: 'module-access', label: 'Module Access', description: 'Per-office and per-employee', icon: ShieldCheckIcon },
  { key: 'narratives', label: 'Narrative Options', description: 'Report wording presets', icon: FileTextIcon },
  { key: 'backup', label: 'Backup & Restore', description: 'Database and file snapshots', icon: DatabaseIcon },
  { key: 'applicants', label: 'Applicant Accounts', description: 'Public portal accounts', icon: FolderIcon },
]

const DEFAULT_FMT = {
  locationCode:   'VGN',
  agencyCode:     'AICS',
  clientPrefix:   'CID',
  medicinePrefix: 'MD',
  burialPrefix:   'BUR',
  hospitalPrefix: 'HOS',
  medicalPrefix:  'MED',
  eyeglassPrefix: 'EYE',
  plainPrefix:    'PLN',
  sequenceDigits: 3,
  clientStartSequence: 1,
  medicineStartSequence: 1,
  burialStartSequence: 1,
  hospitalStartSequence: 1,
  medicalStartSequence: 1,
  eyeglassStartSequence: 1,
  plainStartSequence: 1,
  reviewedByUserId:   null,
  recommendingUserId: null,
  approvedByUserId:   null,
  moduleAccessConfig: normalizeModuleAccessConfig(DEFAULT_MODULE_ACCESS_CONFIG),
}

export default function SettingsPage() {
  const { user: currentUser } = useAuthStore()
  const isAdmin = currentUser?.role === 'admin'

  const [activeTab, setActiveTab] = useState('users')
  const [fmt, setFmt] = useState(DEFAULT_FMT)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAdmin) return
    api.get('/settings').then(({ data }) => setFmt({
      locationCode:   data.locationCode   ?? 'VGN',
      agencyCode:     data.agencyCode     ?? 'AICS',
      clientPrefix:   data.clientPrefix   ?? 'CID',
      medicinePrefix: data.medicinePrefix ?? 'MD',
      burialPrefix:   data.burialPrefix   ?? 'BUR',
      hospitalPrefix: data.hospitalPrefix ?? 'HOS',
      medicalPrefix:  data.medicalPrefix  ?? 'MED',
      eyeglassPrefix: data.eyeglassPrefix ?? 'EYE',
      plainPrefix:    data.plainPrefix    ?? 'PLN',
      sequenceDigits: data.sequenceDigits ?? 3,
      clientStartSequence: data.clientStartSequence ?? 1,
      medicineStartSequence: data.medicineStartSequence ?? 1,
      burialStartSequence: data.burialStartSequence ?? 1,
      hospitalStartSequence: data.hospitalStartSequence ?? 1,
      medicalStartSequence: data.medicalStartSequence ?? 1,
      eyeglassStartSequence: data.eyeglassStartSequence ?? 1,
      plainStartSequence: data.plainStartSequence ?? 1,
      reviewedByUserId:   data.reviewedByUserId   ?? null,
      recommendingUserId: data.recommendingUserId ?? null,
      approvedByUserId:   data.approvedByUserId   ?? null,
      moduleAccessConfig: normalizeModuleAccessConfig(data.moduleAccessConfig),
    })).catch(() => {})
  }, [isAdmin])

  const mergeSettings = (data) => {
    setFmt((prev) => ({
      ...prev,
      locationCode:   data.locationCode   ?? prev.locationCode,
      agencyCode:     data.agencyCode     ?? prev.agencyCode,
      clientPrefix:   data.clientPrefix   ?? prev.clientPrefix,
      medicinePrefix: data.medicinePrefix ?? prev.medicinePrefix,
      burialPrefix:   data.burialPrefix   ?? prev.burialPrefix,
      hospitalPrefix: data.hospitalPrefix ?? prev.hospitalPrefix,
      medicalPrefix:  data.medicalPrefix  ?? prev.medicalPrefix,
      eyeglassPrefix: data.eyeglassPrefix ?? prev.eyeglassPrefix,
      plainPrefix:    data.plainPrefix    ?? prev.plainPrefix,
      sequenceDigits: data.sequenceDigits ?? prev.sequenceDigits,
      clientStartSequence: data.clientStartSequence ?? prev.clientStartSequence,
      medicineStartSequence: data.medicineStartSequence ?? prev.medicineStartSequence,
      burialStartSequence: data.burialStartSequence ?? prev.burialStartSequence,
      hospitalStartSequence: data.hospitalStartSequence ?? prev.hospitalStartSequence,
      medicalStartSequence: data.medicalStartSequence ?? prev.medicalStartSequence,
      eyeglassStartSequence: data.eyeglassStartSequence ?? prev.eyeglassStartSequence,
      plainStartSequence: data.plainStartSequence ?? prev.plainStartSequence,
      reviewedByUserId:   data.reviewedByUserId   ?? null,
      recommendingUserId: data.recommendingUserId ?? null,
      approvedByUserId:   data.approvedByUserId   ?? null,
      moduleAccessConfig: data.moduleAccessConfig ? normalizeModuleAccessConfig(data.moduleAccessConfig) : prev.moduleAccessConfig,
    }))
  }

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    ;(async () => {
      try {
        const { data } = await api.get('/users')
        if (active) setUsers(data.users || [])
      } catch {
        if (active) toast.error('Failed to load users')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="card max-w-lg">
        <p className="portal-kicker text-red-500">Access Restricted</p>
        <h1 className="portal-page-title">Settings</h1>
        <p className="portal-page-subtitle">Only administrators can access user management settings.</p>
      </div>
    )
  }

  const activeMeta = TABS.find((tab) => tab.key === activeTab) ?? TABS[0]
  const ActiveIcon = activeMeta.icon

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="mb-6">
        <p className="portal-kicker">Administration</p>
        <h1 className="portal-page-title">Settings</h1>
        <p className="portal-page-subtitle">Manage users, system configuration, and activity logs.</p>
      </div>

      {/* Section picker */}
      <div className="mb-6 max-w-md">
        <label className="portal-label" htmlFor="settings-section">Section</label>
        <div className="relative">
          <ActiveIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <select
            id="settings-section"
            className="portal-input appearance-none pl-11 pr-10 font-semibold text-slate-800"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
          >
            {TABS.map((tab) => (
              <option key={tab.key} value={tab.key}>{tab.label}</option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <p className="mt-1.5 text-xs text-slate-400">{activeMeta.description}</p>
      </div>

      {/* Active section */}
      <div className="min-w-0">
        {activeTab === 'users' && (
          <UsersTab users={users} setUsers={setUsers} loading={loading} currentUser={currentUser} />
        )}
        {activeTab === 'audit' && <AuditTab />}
        {activeTab === 'format' && (
          <CaseFormatTab fmt={fmt} setFmt={setFmt} mergeSettings={mergeSettings} users={users} />
        )}
        {activeTab === 'module-access' && (
          <ModuleAccessTab fmt={fmt} setFmt={setFmt} mergeSettings={mergeSettings} users={users} setUsers={setUsers} />
        )}
        {activeTab === 'narratives' && <NarrativeOptionsSettings />}
        {activeTab === 'backup' && <BackupTab />}
        {activeTab === 'applicants' && <ApplicantAccountsPage />}
      </div>
    </div>
  )
}
