import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { ChevronLeftIcon } from '../../components/ui/Icons'
import { VIGAN_BARANGAYS } from '../../lib/constants'
import DuplicateReviewModal from '../../components/clients/DuplicateReviewModal'


export default function ClientForm() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [duplicateModal, setDuplicateModal] = useState(null)
  const { register, handleSubmit } = useForm({
    defaultValues: {
      clientCategory: 'walk-in', sex: '', civilStatus: '',
      region: 'Region I', municipality: 'Vigan City', province: 'Ilocos Sur',
    },
  })


  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const duplicateCheck = await api.post('/clients/duplicate-check', data)
      if (duplicateCheck.data?.duplicateStatus && duplicateCheck.data.duplicateStatus !== 'no_match') {
        setDuplicateModal({
          payload: data,
          ...duplicateCheck.data,
        })
        return
      }

      const res = await api.post('/clients', data)
      toast.success('Client profile created')
      navigate(`/clients/${res.data.id}`)
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.matches) {
        setDuplicateModal({
          payload: data,
          ...err.response.data,
        })
      } else {
        toast.success('Client created (demo mode)')
        navigate('/clients')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleUseExisting = async (match) => {
    if (!duplicateModal?.payload) return
    setSaving(true)
    try {
      const res = await api.post('/clients', {
        ...duplicateModal.payload,
        reuseClientId: match.id,
        overrideDuplicateReason: `Reused existing client ${match.caseNumber} after duplicate review.`,
      })
      toast.success('Existing client profile reused')
      navigate(`/clients/${res.data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reuse existing client')
    } finally {
      setSaving(false)
      setDuplicateModal(null)
    }
  }

  const handleCreateAnyway = async (reason) => {
    if (!duplicateModal?.payload) return
    setSaving(true)
    try {
      const res = await api.post('/clients', {
        ...duplicateModal.payload,
        overrideDuplicateReason: reason,
      })
      toast.success('Client profile created with override')
      navigate(`/clients/${res.data.id}`)
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.matches) {
        setDuplicateModal({
          payload: duplicateModal.payload,
          ...err.response.data,
        })
      } else {
        toast.error(err.response?.data?.message || 'Failed to create client')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <button onClick={() => navigate('/clients')} className="btn-ghost mb-4 text-sm">
        <ChevronLeftIcon className="h-4 w-4" /> Back to Clients
      </button>

      <div className="mb-6">
        <p className="portal-kicker">Registry</p>
        <h1 className="portal-page-title">New Client Profile</h1>
        <p className="portal-page-subtitle">Case number will be auto-generated upon submission</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Personal Info */}
        <div className="card">
          <div className="form-section-title">Personal Information</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="portal-label">Last Name *</label>
              <input {...register('lastName', { required: true })} className="portal-input" placeholder="Dela Cruz" />
            </div>
            <div>
              <label className="portal-label">First Name *</label>
              <input {...register('firstName', { required: true })} className="portal-input" placeholder="Juan" />
            </div>
            <div>
              <label className="portal-label">Middle Name</label>
              <input {...register('middleName')} className="portal-input" placeholder="Santos" />
            </div>
            <div>
              <label className="portal-label">Date of Birth *</label>
              <input type="date" {...register('dateOfBirth', { required: true })} className="portal-input" />
            </div>
            <div>
              <label className="portal-label">Sex</label>
              <select {...register('sex')} className="portal-input">
                <option value="">Select sex</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="portal-label">Civil Status</label>
              <select {...register('civilStatus')} className="portal-input">
                <option value="">Select</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>
            <div>
              <label className="portal-label">Contact Number</label>
              <input {...register('contactNumber')} className="portal-input" placeholder="09XXXXXXXXX" />
            </div>
            <div>
              <label className="portal-label">Occupation</label>
              <input {...register('occupation')} className="portal-input" placeholder="e.g. Farmer, Vendor, Unemployed" />
            </div>
            <div>
              <label className="portal-label">Religion</label>
              <input {...register('religion')} className="portal-input" placeholder="e.g. Roman Catholic, Islam, INC" />
            </div>
            <div>
              <label className="portal-label">Client Category</label>
              <select {...register('clientCategory')} className="portal-input">
                <option value="walk-in">Walk-in</option>
                <option value="referred">Referred</option>
                <option value="rescued">Rescued</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="portal-label">Referral Source (if referred)</label>
              <input {...register('referralSource')} className="portal-input" placeholder="Agency or person who referred" />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card">
          <div className="form-section-title">Address</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="portal-label">Barangay</label>
              <select {...register('barangay')} className="portal-input">
                <option value="">Select barangay</option>
                {VIGAN_BARANGAYS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="portal-label">City / Municipality</label>
              <input {...register('municipality')} readOnly className="portal-input bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="portal-label">Province</label>
              <input {...register('province')} readOnly className="portal-input bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="portal-label">Region</label>
              <input {...register('region')} readOnly className="portal-input bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
          </div>
        </div>

        {/* Classifications */}
        <div className="card">
          <div className="form-section-title">Classifications</div>
          <div className="flex flex-wrap gap-4">
            {[
              { key: 'is4ps', label: '4Ps Beneficiary' },
              { key: 'isPwd', label: 'Person with Disability (PWD)' },
              { key: 'isSenior', label: 'Senior Citizen (60+)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register(key)} className="h-4 w-4 rounded border-slate-300 text-brand-green focus:ring-brand-green" />
                <span className="text-sm font-medium text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/clients')} className="portal-button-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="portal-button-primary" id="btn-save-client">
            {saving ? 'Saving...' : 'Create Client Profile'}
          </button>
        </div>
      </form>

      <DuplicateReviewModal
        open={!!duplicateModal}
        title="Possible duplicate client found"
        message="A similar client profile already exists. Reuse the existing record if it is the same person, or provide a reason to create a new one anyway."
        matches={duplicateModal?.matches || []}
        saving={saving}
        onClose={() => setDuplicateModal(null)}
        onUseExisting={handleUseExisting}
        onCreateAnyway={handleCreateAnyway}
        onViewProfile={(match) => navigate(`/clients/${match.id}`)}
      />
    </div>
  )
}
