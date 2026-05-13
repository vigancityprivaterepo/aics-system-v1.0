import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { isApplicantProfileComplete } from '../lib/profileCompletion'

const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled']
const VIGAN_BARANGAYS = [
  'Ayusan Norte', 'Ayusan Sur', 'Barraca', 'Barangay I', 'Barangay II', 'Barangay III',
  'Barangay IV', 'Barangay V', 'Barangay VI', 'Barangay VII', 'Barangay VIII',
  'Barangay IX', 'Barangay X', 'Barangay XI', 'Bulala', 'Cabalangegan', 'Cabaroan Daya',
  'Cabaroan Laud', 'Camangaan', 'Capangpangan', 'Mindoro', 'Nagsangalan', 'Pagburnayan',
  'Paing', 'Pantay Daya', 'Pantay Fatima', 'Pantay Laud', 'Paoa', 'Pariok', 'Purok-a-Bakal',
  'Raois', 'Rugsuanan', 'Salindeg', 'San Jose', 'San Julian Norte', 'San Julian Sur',
  'San Pedro', 'Tamag',
]

function buildProfileForm(applicant) {
  return {
    firstName: applicant?.firstName || '',
    lastName: applicant?.lastName || '',
    middleName: applicant?.middleName || '',
    mobileNumber: applicant?.mobileNumber || '',
    dateOfBirth: applicant?.dateOfBirth ? applicant.dateOfBirth.slice(0, 10) : '',
    sex: applicant?.sex || '',
    civilStatus: applicant?.civilStatus || '',
    barangay: applicant?.barangay || '',
    municipality: applicant?.municipality || 'Vigan City',
    province: applicant?.province || 'Ilocos Sur',
    region: applicant?.region || 'Region I',
    occupation: applicant?.occupation || '',
    religion: applicant?.religion || '',
    is4ps: applicant?.is4ps || false,
    isPwd: applicant?.isPwd || false,
    isSenior: applicant?.isSenior || false,
  }
}

