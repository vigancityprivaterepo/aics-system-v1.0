import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { GlassesIcon } from '../../../components/ui/Icons'
import HouseholdMemberQuickFill from '../../../components/HouseholdMemberQuickFill'
import FieldError from '../../../components/ui/FieldError'
import DraftRecoveryBanner from '../../../components/ui/DraftRecoveryBanner'
import { scrollToFirstError } from '../../../lib/formNavigation'
import { useAutosaveDraft, readLocalDraft, clearLocalDraft } from '../../../lib/localDraft'

export default function StepEyeglassDetails({ caseData, onUpdate, onNext }) {
  const [saving, setSaving] = useState(false)
  const submitModeRef = useRef('save')
  const draftKey = `case-draft:${caseData.id}:eyeglass`
  const [draft, setDraft] = useState(() => readLocalDraft(draftKey))
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    mode: 'onBlur',
    defaultValues: {
      doctorName: caseData.eyeglassDetails?.doctorName || '',
      clinicName: caseData.eyeglassDetails?.clinicName || '',
      clinicAddress: caseData.eyeglassDetails?.clinicAddress || '',
      conformeName: caseData.eyeglassDetails?.conformeName || '',
      conformeRelationship: caseData.eyeglassDetails?.conformeRelationship || '',
      amount: caseData.amount ?? '',
    },
  })

  const formValues = watch()
  useAutosaveDraft(draftKey, { formValues }, { enabled: true })

  const restoreDraft = () => {
    if (!draft) return
    reset(draft.data.formValues)
    setDraft(null)
  }

  const discardDraft = () => {
    clearLocalDraft(draftKey)
    setDraft(null)
  }

  const handleInvalid = (validationErrors) => {
    scrollToFirstError(validationErrors)
    toast.error('Please complete the required fields first.')
  }

  const onSave = async (data) => {
    setSaving(true)
    try {
      const res = await api.put(`/cases/${caseData.id}/eyeglass`, data)
      onUpdate({ eyeglassDetails: res.data, amount: res.data?.amount ?? data.amount, proxyName: data.conformeName || null, proxyRelationship: data.conformeRelationship || null, status: res.data?.status ?? caseData.status })
      clearLocalDraft(draftKey)
      toast.success(res.data?.approvalsReset ? 'Eyeglass details saved. Case returned to encoding for re-review.' : 'Eyeglass details saved')
      if (submitModeRef.current === 'next') {
        onNext?.()
      }
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save eyeglass details')
        return
      }
      onUpdate({ eyeglassDetails: data, amount: data.amount, proxyName: data.conformeName || null, proxyRelationship: data.conformeRelationship || null })
      toast.error(err.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="form-section-title flex items-center gap-2">
        <GlassesIcon className="h-4 w-4 text-brand-primary" />
        Eyeglass Details
      </div>

      {draft && (
        <DraftRecoveryBanner savedAt={draft.savedAt} onRestore={restoreDraft} onDiscard={discardDraft} />
      )}

      <form onSubmit={handleSubmit(onSave, handleInvalid)} className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-800">
            Client: {`${caseData.client?.firstName || ''} ${caseData.client?.lastName || ''}`.trim() || 'Not recorded'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Sub-section: Clinic & Optometrist Info */}
          <div className="sm:col-span-2 mt-2 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2">
            <span className="text-base">👓</span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Clinic &amp; Optometrist Info</p>
          </div>

          <div>
            <label className="portal-label">Doctor / Optometrist Name *</label>
            <input type="text" {...register('doctorName', { required: 'Doctor / optometrist name is required' })} className="portal-input" placeholder="Full name of the optometrist or doctor" />
            <FieldError message={errors.doctorName?.message} />
          </div>
          <div>
            <label className="portal-label">Clinic / Optical Shop Name</label>
            <input type="text" {...register('clinicName')} className="portal-input" placeholder="Name of the clinic or optical shop" />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Clinic / Optical Shop Address</label>
            <input type="text" {...register('clinicAddress')} className="portal-input" placeholder="City / Municipality, Province" />
          </div>


          {/* Sub-section: Representative & Conforme */}
          <div className="sm:col-span-2 mt-4 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Representative &amp; Conforme</p>
          </div>

          <div>
            <label className="portal-label">Conforme Name</label>
            <input type="text" {...register('conformeName')} className="portal-input" placeholder="Full name of representative / next of kin" />
            <HouseholdMemberQuickFill
              members={caseData.familyComposition || []}
              onSelect={(member) => {
                setValue('conformeName', member.name || '', { shouldDirty: true, shouldTouch: true })
                if (member.relationship) setValue('conformeRelationship', member.relationship, { shouldDirty: true, shouldTouch: true })
              }}
            />
          </div>
          <div>
            <label className="portal-label">Relationship to Patient</label>
            <input type="text" {...register('conformeRelationship')} className="portal-input" placeholder="e.g. Mother, Spouse, Self" />
          </div>
          {/* Sub-section: Financial Assistance */}
          <div className="sm:col-span-2 mt-4 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2">
            <span className="text-base">💵</span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Financial Assistance</p>
          </div>

          <div>
            <label className="portal-label">Amount (PHP) *</label>
            <input type="number" min="0" step="any" {...register('amount', { required: 'Amount is required' })} className="portal-input" placeholder="0.00" />
            <p className="mt-1 text-xs text-slate-400">Same amount shown in Case Encoding — saving here updates it there too.</p>
            <FieldError message={errors.amount?.message} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" onClick={() => { submitModeRef.current = 'save' }} disabled={saving} className="portal-button-secondary" id="btn-save-eyeglass">
            {saving ? 'Saving...' : 'Save Eyeglass Details'}
          </button>
          <button type="submit" onClick={() => { submitModeRef.current = 'next' }} disabled={saving} className="portal-button-primary" id="btn-save-next-eyeglass">
            {saving ? 'Saving...' : 'Save and Next'}
          </button>
        </div>
      </form>
    </div>
  )
}




