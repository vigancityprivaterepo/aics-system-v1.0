import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { FileTextIcon, PlusIcon, TrashIcon } from '../../../components/ui/Icons'
import NarrativePresetField from '../../../components/NarrativePresetField'
import PresetSelectField from '../../../components/PresetSelectField'
import SearchablePresetInput from '../../../components/SearchablePresetInput'
import HouseholdMemberQuickFill from '../../../components/HouseholdMemberQuickFill'
import FieldError from '../../../components/ui/FieldError'
import DraftRecoveryBanner from '../../../components/ui/DraftRecoveryBanner'
import { OCCUPATION_OPTIONS, RELATIONSHIP_OPTIONS } from '../../../constants/caseFormOptions'
import { scrollToField, scrollToFirstError } from '../../../lib/formNavigation'
import { formatCurrency } from '../../../lib/utils'
import { useAutosaveDraft, readLocalDraft, clearLocalDraft } from '../../../lib/localDraft'
import { registerUppercase } from '../../../lib/formHelpers'

const defaultMember = { name: '', age: '', relationship: '', civilStatus: '', occupation: '', monthlyIncome: '' }
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled']
const PLAIN_ASSISTANCE_KIND_OPTIONS = [
  { value: 'medical', label: 'Medical' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'burial', label: 'Burial' },
]