function ProfileForm({ applicant, onSaved }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => buildProfileForm(applicant))
  const isProfileComplete = useMemo(() => isApplicantProfileComplete(form), [form])
  const isProfileLocked = useMemo(() => isApplicantProfileComplete(applicant), [applicant])
  const profileCompletionRequired = Boolean(location.state?.profileCompletionRequired)
  const redirectTo = typeof location.state?.redirectTo === 'string' ? location.state.redirectTo : '/dashboard'
  const noticeStorageKey = applicant?.id ? `portal-profile-notice-seen:${applicant.id}` : null
  const [profileNoticeDismissed, setProfileNoticeDismissed] = useState(() => {
    if (!noticeStorageKey) return true
    return window.localStorage.getItem(noticeStorageKey) === '1'
  })

  const showProfileNotice = Boolean(noticeStorageKey) && !isProfileLocked && !profileNoticeDismissed

  const setField = (field) => (e) => {
    if (isProfileLocked) return
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((current) => ({ ...current, [field]: value }))
  }

  const dismissProfileNotice = () => {
    if (noticeStorageKey) {
      window.localStorage.setItem(noticeStorageKey, '1')
    }
    setProfileNoticeDismissed(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (isProfileLocked) {
      toast.error('Your profile is already finalized. Please contact the admin office for any changes.')
      return
    }
    setSaving(true)
    try {
      const res = await api.put('/auth/me', {
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        middleName: form.middleName || null,
        mobileNumber: form.mobileNumber || null,
      })
      onSaved(res.data)
      toast.success(isProfileComplete ? 'Profile updated successfully' : 'Profile saved successfully')
      if (profileCompletionRequired && isApplicantProfileComplete(res.data)) {
        navigate(redirectTo, { replace: true })
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {showProfileNotice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-blue-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-[#064e3b] via-[#065f46] to-[#047857] px-6 py-5 text-white">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-200">Important Profile Notice</p>
              <h2 className="mt-2 font-display text-2xl font-bold">Review your details before saving</h2>
            </div>
            <div className="px-6 py-5 text-sm leading-7 text-slate-700">
              <p>
                This is your first profile setup. Make sure your personal, contact, and address details are correct before you save them.
              </p>
              <p className="mt-3">
                Once your profile is complete and finalized, you will no longer be able to change it yourself. Only the admin office can update finalized profile details.
              </p>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={dismissProfileNotice} className="portal-button-primary">
                I Understand
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="portal-surface overflow-hidden">
        <div className="border-b border-slate-300 bg-gradient-to-r from-[#064e3b] via-[#065f46] to-[#047857] px-6 py-6 text-white">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-200">Applicant Profile</p>
          <h1 className="mt-2 font-display text-3xl font-bold">My Profile</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-100">
            Complete and register your profile to support verification, document review, and applicant coordination.
          </p>
        </div>

        {!isProfileComplete ? (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-4">
            <p className="text-sm font-semibold text-amber-800">
              {profileCompletionRequired ? 'Profile completion is required before you can continue.' : 'Complete your profile before filing an application.'}
            </p>
            <p className="mt-1 text-sm text-amber-700">
              Fill in your contact, personal, and address details so staff case creation does not start with blank client information.
            </p>
          </div>
        ) : null}

        <div className="border-b border-blue-200 bg-blue-50 px-6 py-4">
          <p className="text-sm font-semibold text-blue-900">Important Profile Notice</p>
          <p className="mt-1 text-sm text-blue-800">
            {isProfileLocked
              ? 'Your profile is already finalized and locked. Only the admin office can change these details.'
              : 'Review your profile carefully before finalizing it. Once your profile details are already final, changes should only be handled by the admin office.'}
          </p>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="portal-panel p-4 xl:col-span-2">
            <p className="portal-kicker">Account Email</p>
            <p className="mt-2 text-sm font-semibold text-brand-primary">{applicant?.email}</p>
            <p className="mt-1 text-xs text-slate-500">Your email address is fixed for account security and verification.</p>
          </div>
          <div className="portal-panel p-4">
            <p className="portal-kicker">Client ID Number</p>
            <p className="mt-2 text-sm font-semibold text-brand-primary">
              {applicant?.clientCaseNumber || 'Pending client ID assignment'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              This is your client record number used by the AICS office.
            </p>
          </div>
          <div className="portal-panel p-4">
            <p className="portal-kicker">Profile Status</p>
            <p className={`mt-2 text-sm font-semibold ${isProfileComplete ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isProfileComplete ? 'Profile complete' : 'More details needed'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {isProfileComplete
                ? 'Your applicant profile is ready for application processing.'
                : 'Add your missing details to avoid delays during application review.'}
            </p>
          </div>
        </div>
      </section>

      <section className="portal-surface p-6">
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="portal-label">First Name</label>
              <input className="portal-input" required value={form.firstName} onChange={setField('firstName')} disabled={isProfileLocked} />
            </div>
            <div>
              <label className="portal-label">Middle Name</label>
              <input className="portal-input" value={form.middleName} onChange={setField('middleName')} placeholder="Optional" disabled={isProfileLocked} />
            </div>
            <div>
              <label className="portal-label">Last Name</label>
              <input className="portal-input" required value={form.lastName} onChange={setField('lastName')} disabled={isProfileLocked} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="portal-label">Date of Birth</label>
              <input type="date" className="portal-input" value={form.dateOfBirth} onChange={setField('dateOfBirth')} required disabled={isProfileLocked} />
            </div>
            <div>
              <label className="portal-label">Sex</label>
              <select className="portal-input" value={form.sex} onChange={setField('sex')} required disabled={isProfileLocked}>
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div>
              <label className="portal-label">Civil Status</label>
              <select className="portal-input" value={form.civilStatus} onChange={setField('civilStatus')} required disabled={isProfileLocked}>
                <option value="">Select</option>
                {CIVIL_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
            <div>
              <label className="portal-label">Mobile Number</label>
              <input type="tel" className="portal-input" value={form.mobileNumber} onChange={setField('mobileNumber')} placeholder="09XXXXXXXXX" required disabled={isProfileLocked} />
            </div>
            <div>
              <label className="portal-label">Occupation</label>
              <input className="portal-input" value={form.occupation} onChange={setField('occupation')} placeholder="Current occupation" required disabled={isProfileLocked} />
            </div>
            <div>
              <label className="portal-label">Religion</label>
              <input className="portal-input" value={form.religion} onChange={setField('religion')} placeholder="Religion" required disabled={isProfileLocked} />
            </div>
          </div>

          <div>
            <label className="portal-label">Barangay</label>
            <select className="portal-input" value={form.barangay} onChange={setField('barangay')} required disabled={isProfileLocked}>
              <option value="">Select barangay</option>
              {VIGAN_BARANGAYS.map((barangay) => <option key={barangay}>{barangay}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="portal-label">Municipality</label>
              <input className="portal-input bg-slate-50 text-slate-500" value={form.municipality} readOnly />
            </div>
            <div>
              <label className="portal-label">Province</label>
              <input className="portal-input bg-slate-50 text-slate-500" value={form.province} readOnly />
            </div>
            <div>
              <label className="portal-label">Region</label>
              <input className="portal-input bg-slate-50 text-slate-500" value={form.region} readOnly />
            </div>
          </div>

          <div>
            <label className="portal-label">Classifications</label>
            <div className="mt-3 flex flex-wrap gap-4">
              {[['is4ps', '4Ps Beneficiary'], ['isPwd', 'Person with Disability (PWD)'], ['isSenior', 'Senior Citizen']].map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form[key]} onChange={setField(key)} className="h-4 w-4 accent-[#10b981]" disabled={isProfileLocked} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button type="submit" disabled={saving || isProfileLocked} className="portal-button-primary disabled:cursor-not-allowed disabled:opacity-60">
              {isProfileLocked ? 'Profile Locked' : saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default function ProfilePage() {
  const applicant = useAuthStore((s) => s.applicant)
  const updateApplicant = useAuthStore((s) => s.updateApplicant)

  return (
    <ProfileForm
      key={applicant?.id || 'profile-form'}
      applicant={applicant}
      onSaved={updateApplicant}
    />
  )
}
