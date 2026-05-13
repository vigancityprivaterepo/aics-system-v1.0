import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { XIcon, UploadIcon } from '../ui/Icons'

const APPROVAL_LEVEL_LABELS = {
  none: 'None',
  reviewer: 'Reviewer',
  recommender: 'Recommender',
  approver: 'Final Approver',
}

const ROLE_LABELS = {
  admin: 'Administrator',
  employee: 'Employee',
  city_health_office: 'City Health Office',
}

function approvalLevelText(value) {
  const levels = Array.isArray(value)
    ? value
    : (value && value !== 'none' ? [value] : [])
  if (levels.length === 0) return 'None'
  return levels.map((level) => APPROVAL_LEVEL_LABELS[level] ?? level).join(', ')
}

export default function MyProfileModal({ isOpen, onClose }) {
  const updateUser = useAuthStore((state) => state.updateUser)
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({
    name: '',
    position: '',
  })
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const photoInputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    api.get('/users/me')
      .then(({ data }) => {
        if (cancelled) return
        setProfile(data)
        setForm({
          name: data.name ?? '',
          position: data.position ?? '',
        })
        setLoadFailed(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoadFailed(true)
        toast.error('Failed to load profile')
      })
    return () => { cancelled = true }
  }, [isOpen])

  const handleClose = () => {
    setProfile(null)
    setLoadFailed(false)
    onClose()
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post(`/users/${profile.id}/e-signature`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setProfile(data)
      toast.success('E-signature uploaded')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to upload e-signature')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        position: form.position.trim() || null,
      }
      const { data } = await api.patch('/users/me', payload)
      setProfile(data)
      updateUser({
        name: data.name,
        position: data.position,
        photoUrl: data.photoUrl ?? null,
      })
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post(`/users/${profile.id}/profile-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setProfile(data)
      updateUser({ photoUrl: data.photoUrl ?? null })
      toast.success('Profile photo uploaded')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to upload profile photo')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">My Profile</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {!profile && !loadFailed ? (
            <p className="text-center text-sm text-slate-500 py-6">Loading...</p>
          ) : loadFailed ? (
            <p className="text-center text-sm text-slate-500 py-6">Unable to load profile.</p>
          ) : profile ? (
            <>
              {/* Info */}
              <form className="space-y-3" onSubmit={handleSaveProfile}>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Full Name</p>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                    value={form.name}
                    maxLength={200}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Employee ID</p>
                    <p className="text-sm text-slate-700 font-mono">{profile.employeeId}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Role</p>
                    <p className="text-sm text-slate-700">{ROLE_LABELS[profile.role] ?? profile.role}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Profile Photo</p>
                  {profile.photoUrl ? (
                    <img src={profile.photoUrl} alt={profile.name} className="h-20 w-20 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="h-20 w-20 rounded-full border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                      No photo
                    </div>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploading}
                    className="mt-2 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : profile.photoUrl ? 'Replace Photo' : 'Upload Photo'}
                  </button>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Approval Level</p>
                  <p className="text-sm text-slate-700">{approvalLevelText(profile.approvalLevel)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Position / Title</p>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                    value={form.position}
                    maxLength={200}
                    onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
                  />
                </div>
              </form>

              {/* E-Signature */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3">E-Signature</p>
                {profile.eSignatureUrl ? (
                  <div className="mb-3">
                    <div className="inline-block rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <img
                        src={profile.eSignatureUrl}
                        alt="E-signature"
                        className="h-16 w-48 object-contain"
                      />
                    </div>
                    {profile.eSignatureUploadedAt && (
                      <p className="mt-1.5 text-xs text-slate-400">
                        Uploaded {new Date(profile.eSignatureUploadedAt).toLocaleDateString('en-PH', {
                          year: 'numeric', month: 'short', day: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mb-3 text-sm text-slate-400 italic">No e-signature uploaded yet.</p>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                />
                <div className="flex w-full items-center justify-between gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <UploadIcon className="h-4 w-4" />
                    {uploading ? 'Uploading...' : profile.eSignatureUrl ? 'Replace Signature' : 'Upload Signature'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
