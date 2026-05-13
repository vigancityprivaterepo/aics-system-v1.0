import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/ui/Icons'
import ApplicantAccountsPage from '../Applicants/ApplicantAccountsPage'

const TABS = [
  { key: 'users',  label: 'User Access Control' },
  { key: 'audit',  label: 'Audit Trail' },
  { key: 'format', label: 'Case Number Format' },
  { key: 'applicants', label: 'Applicant Accounts' },
]

const ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'employee', label: 'Employee' },
  { value: 'city_health_office', label: 'City Health Office' },
]

const APPROVAL_LEVELS = [
  { value: 'preparer', label: 'Case Study Maker' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'recommender', label: 'Recommender' },
  { value: 'approver', label: 'Final Approver' },
]

const EMPTY_FORM = {
  name: '',
  username: '',
  role: 'employee',
  approvalLevels: [],
  signatureParam: '',
  position: '',
  password: '',
}
const AUDIT_PAGE_SIZE = 5

const roleLabel = (r) => ROLES.find((x) => x.value === r)?.label ?? r

const roleBadge = (role) => {
  const map = {
    admin: 'bg-purple-100 text-purple-700',
    employee: 'bg-emerald-100 text-emerald-700',
    city_health_office: 'bg-sky-100 text-sky-700',
  }
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[role] ?? 'bg-slate-100 text-slate-600'}`
}

const LEVEL_BADGE_COLOR = {
  preparer: 'bg-amber-100 text-amber-700',
  approver: 'bg-emerald-100 text-emerald-700',
  recommender: 'bg-indigo-100 text-indigo-700',
  reviewer: 'bg-violet-100 text-violet-700',
}

const formatAuditTime = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function SettingsPage() {
  const { user: currentUser } = useAuthStore()
  const isAdmin = currentUser?.role === 'admin'

  const [activeTab, setActiveTab] = useState('users')

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
    reviewedByUserId:   null,
    recommendingUserId: null,
    approvedByUserId:   null,
  }
  const [fmt, setFmt] = useState(DEFAULT_FMT)
  const [fmtSaving, setFmtSaving] = useState(false)
  const [uploadingSignatureUserId, setUploadingSignatureUserId] = useState(null)
  const [uploadingPhotoUserId, setUploadingPhotoUserId] = useState(null)

  const [users, setUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditSearchInput, setAuditSearchInput] = useState('')
  const [auditSearch, setAuditSearch] = useState('')
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)

  const [modal, setModal] = useState(null)
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

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
      reviewedByUserId:   data.reviewedByUserId   ?? null,
      recommendingUserId: data.recommendingUserId ?? null,
      approvedByUserId:   data.approvedByUserId   ?? null,
    })).catch(() => {})
  }, [isAdmin])

  const saveFmt = async (e) => {
    e.preventDefault()
    setFmtSaving(true)
    try {
      const { data } = await api.put('/settings', {
        ...fmt,
        sequenceDigits: Number(fmt.sequenceDigits),
        reviewedByUserId: fmt.reviewedByUserId || null,
        recommendingUserId: fmt.recommendingUserId || null,
        approvedByUserId: fmt.approvedByUserId || null,
      })
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
        reviewedByUserId:   data.reviewedByUserId   ?? null,
        recommendingUserId: data.recommendingUserId ?? null,
        approvedByUserId:   data.approvedByUserId   ?? null,
      }))
      toast.success('Case number format saved.')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save format.')
    } finally {
      setFmtSaving(false)
    }
  }

  const seq = String(1).padStart(Number(fmt.sequenceDigits) || 3, '0')
  const previewClient   = `${fmt.clientPrefix}-${fmt.locationCode}-${seq}`
  const previewMedicine = `${fmt.medicinePrefix}-${fmt.agencyCode}-${fmt.locationCode}-${seq}`
  const previewBurial   = `${fmt.burialPrefix}-${fmt.agencyCode}-${fmt.locationCode}-${seq}`
  const previewHospital = `${fmt.hospitalPrefix}-${fmt.agencyCode}-${fmt.locationCode}-${seq}`
  const previewMedical  = `${fmt.medicalPrefix}-${fmt.agencyCode}-${fmt.locationCode}-${seq}`
  const previewEyeglass = `${fmt.eyeglassPrefix}-${fmt.agencyCode}-${fmt.locationCode}-${seq}`
  const previewPlain    = `${fmt.plainPrefix}-${fmt.agencyCode}-${fmt.locationCode}-${seq}`

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

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    ;(async () => {
      try {
        const { data } = await api.get('/users/audit-trail', {
          params: {
            page: auditPage,
            limit: AUDIT_PAGE_SIZE,
            ...(auditSearch ? { search: auditSearch } : {}),
          },
        })
        if (!active) return
        setAuditLogs(data.logs || [])
        setAuditTotalPages(data.totalPages || 1)
        setAuditTotal(data.total || 0)
      } catch {
        if (active) toast.error('Failed to load audit trail')
      } finally {
        if (active) setAuditLoading(false)
      }
    })()
    return () => { active = false }
  }, [isAdmin, auditSearch, auditPage])

  const applyAuditSearch = (e) => {
    e.preventDefault()
    setAuditLoading(true)
    setAuditPage(1)
    setAuditSearch(auditSearchInput.trim())
  }

  const clearAuditSearch = () => {
    setAuditLoading(true)
    setAuditPage(1)
    setAuditSearchInput('')
    setAuditSearch('')
  }

  const changeAuditPage = (nextPage) => {
    setAuditLoading(true)
    setAuditPage(nextPage)
  }

  const openCreate = () => { setForm(EMPTY_FORM); setTarget(null); setModal('create') }
  const openEdit   = (u) => {
    setTarget(u)
    const levels = Array.isArray(u.approvalLevel) ? u.approvalLevel
      : (u.approvalLevel && u.approvalLevel !== 'none' ? String(u.approvalLevel).split(',') : [])
    setForm({
      name: u.name,
      username: u.username ?? '',
      role: u.role,
      approvalLevels: levels,
      signatureParam: u.signatureParam ?? '',
      position: u.position ?? '',
      password: '',
    })
    setModal('edit')
  }
  const openReset  = (u) => { setTarget(u); setForm({ ...EMPTY_FORM, password: '' }); setModal('reset') }
  const openDelete = (u) => { setTarget(u); setModal('delete') }
  const closeModal = () => { setModal(null); setTarget(null) }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.post('/users', {
        name: form.name,
        username: form.username,
        role: form.role,
        approvalLevel: form.role === 'city_health_office' ? [] : (form.approvalLevels ?? []),
        signatureParam: form.signatureParam?.trim() || null,
        position: form.position?.trim() || null,
        password: form.password,
      })
      setUsers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success('User created')
      closeModal()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.patch(`/users/${target.id}`, {
        name: form.name,
        username: form.username,
        role: form.role,
        approvalLevel: form.role === 'city_health_office' ? [] : (form.approvalLevels ?? []),
        signatureParam: form.signatureParam?.trim() || null,
        position: form.position?.trim() || null,
      })
      setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)))
      toast.success('User updated')
      closeModal()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/users/${target.id}/reset-password`, { password: form.password })
      toast.success('Password reset successfully')
      closeModal()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to reset password')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await api.delete(`/users/${target.id}`)
      setUsers((prev) => prev.filter((u) => u.id !== target.id))
      toast.success(`${target.name} has been deleted`)
      closeModal()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete user')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u) => {
    try {
      const { data } = await api.patch(`/users/${u.id}`, { isActive: !u.isActive })
      setUsers((prev) => prev.map((x) => (x.id === data.id ? data : x)))
      toast.success(data.isActive ? 'User activated' : 'User deactivated')
    } catch {
      toast.error('Failed to update status')
    }
  }

  const uploadSignature = async (userId, file) => {
    if (!file) return
    setUploadingSignatureUserId(userId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post(`/users/${userId}/e-signature`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)))
      toast.success('E-signature uploaded')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to upload e-signature')
    } finally {
      setUploadingSignatureUserId(null)
    }
  }

  const uploadProfilePhoto = async (userId, file) => {
    if (!file) return
    setUploadingPhotoUserId(userId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post(`/users/${userId}/profile-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)))
      toast.success('Profile photo uploaded')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to upload profile photo')
    } finally {
      setUploadingPhotoUserId(null)
    }
  }

  const activeUsers = users.filter((u) => u.isActive)
  const activeApprovalUsers = activeUsers.filter((u) => u.role !== 'city_health_office')
  const reviewerUsers    = activeApprovalUsers.filter((u) => (Array.isArray(u.approvalLevel) ? u.approvalLevel : []).includes('reviewer'))
  const recommenderUsers = activeApprovalUsers.filter((u) => (Array.isArray(u.approvalLevel) ? u.approvalLevel : []).includes('recommender'))
  const approverUsers    = activeApprovalUsers.filter((u) => (Array.isArray(u.approvalLevel) ? u.approvalLevel : []).includes('approver'))

  if (!isAdmin) {
    return (
      <div className="card max-w-lg">
        <p className="portal-kicker text-red-500">Access Restricted</p>
        <h1 className="portal-page-title">Settings</h1>
        <p className="portal-page-subtitle">Only administrators can access user management settings.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="mb-6">
        <p className="portal-kicker">Administration</p>
        <h1 className="portal-page-title">Settings</h1>
        <p className="portal-page-subtitle">Manage users, system configuration, and activity logs.</p>
      </div>

      {/* Tab nav */}
      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-brand-primary shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── User Access Control ── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">User Access Control</h2>
              <p className="text-sm text-slate-500">Manage staff accounts and system access.</p>
            </div>
            <button onClick={openCreate} className="portal-button-primary">
              + Add User
            </button>
          </div>
          <div className="card overflow-hidden p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Loading users...</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Employee</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Approval Levels</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">E-Signature</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const levels = Array.isArray(u.approvalLevel) ? u.approvalLevel
                      : (u.approvalLevel && u.approvalLevel !== 'none' ? String(u.approvalLevel).split(',') : [])
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        {/* Employee: name + username + position */}
                        <td className="px-5 py-4">
                          <div className="font-semibold text-sm text-slate-800">{u.name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">@{u.username ?? '-'}</div>
                          {u.position && <div className="text-xs text-slate-500 mt-0.5 italic">{u.position}</div>}
                          <div className="mt-2 flex items-center gap-2">
                            {u.photoUrl ? (
                              <img src={u.photoUrl} alt={u.name} className="h-8 w-8 rounded-full object-cover border border-slate-200" />
                            ) : (
                              <div className="h-8 w-8 rounded-full border border-dashed border-slate-300 bg-slate-50" />
                            )}
                            <label className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap">
                              {uploadingPhotoUserId === u.id ? 'Uploading…' : 'Photo'}
                              <input type="file" accept="image/*" className="hidden"
                                disabled={uploadingPhotoUserId === u.id}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProfilePhoto(u.id, f); e.target.value = '' }}
                              />
                            </label>
                          </div>
                        </td>
                        {/* Role */}
                        <td className="px-5 py-4">
                          <span className={roleBadge(u.role)}>{roleLabel(u.role)}</span>
                        </td>
                        {/* Approval levels — individual chips */}
                        <td className="px-5 py-4">
                          {levels.length === 0 ? (
                            <span className="text-xs text-slate-400">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {levels.map((l) => (
                                <span key={l} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_BADGE_COLOR[l] ?? 'bg-slate-100 text-slate-600'}`}>
                                  {APPROVAL_LEVELS.find((x) => x.value === l)?.label ?? l}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        {/* E-Signature */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {u.eSignatureUrl ? (
                              <div className="h-12 w-28 rounded border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                                <img
                                  src={u.eSignatureUrl}
                                  alt="signature"
                                  className="max-h-11 max-w-[108px] object-contain"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
                                />
                                <span className="hidden text-xs text-slate-400 items-center justify-center w-full h-full">No preview</span>
                              </div>
                            ) : (
                              <div className="h-12 w-28 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                                <span className="text-xs text-slate-400">Not set</span>
                              </div>
                            )}
                            <label className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap">
                              {uploadingSignatureUserId === u.id ? 'Uploading…' : 'Upload'}
                              <input type="file" accept="image/*" className="hidden"
                                disabled={uploadingSignatureUserId === u.id}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSignature(u.id, f); e.target.value = '' }}
                              />
                            </label>
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(u)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">Edit</button>
                            <button onClick={() => openReset(u)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">Reset PW</button>
                            {u.id !== currentUser?.id && (
                              <>
                                <button onClick={() => toggleActive(u)}
                                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${u.isActive ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                                  {u.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                                <button onClick={() => openDelete(u)}
                                  className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {users.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Audit Trail ── */}
      {activeTab === 'audit' && (
        <div className="card overflow-hidden p-0">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Audit Trail</h2>
                <p className="text-sm text-slate-500">Employee document and approval actions.</p>
              </div>
              <form onSubmit={applyAuditSearch} className="flex w-full gap-2 md:w-auto">
                <input
                  type="text"
                  value={auditSearchInput}
                  onChange={(e) => setAuditSearchInput(e.target.value)}
                  placeholder="Search by employee ID or name"
                  className="portal-input h-10 md:w-72"
                />
                <button type="submit" className="portal-button-secondary h-10 px-4">Search</button>
                {auditSearch && (
                  <button type="button" onClick={clearAuditSearch} className="portal-button-secondary h-10 px-4">Clear</button>
                )}
              </form>
            </div>
          </div>
          {auditLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading audit trail...</div>
          ) : (
            <>
              <table className="table-base w-full table-auto">
                <thead>
                  <tr>
                    <th className="table-th px-5 py-3 text-left">Date/Time</th>
                    <th className="table-th px-5 py-3 text-left">Employee</th>
                    <th className="table-th px-5 py-3 text-left">Case</th>
                    <th className="table-th px-5 py-3 text-left">Action</th>
                    <th className="table-th px-5 py-3 text-left">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="table-td px-5 py-4 align-top text-xs text-slate-600">{formatAuditTime(log.changedAt)}</td>
                      <td className="table-td px-5 py-4 align-top">
                        <div className="font-medium text-slate-800">{log.user?.name ?? 'Unknown user'}</div>
                        <div className="mt-1 font-mono text-xs text-slate-500">ID: {log.user?.employeeId ?? '-'}</div>
                      </td>
                      <td className="table-td px-5 py-4 align-top">
                        <div className="font-medium text-slate-800">{log.case?.caseNumber ?? '-'}</div>
                        <div className="mt-1 text-xs text-slate-500">{log.case?.clientName ?? '-'}</div>
                      </td>
                      <td className="table-td px-5 py-4 align-top text-sm text-slate-800">{log.action}</td>
                      <td className="table-td px-5 py-4 align-top text-xs leading-relaxed text-slate-600">{log.notes || `${log.fromStatus} -> ${log.toStatus}`}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="table-td px-5 py-6 text-center text-slate-400">No audit records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
                <span className="mr-2 text-xs text-slate-500">
                  Page {auditPage} of {auditTotalPages} ({auditTotal} records)
                </span>
                <button
                  type="button"
                  onClick={() => changeAuditPage(Math.max(1, auditPage - 1))}
                  disabled={auditPage <= 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => changeAuditPage(Math.min(auditTotalPages, auditPage + 1))}
                  disabled={auditPage >= auditTotalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Case Number Format ── */}
      {activeTab === 'format' && (
        <div className="card">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">Case Number Format</h2>
            <p className="text-sm text-slate-500">Configure the ID and case number codes generated for new records. Changes apply to new records only.</p>
          </div>
          <form onSubmit={saveFmt}>
            {/* Global format settings */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="portal-label">Client Prefix</label>
                <input className="portal-input font-mono" value={fmt.clientPrefix} maxLength={10}
                  onChange={(e) => setFmt((f) => ({ ...f, clientPrefix: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="portal-label">Agency Code</label>
                <input className="portal-input font-mono" value={fmt.agencyCode} maxLength={10}
                  onChange={(e) => setFmt((f) => ({ ...f, agencyCode: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="portal-label">Location Code</label>
                <input className="portal-input font-mono" value={fmt.locationCode} maxLength={10}
                  onChange={(e) => setFmt((f) => ({ ...f, locationCode: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="portal-label">Sequence Digits</label>
                <select className="portal-input" value={fmt.sequenceDigits}
                  onChange={(e) => setFmt((f) => ({ ...f, sequenceDigits: Number(e.target.value) }))}>
                  {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} digits</option>)}
                </select>
              </div>
            </div>

            {/* Case type prefixes */}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div>
                <label className="portal-label">Medicine Prefix</label>
                <input className="portal-input font-mono" value={fmt.medicinePrefix} maxLength={10}
                  onChange={(e) => setFmt((f) => ({ ...f, medicinePrefix: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="portal-label">Burial Prefix</label>
                <input className="portal-input font-mono" value={fmt.burialPrefix} maxLength={10}
                  onChange={(e) => setFmt((f) => ({ ...f, burialPrefix: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="portal-label">Hospital Prefix</label>
                <input className="portal-input font-mono" value={fmt.hospitalPrefix} maxLength={10}
                  onChange={(e) => setFmt((f) => ({ ...f, hospitalPrefix: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="portal-label">Medical Prefix</label>
                <input className="portal-input font-mono" value={fmt.medicalPrefix} maxLength={10}
                  onChange={(e) => setFmt((f) => ({ ...f, medicalPrefix: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="portal-label">Eyeglass Prefix</label>
                <input className="portal-input font-mono" value={fmt.eyeglassPrefix} maxLength={10}
                  onChange={(e) => setFmt((f) => ({ ...f, eyeglassPrefix: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="portal-label">Plain AICS Prefix</label>
                <input className="portal-input font-mono" value={fmt.plainPrefix} maxLength={10}
                  onChange={(e) => setFmt((f) => ({ ...f, plainPrefix: e.target.value.toUpperCase() }))} />
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approval Hierarchy Assignment</p>
              <p className="mt-1 text-xs text-slate-400">Only employees with the matching approval level are shown. The selected official&apos;s e-signature will be embedded in generated documents.</p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  { label: 'Reviewed By', field: 'reviewedByUserId', pool: reviewerUsers, role: 'reviewer' },
                  { label: 'Recommending Approval', field: 'recommendingUserId', pool: recommenderUsers, role: 'recommender' },
                  { label: 'Final Approval', field: 'approvedByUserId', pool: approverUsers, role: 'approver' },
                ].map(({ label, field, pool, role }) => {
                  const selectedId = fmt[field]
                  const selectedUser = activeUsers.find((u) => u.id === selectedId)
                  const isOrphaned = selectedId && !pool.find((u) => u.id === selectedId)
                  return (
                    <div key={field}>
                      <label className="portal-label">{label}</label>
                      <select
                        className="portal-input"
                        value={selectedId || ''}
                        onChange={(e) => setFmt((f) => ({ ...f, [field]: e.target.value || null }))}
                      >
                        <option value="">— Unassigned —</option>
                        {pool.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                        {isOrphaned && (
                          <option value={selectedId}>{selectedUser?.name ?? 'Unknown'} (no {role} level)</option>
                        )}
                      </select>
                      {pool.length === 0 && (
                        <p className="mt-1 text-xs text-amber-600">No employees have the &ldquo;{role}&rdquo; approval level set.</p>
                      )}
                      {selectedUser ? (
                        <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                          {selectedUser.eSignatureUrl ? (
                            <>
                              <img
                                src={selectedUser.eSignatureUrl}
                                alt={selectedUser.name}
                                className="h-8 w-20 rounded border border-slate-100 object-contain"
                              />
                              <span className="text-xs text-slate-500 truncate">{selectedUser.name}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-lg">✍</span>
                              <span className="text-xs text-amber-600">{selectedUser.name} — no e-signature uploaded</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 h-10 rounded-md border border-dashed border-slate-200 bg-white" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Preview</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-mono">
                <span><span className="text-slate-400 mr-1">Client ID:</span><span className="text-brand-primary font-bold">{previewClient}</span></span>
                <span><span className="text-slate-400 mr-1">Medicine:</span><span className="text-emerald-700 font-bold">{previewMedicine}</span></span>
                <span><span className="text-slate-400 mr-1">Burial:</span><span className="text-amber-700 font-bold">{previewBurial}</span></span>
                <span><span className="text-slate-400 mr-1">Hospital:</span><span className="text-blue-700 font-bold">{previewHospital}</span></span>
                <span><span className="text-slate-400 mr-1">Medical:</span><span className="text-violet-700 font-bold">{previewMedical}</span></span>
                <span><span className="text-slate-400 mr-1">Eyeglass:</span><span className="text-orange-600 font-bold">{previewEyeglass}</span></span>
                <span><span className="text-slate-400 mr-1">Plain AICS:</span><span className="text-slate-700 font-bold">{previewPlain}</span></span>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={fmtSaving} className="portal-button-primary">
                {fmtSaving ? 'Saving...' : 'Save Format'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'applicants' && (
        <ApplicantAccountsPage />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {modal === 'delete' && target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="rounded-t-xl bg-gradient-to-r from-red-700 to-red-600 px-6 py-4">
              <h2 className="font-display text-lg font-bold text-white">Delete User</h2>
            </div>
            <div className="px-6 py-6">
              <p className="text-sm text-slate-700">
                Are you sure you want to permanently delete{' '}
                <span className="font-semibold">{target.name}</span>?
                This action cannot be undone.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={closeModal}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleDelete}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {saving ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit / Reset Modal ── */}
      {modal && modal !== 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="rounded-t-xl bg-gradient-to-r from-[#064e3b] to-[#065f46] px-6 py-4">
              <h2 className="font-display text-lg font-bold text-white">
                {modal === 'create' && 'Add New User'}
                {modal === 'edit'   && `Edit — ${target?.name}`}
                {modal === 'reset'  && `Reset Password — ${target?.name}`}
              </h2>
            </div>
            <form
              onSubmit={modal === 'create' ? handleCreate : modal === 'edit' ? handleEdit : handleReset}
              className="space-y-4 px-6 py-6"
            >
              {modal !== 'reset' && (
                <>
                  <div>
                    <label className="portal-label">Full Name</label>
                    <input className="portal-input" required value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label">Username</label>
                    <input className="portal-input" required={modal === 'create'} value={form.username}
                      placeholder="lowercase, numbers, underscores"
                      onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} />
                  </div>
                  <div>
                    <label className="portal-label">Role</label>
                    <select className="portal-input" value={form.role}
                      onChange={(e) => setForm({
                        ...form,
                        role: e.target.value,
                        approvalLevels: e.target.value === 'city_health_office' ? [] : form.approvalLevels,
                      })}>
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="portal-label">Approval Level</label>
                    <div className="mt-1 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      {APPROVAL_LEVELS.map((lvl) => (
                        <label key={lvl.value} className="flex cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            disabled={form.role === 'city_health_office'}
                            checked={(form.approvalLevels ?? []).includes(lvl.value)}
                            onChange={(e) => {
                              const current = form.approvalLevels ?? []
                              const updated = e.target.checked
                                ? [...current, lvl.value]
                                : current.filter((l) => l !== lvl.value)
                              setForm({ ...form, approvalLevels: updated })
                            }}
                            className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                          />
                          <span className="text-sm text-slate-700">{lvl.label}</span>
                        </label>
                      ))}
                      {form.role === 'city_health_office' && (
                        <p className="text-xs text-slate-400">City Health Office accounts cannot be assigned to case approval levels.</p>
                      )}
                      {(form.approvalLevels ?? []).length === 0 && (
                        <p className="text-xs text-slate-400">No approval levels — employee only</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="portal-label">Position / Title</label>
                    <input
                      className="portal-input"
                      value={form.position}
                      placeholder="e.g. Administrative Aide III"
                      maxLength={200}
                      onChange={(e) => setForm({ ...form, position: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="portal-label">
                      Signature Template Key
                      <span className="ml-1.5 text-slate-400 font-normal normal-case tracking-normal">
                        — used as <code className="bg-slate-100 px-1 rounded text-xs">{'{'}key{'}'}</code> in DOCX templates
                      </span>
                    </label>
                    <input
                      className="portal-input font-mono"
                      value={form.signatureParam}
                      placeholder="e.g. maribelleArtienda"
                      maxLength={50}
                      onChange={(e) => setForm({ ...form, signatureParam: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                    />
                  </div>
                </>
              )}
              {(modal === 'create' || modal === 'reset') && (
                <div>
                  <label className="portal-label">{modal === 'reset' ? 'New Password' : 'Password'}</label>
                  <input className="portal-input" type="password" required minLength={8} value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Minimum 8 characters" />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="portal-button-primary">
                  {saving ? 'Saving...' : modal === 'reset' ? 'Reset Password' : modal === 'edit' ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
