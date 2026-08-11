import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import ProtectedImage from '../../../components/shared/ProtectedImage'
import {
  ROLES,
  APPROVAL_LEVELS,
  POSITION_OPTIONS,
  DEPARTMENT_OPTIONS,
  EMPTY_FORM,
  roleLabel,
  roleBadge,
  LEVEL_BADGE_COLOR,
} from '../settingsConstants'

export default function UsersTab({ users, setUsers, loading, currentUser }) {
  const [modal, setModal] = useState(null)
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploadingSignatureUserId, setUploadingSignatureUserId] = useState(null)
  const [uploadingPhotoUserId, setUploadingPhotoUserId] = useState(null)

  const departmentOptions = useMemo(() => [...new Set([
    ...DEPARTMENT_OPTIONS,
    ...users.map((u) => String(u.department ?? '').trim()).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b)), [users])

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
      department: u.department ?? '',
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
        department: form.department?.trim() || null,
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
        department: form.department?.trim() || null,
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

  return (
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
                      {u.department && <div className="text-xs text-slate-500 mt-0.5">Office: {u.department}</div>}
                      <div className="mt-2 flex items-center gap-2">
                        {u.photoUrl ? (
                          <img src={u.photoUrl} alt={u.name} className="h-8 w-8 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="h-8 w-8 rounded-full border border-dashed border-slate-300 bg-slate-50" />
                        )}
                        <label className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap">
                          {uploadingPhotoUserId === u.id ? 'Uploading...' : 'Photo'}
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
                    {/* Approval levels - individual chips */}
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
                            <ProtectedImage
                              src={u.eSignatureUrl}
                              alt="signature"
                              className="max-h-11 max-w-[108px] object-contain"
                              fallback={<span className="text-xs text-slate-400 items-center justify-center w-full h-full flex">No preview</span>}
                            />
                          </div>
                        ) : (
                          <div className="h-12 w-28 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                            <span className="text-xs text-slate-400">Not set</span>
                          </div>
                        )}
                        <label className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap">
                          {uploadingSignatureUserId === u.id ? 'Uploading...' : 'Upload'}
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
                          <div className="grid gap-4 md:grid-cols-2">
                            <button onClick={() => toggleActive(u)}
                              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${u.isActive ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onClick={() => openDelete(u)}
                              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                              Delete
                            </button>
                          </div>
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

      {/* Delete Confirmation Modal */}
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

      {/* Create / Edit / Reset Modal */}
      {modal && modal !== 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className={`w-full rounded-xl bg-white shadow-2xl ${modal === 'reset' ? 'max-w-md' : 'max-w-3xl'}`}>
            <div className="rounded-t-xl bg-gradient-to-r from-[#064e3b] to-[#065f46] px-6 py-4">
              <h2 className="font-display text-lg font-bold text-white">
                {modal === 'create' && 'Add New User'}
                {modal === 'edit'   && `Edit - ${target?.name}`}
                {modal === 'reset'  && `Reset Password - ${target?.name}`}
              </h2>
            </div>
            <form
              onSubmit={modal === 'create' ? handleCreate : modal === 'edit' ? handleEdit : handleReset}
              className="px-6 py-6"
            >
              {modal !== 'reset' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
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
                  <div className="md:row-span-2">
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
                        <p className="text-xs text-slate-400">No approval levels - employee only</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="portal-label">Position / Title</label>
                    <select
                      className="portal-input"
                      value={form.position}
                      onChange={(e) => setForm({ ...form, position: e.target.value })}
                    >
                      <option value="">- Select title -</option>
                      {form.position && !POSITION_OPTIONS.includes(form.position) && (
                        <option value={form.position}>{form.position}</option>
                      )}
                      {POSITION_OPTIONS.map((position) => (
                        <option key={position} value={position}>{position}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="portal-label">Office / Department</label>
                    <input
                      className="portal-input"
                      list="department-options"
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      placeholder="e.g. Administrative or CSWDO"
                    />
                    <datalist id="department-options">
                      {departmentOptions.map((department) => (
                        <option key={department} value={department} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="portal-label">
                      Signature Template Key
                      <span className="ml-1.5 text-slate-400 font-normal normal-case tracking-normal">
                        - used as <code className="bg-slate-100 px-1 rounded text-xs">{'{'}key{'}'}</code> in DOCX templates
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
                </div>
              )}
              {(modal === 'create' || modal === 'reset') && (
                <div className="mt-4">
                  <label className="portal-label">{modal === 'reset' ? 'New Password' : 'Password'}</label>
                  <input className="portal-input" type="password" required minLength={8} value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Minimum 8 characters" />
                </div>
              )}
              <div className="mt-6 flex justify-end gap-3 pt-2">
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
