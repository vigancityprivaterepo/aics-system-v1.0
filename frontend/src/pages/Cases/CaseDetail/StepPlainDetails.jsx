import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { FileTextIcon } from '../../../components/ui/Icons'
import PresetSelectField from '../../../components/PresetSelectField'
import HouseholdMemberQuickFill from '../../../components/HouseholdMemberQuickFill'
import DraftRecoveryBanner from '../../../components/ui/DraftRecoveryBanner'
import { RELATIONSHIP_OPTIONS } from '../../../constants/caseFormOptions'
import { scrollToFirstError } from '../../../lib/formNavigation'
import { useAutosaveDraft, readLocalDraft, clearLocalDraft } from '../../../lib/localDraft'
import { registerUppercase } from '../../../lib/formHelpers'

export default function StepPlainDetails({ caseData, onUpdate, readOnly = false, onNext }) {
  const [saving, setSaving] = useState(false)
  const submitModeRef = useRef('save')
  const draftKey = `case-draft:${caseData.id}:plain`
  const [draft, setDraft] = useState(() => (readOnly ? null : readLocalDraft(draftKey)))

  const { register, handleSubmit, watch, setValue, reset } = useForm({
    mode: 'onBlur',
    defaultValues: {
      conformeName: caseData.plainDetails?.conformeName || '',
      conformeRelationship: caseData.plainDetails?.conformeRelationship || '',
    },
  })

  const formValues = watch()
  useAutosaveDraft(draftKey, { formValues }, { enabled: !readOnly })

  const restoreDraft = () => {
    if (!draft) return
    reset(draft.data.formValues)
    setDraft(null)
  }

  const discardDraft = () => {
    clearLocalDraft(draftKey)
    setDraft(null)
  }

  const conformeRelationship = watch('conformeRelationship')

  const handleInvalid = (validationErrors) => {
    scrollToFirstError(validationErrors)
    toast.error('Please complete the required fields first.')
  }

  const onSave = async (data) => {
    setSaving(true)
    try {
      const plainRes = await api.put(`/cases/${caseData.id}/plain`, {
        natureOfAssistance: '',
        conformeName: data.conformeName,
        conformeRelationship: data.conformeRelationship,
        // assistanceKinds is now set on the Case Study tab, next to the requirements
        // checklist it drives; pass it through unchanged here so this save doesn't wipe it.
        assistanceKinds: caseData.plainDetails?.assistanceKinds || [],
      })
      onUpdate({
        plainDetails: {
          ...(caseData.plainDetails || {}),
          natureOfAssistance: '',
          conformeName: data.conformeName,
          conformeRelationship: data.conformeRelationship,
        },
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
        plainDetails: {
          ...(caseData.plainDetails || {}),
          natureOfAssistance: '',
          conformeName: data.conformeName,
          conformeRelationship: data.conformeRelationship,
        },
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

      <p className="mb-4 text-xs text-slate-500">
        Date of assessment, family composition, presenting problem/findings, requested assistance type(s), and amount are encoded on the Case Study tab.
      </p>

      {draft && (
        <DraftRecoveryBanner savedAt={draft.savedAt} onRestore={restoreDraft} onDiscard={discardDraft} />
      )}

      <form onSubmit={handleSubmit(onSave, handleInvalid)}>
      <fieldset disabled={readOnly} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="portal-label">Conforme Name</label>
              <input
                type="text"
                {...registerUppercase(register, 'conformeName')}
              className="portal-input"
              placeholder="Enter requesting party if not the beneficiary"
            />
            <HouseholdMemberQuickFill
              members={caseData.familyComposition || []}
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