export default function StepPlainDetails({ caseData, onUpdate, readOnly = false, onNext }) {
  const [saving, setSaving] = useState(false)
  const [family, setFamily] = useState(caseData.familyComposition || [])
  const [assistanceKinds, setAssistanceKinds] = useState(caseData.plainDetails?.assistanceKinds || [])
  const [narrativeOptions, setNarrativeOptions] = useState([])
  const submitModeRef = useRef('save')
  const draftKey = `case-draft:${caseData.id}:plain`
  const [draft, setDraft] = useState(() => (readOnly ? null : readLocalDraft(draftKey)))

  const { control, register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    mode: 'onBlur',
    defaultValues: {
      dateOfAssessment: caseData.dateOfAssessment || new Date().toISOString().slice(0, 10),
      conformeName: caseData.plainDetails?.conformeName || '',
      conformeRelationship: caseData.plainDetails?.conformeRelationship || '',
      presentingProblem: caseData.presentingProblem || '',
      findings: caseData.assessment || caseData.backgroundOfProblem || '',
      amount: caseData.amount ?? '',
    },
  })


  useEffect(() => {
    let active = true
    api.get('/settings/narrative-options', { params: { assistanceType: caseData.assistanceType } })
      .then(({ data }) => { if (active) setNarrativeOptions(data.options || []) })
      .catch(() => {})
    return () => { active = false }
  }, [caseData.assistanceType])

  const formValues = watch()
  useAutosaveDraft(draftKey, { formValues, family, assistanceKinds }, { enabled: !readOnly })

  const restoreDraft = () => {
    if (!draft) return
    reset(draft.data.formValues)
    if (Array.isArray(draft.data.family)) setFamily(draft.data.family)
    if (Array.isArray(draft.data.assistanceKinds)) setAssistanceKinds(draft.data.assistanceKinds)
    setDraft(null)
  }

  const discardDraft = () => {
    clearLocalDraft(draftKey)
    setDraft(null)
  }

  const amount = watch('amount')
  const conformeRelationship = watch('conformeRelationship')
  const parsedAmount = Number(amount)
  const isOverCap = Number.isFinite(parsedAmount) && parsedAmount > 35000

  const addFamilyMember = () => setFamily([...family, { ...defaultMember }])
  const removeFamilyMember = (i) => setFamily(family.filter((_, idx) => idx !== i))
  const updateFamilyMember = (i, field, val) =>
    setFamily(family.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  const toggleAssistanceKind = (kind) => setAssistanceKinds((prev) => (
    prev.includes(kind) ? prev.filter((item) => item !== kind) : [...prev, kind]
  ))

  const handleInvalid = (validationErrors) => {
    scrollToFirstError(validationErrors)
    toast.error('Please complete the required fields first.')
  }

  const onSave = async (data) => {
    setSaving(true)
    try {
      if (!assistanceKinds.length) {
        toast.error('Select at least one requested assistance type.')
        scrollToField('plain-assistance-kinds')
        return
      }
      const casePayload = {
        dateOfAssessment: data.dateOfAssessment || null,
        presentingProblem: data.presentingProblem,
        backgroundOfProblem: data.findings,
        assessment: data.findings,
        familyComposition: family,
      }
      const [, plainRes] = await Promise.all([
        api.put(`/cases/${caseData.id}`, casePayload),
        api.put(`/cases/${caseData.id}/plain`, {
          natureOfAssistance: '',
          conformeName: data.conformeName,
          conformeRelationship: data.conformeRelationship,
          assistanceKinds,
          amount: data.amount,
        }),
      ])
      onUpdate({
        ...casePayload,
        plainDetails: {
          ...(caseData.plainDetails || {}),
          natureOfAssistance: '',
          conformeName: data.conformeName,
          conformeRelationship: data.conformeRelationship,
          assistanceKinds,
        },
        amount: plainRes.data?.amount ?? data.amount,
        status: plainRes.data?.status ?? caseData.status,
      })
      clearLocalDraft(draftKey)
      toast.success(plainRes.data?.approvalsReset ? 'Plain AICS details saved. Case returned to encoding for re-review.' : 'Plain AICS details saved')
      if (submitModeRef.current === 'next') {
        onNext?.()
      }
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save details')
        return
      }
      onUpdate({
        dateOfAssessment: data.dateOfAssessment || null,
        presentingProblem: data.presentingProblem,
        backgroundOfProblem: data.findings,
        assessment: data.findings,
        familyComposition: family,
        plainDetails: {
          ...(caseData.plainDetails || {}),
          natureOfAssistance: '',
          conformeName: data.conformeName,
          conformeRelationship: data.conformeRelationship,
          assistanceKinds,
        },
        amount: data.amount,
      })
      toast.error(err.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="form-section-title flex items-center gap-2">
        <FileTextIcon className="h-4 w-4 text-brand-primary" />
        Plain AICS Input
      </div>

      {readOnly && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          This form is view-only at this stage.
        </div>
      )}

      {draft && (
        <DraftRecoveryBanner savedAt={draft.savedAt} onRestore={restoreDraft} onDiscard={discardDraft} />
      )}

      <form onSubmit={handleSubmit(onSave, handleInvalid)}>
      <fieldset disabled={readOnly} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Sub-section: Assessment Details */}
          <div className="sm:col-span-2 mt-2 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2">
            <span className="text-base">📅</span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Assessment Details</p>
          </div>

          <div className="sm:col-span-2">
            <label className="portal-label">Date of Assessment *</label>
            <input
              type="date"
              {...register('dateOfAssessment', { required: 'Date of assessment is required' })}
              className="portal-input"
            />
            <FieldError message={errors.dateOfAssessment?.message} />
          </div>
        </div>

        {/* Sub-section: Family Composition */}
        <div className="mt-4">
          <div className="flex items-center gap-2 border-b border-slate-150 pb-2 mb-3">
            <span className="text-base">👨‍👩‍👧‍👦</span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Family Composition</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 mt-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  {['Name', 'Age', 'Relationship', 'Civil Status', 'Occupation', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {family.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">No family members added</td></tr>
                )}
                {family.map((m, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <input type="text" value={m.name || ''} onChange={(e) => updateFamilyMember(i, 'name', e.target.value)} className="portal-input py-1 text-xs" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={m.age || ''} onChange={(e) => updateFamilyMember(i, 'age', e.target.value)} className="portal-input py-1 text-xs" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={m.relationship || ''} onChange={(e) => updateFamilyMember(i, 'relationship', e.target.value)} className="portal-input py-1 text-xs">
                        <option value="">Select</option>
                        {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        <option value="Other">Other</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={m.civilStatus || ''} onChange={(e) => updateFamilyMember(i, 'civilStatus', e.target.value)} className="portal-input py-1 text-xs">
                        <option value="">Select status</option>
                        {CIVIL_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <SearchablePresetInput value={m.occupation || ''} onChange={(value) => updateFamilyMember(i, 'occupation', value)} options={OCCUPATION_OPTIONS} placeholder="Search occupation" className="portal-input py-1 text-xs" listId={`plain-family-occupation-${i}`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <button type="button" onClick={() => removeFamilyMember(i)} className="text-red-400 hover:text-red-600">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addFamilyMember} className="portal-button-secondary text-xs mt-2">
            <PlusIcon className="h-3.5 w-3.5" /> Add Member
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
          {/* Sub-section: Findings & Narrative */}
          <div className="sm:col-span-2 mt-2 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2">
            <span className="text-base">📌</span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Findings &amp; Narrative</p>
          </div>

          <div className="sm:col-span-2" data-field-name="plain-assistance-kinds">
            <label className="portal-label">Requested Assistance Type(s)</label>
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {PLAIN_ASSISTANCE_KIND_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={assistanceKinds.includes(option.value)}
                    onChange={() => toggleAssistanceKind(option.value)}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Select the request categories that should be checked in the general Plain AICS report.
            </p>
          </div>
          <div>
            <label className="portal-label">Conforme Name</label>
              <input
                type="text"
                {...registerUppercase(register, 'conformeName')}
              className="portal-input"
              placeholder="Enter requesting party if not the beneficiary"
            />
            <HouseholdMemberQuickFill
              members={family}
              onSelect={(member) => {
                setValue('conformeName', (member.name || '').toUpperCase(), { shouldDirty: true, shouldTouch: true })
                if (member.relationship) setValue('conformeRelationship', member.relationship, { shouldDirty: true, shouldTouch: true })
              }}
            />
          </div>
          <div>
            <label className="portal-label">Relationship to Beneficiary</label>
            <input type="hidden" {...register('conformeRelationship')} />
            <PresetSelectField
              value={conformeRelationship}
              onChange={(value) => setValue('conformeRelationship', value, { shouldDirty: true, shouldTouch: true })}
              options={RELATIONSHIP_OPTIONS}
              placeholder="Select relationship"
              otherPlaceholder="Specify relationship"
              disabled={readOnly}
            />
          </div>
          <div className="sm:col-span-2">
            <Controller name="presentingProblem" control={control} rules={{ validate: (value) => String(value ?? '').replace(/<[^>]*>/g, '').trim().length > 0 || 'Presenting problem is required' }} render={({ field }) => (
              <NarrativePresetField label="Presenting Problem *" value={field.value} onChange={field.onChange} options={narrativeOptions.filter((item) => item.field === 'presenting_problem')} readOnly={readOnly} minHeightClass="min-h-[7rem]" placeholder="State the client's concern or reason for seeking Plain AICS assistance." fieldName={field.name} />
            )} />
            <FieldError message={errors.presentingProblem?.message} />
          </div>
          <div className="sm:col-span-2">
            <Controller name="findings" control={control} rules={{ validate: (value) => String(value ?? '').replace(/<[^>]*>/g, '').trim().length > 0 || 'Findings are required' }} render={({ field }) => (
              <NarrativePresetField label="Findings *" value={field.value} onChange={field.onChange} options={narrativeOptions.filter((item) => item.field === 'findings')} readOnly={readOnly} minHeightClass="min-h-[10rem]" placeholder="Enter the findings that should be bridged directly to the template." fieldName={field.name} />
            )} />
            <FieldError message={errors.findings?.message} />
          </div>

          {/* Sub-section: Financial Assistance */}
          <div className="sm:col-span-2 mt-4 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2">
            <span className="text-base">💵</span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Financial Assistance</p>
          </div>

          <div>
            <label className="portal-label">Amount (PHP) *</label>
            <input
              type="number"
              min="0"
              step="any"
              {...register('amount', { required: 'Amount is required' })}
              className="portal-input"
              placeholder="0.00"
            />
            <FieldError message={errors.amount?.message} />
            {isOverCap && (
              <p className="mt-1 text-xs text-amber-600">
                Amount exceeds {formatCurrency(35000)}. Ensure proper authorization.
              </p>
            )}
          </div>
        </div>

      </fieldset>
      {!readOnly && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" onClick={() => { submitModeRef.current = 'save' }} disabled={saving} className="portal-button-secondary" id="btn-save-plain">
            {saving ? 'Saving...' : 'Save Details'}
          </button>
          <button type="submit" onClick={() => { submitModeRef.current = 'next' }} disabled={saving} className="portal-button-primary" id="btn-save-next-plain">
            {saving ? 'Saving...' : 'Save and Next'}
          </button>
        </div>
      )}
      </form>
    </div>
  )
}

