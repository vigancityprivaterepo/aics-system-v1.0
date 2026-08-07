import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { CrossIcon } from '../../../components/ui/Icons'
import FuneralHomePicker from '../../../components/FuneralHomePicker'
import PresetSelectField from '../../../components/PresetSelectField'
import HouseholdMemberQuickFill from '../../../components/HouseholdMemberQuickFill'
import FieldError from '../../../components/ui/FieldError'
import DraftRecoveryBanner from '../../../components/ui/DraftRecoveryBanner'
import {
  BURIAL_BILL_TYPE_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from '../../../constants/caseFormOptions'
import { scrollToFirstError } from '../../../lib/formNavigation'
import { formatCurrency } from '../../../lib/utils'
import { useAutosaveDraft, readLocalDraft, clearLocalDraft } from '../../../lib/localDraft'

const GL_MAX = 10000
const INTERMENT_PRESETS = [
  'Vigan Public Cemetery',
  'Jardin De Caridad Memorial Park',
  'Vigan Catholic Cemetery',
  'Ayusan Catholic Cemetery',
  'Loyola Cemetery',
]

export default function StepBurialDetails({ caseData, onUpdate, onNext }) {
  const [saving, setSaving] = useState(false)
  const submitModeRef = useRef('save')
  const draftKey = `case-draft:${caseData.id}:burial`
  const [draft, setDraft] = useState(() => readLocalDraft(draftKey))
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    mode: 'onBlur',
    defaultValues: {
      deceasedName: caseData.burialDetails?.deceasedName || '',
      dateOfDeath: caseData.burialDetails?.dateOfDeath || '',
      causeOfDeath: caseData.burialDetails?.causeOfDeath || '',
      funeralHome: caseData.burialDetails?.funeralHome || '',
      funeralHomeOwner: caseData.burialDetails?.funeralHomeOwner || '',
      funeralOwnerAddress: caseData.burialDetails?.funeralOwnerAddress || '',
      typeOfBill: caseData.burialDetails?.typeOfBill || '',
      intermentPlace: caseData.burialDetails?.intermentPlace || '',
      conformeName: caseData.burialDetails?.conformeName || '',
      conformeRelationship: caseData.burialDetails?.conformeRelationship || '',
      amount: caseData.amount ?? '',
    }
  })

  const _existingInterment = caseData.burialDetails?.intermentPlace || ''
  const [intermentPreset, setIntermentPreset] = useState(
    INTERMENT_PRESETS.includes(_existingInterment) ? _existingInterment : (_existingInterment ? 'others' : '')
  )

  const formValues = watch()
  useAutosaveDraft(draftKey, { formValues, intermentPreset }, { enabled: true })

  const restoreDraft = () => {
    if (!draft) return
    reset(draft.data.formValues)
    if (draft.data.intermentPreset) setIntermentPreset(draft.data.intermentPreset)
    setDraft(null)
  }

  const discardDraft = () => {
    clearLocalDraft(draftKey)
    setDraft(null)
  }

  const amount = watch('amount')
  const funeralHomeValue = watch('funeralHome')
  const typeOfBill = watch('typeOfBill')
  const conformeRelationship = watch('conformeRelationship')
  const parsedAmount = Number(amount)
  const isOverCap = Number.isFinite(parsedAmount) && parsedAmount > GL_MAX

  const handleFuneralHomeSelect = (home) => {
    setValue('funeralHome', home.name || '', { shouldDirty: true, shouldTouch: true })
    setValue('funeralHomeOwner', home.ownerName || '', { shouldDirty: true, shouldTouch: true })
    setValue('funeralOwnerAddress', home.address || '', { shouldDirty: true, shouldTouch: true })
  }

  const handleInvalid = (validationErrors) => {
    scrollToFirstError(validationErrors)
    toast.error('Please complete the required fields first.')
  }

  const onSave = async (data) => {
    setSaving(true)
    try {
      const res = await api.put(`/cases/${caseData.id}/burial`, data)
      onUpdate({
        burialDetails: res.data,
        amount: res.data?.amount ?? data.amount,
        beneficiaryName: data.deceasedName || caseData.proxyName || '',
        proxyName: data.conformeName || null,
        proxyRelationship: data.conformeRelationship || null,
        status: res.data?.status ?? caseData.status,
      })
      clearLocalDraft(draftKey)
      toast.success(res.data?.approvalsReset ? 'Burial details saved. Case returned to encoding for re-review.' : 'Burial details saved')
      if (submitModeRef.current === 'next') {
        onNext?.()
      }
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save burial details')
        return
      }
      onUpdate({
        burialDetails: data,
        amount: data.amount,
        beneficiaryName: data.deceasedName || caseData.proxyName || '',
        proxyName: data.conformeName || null,
        proxyRelationship: data.conformeRelationship || null,
      })
      toast.error(err.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="form-section-title flex items-center gap-2">
        <CrossIcon className="h-4 w-4 text-brand-primary" />
        Burial Details &amp; Guarantee Letter
      </div>

      {draft && (
        <DraftRecoveryBanner savedAt={draft.savedAt} onRestore={restoreDraft} onDiscard={discardDraft} />
      )}

      <form onSubmit={handleSubmit(onSave, handleInvalid)} className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-800">Beneficiary: {caseData.beneficiaryName || caseData.burialDetails?.deceasedName || 'No deceased name recorded'}</p>
          <p className="mt-1 text-slate-500">
            Proxy / Requestor: {caseData.burialDetails?.conformeName || caseData.proxyName || `${caseData.client?.firstName || ''} ${caseData.client?.lastName || ''}`.trim() || 'Not recorded'}
            {(caseData.burialDetails?.conformeRelationship || caseData.proxyRelationship) ? ` (${caseData.burialDetails?.conformeRelationship || caseData.proxyRelationship})` : ''}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Sub-section: Deceased Information */}
          <div className="sm:col-span-2 mt-2 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2">
            <span className="text-base">📋</span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Deceased Information</p>
          </div>

          <div className="sm:col-span-2">
            <label className="portal-label">Name of Deceased *</label>
            <input type="text" {...register('deceasedName', { required: 'Name of deceased is required' })} className="portal-input" placeholder="Full name of the deceased" />
            <FieldError message={errors.deceasedName?.message} />
          </div>
          <div>
            <label className="portal-label">Interment Date</label>
            <input type="date" {...register('dateOfDeath')} className="portal-input" />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Cause of Death</label>
            <input type="text" {...register('causeOfDeath')} className="portal-input" placeholder="Cause of death as on death certificate" />
          </div>

          {/* Sub-section: Funeral Home Arrangement */}
          <div className="sm:col-span-2 mt-4 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2">
            <span className="text-base">⚰️</span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Funeral Home Arrangement</p>
          </div>

          <div>
            <label className="portal-label">Funeral Home / Service Provider</label>
            <FuneralHomePicker
              value={funeralHomeValue}
              onChange={(value) => setValue('funeralHome', value, { shouldDirty: true, shouldTouch: true })}
              onSelect={handleFuneralHomeSelect}
              placeholder="Search funeral home or service provider..."
            />
          </div>
          <div>
            <label className="portal-label">Funeral Home Owner</label>
            <input type="text" {...register('funeralHomeOwner')} className="portal-input" placeholder="Owner / Manager name" />
          </div>
          <div>
            <label className="portal-label">Owner / Manager Title</label>
            <input
              type="text"
              className="portal-input bg-slate-50 text-slate-500"
              value="Owner/Manager"
              readOnly
            />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Funeral Home Address</label>
            <input type="text" {...register('funeralOwnerAddress')} className="portal-input" placeholder="City / Municipality, Province" />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Type of Bill</label>
            <input type="hidden" {...register('typeOfBill')} />
            <PresetSelectField
              value={typeOfBill}
              onChange={(value) => setValue('typeOfBill', value, { shouldDirty: true, shouldTouch: true })}
              options={BURIAL_BILL_TYPE_OPTIONS}
              placeholder="Select bill type"
              otherPlaceholder="Specify bill type"
            />
          </div>

          {/* Sub-section: Interment & Representative */}
          <div className="sm:col-span-2 mt-4 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2">
            <span className="text-base">👤</span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Interment &amp; Representative</p>
          </div>

          <div className="sm:col-span-2">
            <label className="portal-label">Place of Interment</label>
            <select
              value={intermentPreset}
              onChange={(e) => {
                setIntermentPreset(e.target.value)
                if (e.target.value !== 'others') setValue('intermentPlace', e.target.value)
                else setValue('intermentPlace', '')
              }}
              className="portal-input"
            >
              <option value="">Select cemetery…</option>
              {INTERMENT_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value="others">Others (specify)</option>
            </select>
            {intermentPreset === 'others' && (
              <input
                type="text"
                {...register('intermentPlace')}
                className="portal-input mt-2"
                placeholder="Specify place of interment"
              />
            )}
          </div>
          <div>
            <label className="portal-label">Conforme Name</label>
            <input type="text" {...register('conformeName')} className="portal-input" placeholder="Full name of representative/next of kin" />
            <HouseholdMemberQuickFill
              members={caseData.familyComposition || []}
              onSelect={(member) => {
                setValue('conformeName', member.name || '', { shouldDirty: true, shouldTouch: true })
                if (member.relationship) setValue('conformeRelationship', member.relationship, { shouldDirty: true, shouldTouch: true })
              }}
            />
          </div>
          <div>
            <label className="portal-label">Relationship to Deceased</label>
            <input type="hidden" {...register('conformeRelationship')} />
            <PresetSelectField
              value={conformeRelationship}
              onChange={(value) => setValue('conformeRelationship', value, { shouldDirty: true, shouldTouch: true })}
              options={RELATIONSHIP_OPTIONS}
              placeholder="Select relationship"
              otherPlaceholder="Specify relationship"
            />
          </div>

          {/* Sub-section: Financial Assistance */}
          <div className="sm:col-span-2 mt-4 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2">
            <span className="text-base">💵</span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Financial Assistance</p>
          </div>

          <div>
            <label className="portal-label">Guarantee Letter Amount (PHP)</label>
            <input type="number" min="0" step="any" {...register('amount', { required: 'Amount is required' })} className="portal-input" placeholder="0.00" />
            <p className="mt-1 text-xs text-slate-400">Same amount shown in Case Encoding — saving here updates it there too.</p>
            <FieldError message={errors.amount?.message} />
            {isOverCap && (
              <p className="mt-1 text-xs text-amber-600">
                Warning: Amount exceeds the maximum cap of {formatCurrency(GL_MAX)} per DSWD MC.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" onClick={() => { submitModeRef.current = 'save' }} disabled={saving} className="portal-button-secondary" id="btn-save-burial">
            {saving ? 'Saving...' : 'Save Burial Details'}
          </button>
          <button type="submit" onClick={() => { submitModeRef.current = 'next' }} disabled={saving} className="portal-button-primary" id="btn-save-next-burial">
            {saving ? 'Saving...' : 'Save and Next'}
          </button>
        </div>
      </form>

    </div>
  )
}





