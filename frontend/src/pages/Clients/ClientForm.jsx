import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { ChevronLeftIcon, PlusIcon, TrashIcon } from '../../components/ui/Icons'
import { VIGAN_BARANGAYS } from '../../lib/constants'
import { calculateAge } from '../../lib/utils'
import DuplicateReviewModal from '../../components/clients/DuplicateReviewModal'

const defaultFamilyMember = { name: '', dateOfBirth: '', age: '', relationship: '', relationshipOther: '', occupation: '' }
const RELIGION_OPTIONS = ['Roman Catholic', 'Iglesia ni Cristo', 'Islam', 'Born Again Christian', 'Evangelical', 'Protestant', 'Aglipayan', 'Seventh-day Adventist', "Jehovah's Witness", 'Other']
const STANDARD_RELATIONSHIPS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandson', 'Granddaughter', 'Grandfather', 'Grandmother', 'Uncle', 'Aunt', 'Nephew', 'Niece', 'Son-in-Law', 'Daughter-in-Law', 'Father-in-Law', 'Mother-in-Law']
const RELATIONSHIP_OPTIONS = [...STANDARD_RELATIONSHIPS, 'Other']

export default function ClientForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = location.state?.prefill ?? null
  const returnTo = location.state?.returnTo ?? null
  const [saving, setSaving] = useState(false)
  const [family, setFamily] = useState(prefill?.familyComposition ?? [])
  const [duplicateModal, setDuplicateModal] = useState(null)
  const { register, handleSubmit } = useForm({
    defaultValues: {
      clientCategory: 'walk-in', sex: '', civilStatus: '',
      region: 'Region I', municipality: 'Vigan City', province: 'Ilocos Sur',
      firstName: prefill?.firstName ?? '', lastName: prefill?.lastName ?? '', occupation: prefill?.occupation ?? '',
    },
  })

  const navigateAfterSave = (clientId) => {
    if (returnTo?.assistanceType) navigate(`/cases/new?type=${returnTo.assistanceType}&clientId=${clientId}`)
    else navigate(`/clients/${clientId}`)
  }

  const addFamilyMember = () => setFamily((current) => [...current, { ...defaultFamilyMember }])
  const removeFamilyMember = (index) => setFamily((current) => current.filter((_, idx) => idx !== index))
  const updateFamilyMember = (index, field, value) => {
    setFamily((current) => current.map((member, idx) => (idx === index ? { ...member, [field]: value } : member)))
  }

  const cleanFamily = () => family
    .map((member) => {
      const relSelect = member.relationship
      let finalRel = String(relSelect || '').trim()
      if (relSelect === 'Other') {
        finalRel = String(member.relationshipOther || '').trim() || 'Other'
      }
      const dateOfBirth = member.dateOfBirth || null
      return {
        name: String(member.name || '').trim(),
        dateOfBirth,
        age: dateOfBirth ? calculateAge(dateOfBirth) : (member.age === '' ? null : member.age),
        relationship: finalRel,
        occupation: String(member.occupation || '').trim(),
      }
    })
    .filter((member) => member.name || member.relationship || member.occupation || member.age !== null || member.dateOfBirth)

  const onSubmit = async (data) => {
    const payload = { ...data, familyComposition: cleanFamily() }
    setSaving(true)
    try {
      const duplicateCheck = await api.post('/clients/duplicate-check', payload)
      if (duplicateCheck.data?.duplicateStatus && duplicateCheck.data.duplicateStatus !== 'no_match') {
        setDuplicateModal({
          payload,
          ...duplicateCheck.data,
        })
        return
      }

      const res = await api.post('/clients', payload)
      toast.success('Client profile created')
      navigateAfterSave(res.data.id)
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.matches) {
        setDuplicateModal({
          payload,
          ...err.response.data,
        })
      } else {
        toast.error(err.response?.data?.message || 'Failed to create client profile')
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
      navigateAfterSave(res.data.id)
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
      navigateAfterSave(res.data.id)
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
              <select {...register('religion')} className="portal-input">
                <option value="">Select religion</option>
                {RELIGION_OPTIONS.map((religion) => <option key={religion} value={religion}>{religion}</option>)}
              </select>
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

        {/* Family Composition */}
        <div className="card">
          <div className="form-section-title flex items-center justify-between">
            <span>Family Composition</span>
            <button type="button" onClick={addFamilyMember} className="portal-button-secondary text-xs">
              <PlusIcon className="h-4 w-4" /> Add Member
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Date of Birth</th>
                  <th className="px-3 py-2 text-left">Relationship</th>
                  <th className="px-3 py-2 text-left">Occupation</th>
                  <th className="w-12 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {family.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-3 py-4 text-center text-slate-400">No household members added.</td>
                  </tr>
                ) : family.map((member, index) => {
                  const isStandard = STANDARD_RELATIONSHIPS.includes(member.relationship)
                  const selectVal = isStandard ? member.relationship : (member.relationship ? 'Other' : '')
                  const otherVal = !isStandard && member.relationship !== 'Other' ? (member.relationshipOther || member.relationship) : (member.relationshipOther || '')

                  return (
                    <tr key={index}>
                      <td className="px-3 py-2"><input value={member.name} onChange={(event) => updateFamilyMember(index, 'name', event.target.value)} className="portal-input" placeholder="Full name" /></td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={member.dateOfBirth || ''}
                          onChange={(event) => updateFamilyMember(index, 'dateOfBirth', event.target.value)}
                          className="portal-input"
                        />
                        {member.dateOfBirth && (
                          <p className="mt-1 text-[11px] text-slate-500">Age: {calculateAge(member.dateOfBirth) ?? '-'}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {selectVal === 'Other' ? (
                          <div className="relative flex items-center">
                            <input
                              value={otherVal}
                              onChange={(e) => updateFamilyMember(index, 'relationshipOther', e.target.value)}
                              className="portal-input pr-7"
                              placeholder="Specify (e.g. Live-in Partner)"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                updateFamilyMember(index, 'relationship', '')
                                updateFamilyMember(index, 'relationshipOther', '')
                              }}
                              className="absolute right-2 text-slate-400 hover:text-slate-600 focus:outline-none text-xs"
                              title="Back to dropdown list"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <select
                            value={selectVal}
                            onChange={(event) => {
                              const val = event.target.value
                              if (val === 'Other') {
                                updateFamilyMember(index, 'relationship', 'Other')
                              } else {
                                updateFamilyMember(index, 'relationship', val)
                                updateFamilyMember(index, 'relationshipOther', '')
                              }
                            }}
                            className="portal-input"
                          >
                            <option value="">Select</option>
                            {RELATIONSHIP_OPTIONS.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2"><input value={member.occupation} onChange={(event) => updateFamilyMember(index, 'occupation', event.target.value)} className="portal-input" placeholder="Occupation" /></td>
                      <td className="px-3 py-2 text-center">
                        <button type="button" onClick={() => removeFamilyMember(index)} className="rounded border border-rose-200 p-2 text-rose-600 hover:bg-rose-50" title="Remove member">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
