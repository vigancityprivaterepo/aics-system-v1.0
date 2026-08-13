import { useState } from 'react'
import RequirementsChecklist from '../../../components/RequirementsChecklist'
import { ClipboardIcon } from '../../../components/ui/Icons'
import api from '../../../lib/api'
import toast from 'react-hot-toast'

const PLAIN_ASSISTANCE_KIND_OPTIONS = [
  { value: 'medical', label: 'Medical' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'burial', label: 'Burial' },
]

export default function StepRequirements({ caseData, onUpdate, locked, plainAssistanceKinds, onPlainAssistanceKindsChange }) {
  const [saving, setSaving] = useState(false)
  const [savingKinds, setSavingKinds] = useState(false)
  const isPlain = caseData.assistanceType === 'plain'
  const assistanceKinds = plainAssistanceKinds ?? caseData.plainDetails?.assistanceKinds ?? []

  const handleChange = async (updated) => {
    const previous = caseData.requirements || {}
    const previousStatus = caseData.status
    onUpdate({ requirements: updated })
    setSaving(true)
    try {
      const res = await api.put(`/cases/${caseData.id}/requirements`, { requirements: updated })
      onUpdate({
        requirements: res.data?.requirements ?? updated,
        status: res.data?.status ?? previousStatus,
      })
      if (res.data?.approvalsReset) {
        toast.success('Requirements updated. Case returned to encoding for re-review.')
      }
    } catch (err) {
      if (err.response) {
        onUpdate({ requirements: previous, status: previousStatus })
        toast.error(err.response?.data?.message || 'Failed to update requirements')
        return
      }
      toast.error(err.response?.data?.message || 'Failed to update requirements')
    } finally {
      setSaving(false)
    }
  }

  // Saves immediately on toggle (same pattern as the checklist itself above) so a newly
  // checked type unlocks its checklist column right away, with no separate save step.
  const handleAssistanceKindToggle = async (kind) => {
    const previous = assistanceKinds
    const next = previous.includes(kind) ? previous.filter((item) => item !== kind) : [...previous, kind]
    onPlainAssistanceKindsChange?.(next)
    setSavingKinds(true)
    try {
      const res = await api.put(`/cases/${caseData.id}/plain`, {
        natureOfAssistance: '',
        // conformeName/conformeRelationship are owned by the Case Edit tab; pass them
        // through unchanged here so this save doesn't wipe them.
        conformeName: caseData.plainDetails?.conformeName || '',
        conformeRelationship: caseData.plainDetails?.conformeRelationship || '',
        assistanceKinds: next,
      })
      onUpdate({
        plainDetails: { ...(caseData.plainDetails || {}), assistanceKinds: next },
        status: res.data?.status ?? caseData.status,
      })
      if (res.data?.approvalsReset) {
        toast.success('Requested assistance type updated. Case returned to encoding for re-review.')
      }
    } catch (err) {
      onPlainAssistanceKindsChange?.(previous)
      toast.error(err.response?.data?.message || 'Failed to update requested assistance type')
    } finally {
      setSavingKinds(false)
    }
  }

  return (
    <div className="card">
      <div className="form-section-title flex items-center justify-between">
        <span className="flex items-center gap-2">
          <ClipboardIcon className="h-4 w-4 text-brand-primary" />
          Requirements Checklist
        </span>
        {saving && <span className="text-xs text-slate-400 animate-pulse">Saving...</span>}
      </div>

      {isPlain && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3" data-field-name="plain-assistance-kinds">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Requested Assistance Type(s)</p>
            {savingKinds && <span className="text-xs text-slate-400 animate-pulse">Saving...</span>}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Choosing a type unlocks its columns in the checklist below.</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PLAIN_ASSISTANCE_KIND_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={assistanceKinds.includes(option.value)}
                  onChange={() => handleAssistanceKindToggle(option.value)}
                  disabled={locked || savingKinds}
                  className="h-4 w-4 accent-emerald-700"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <RequirementsChecklist
        assistanceType={caseData.assistanceType}
        requirements={caseData.requirements || {}}
        plainAssistanceKinds={assistanceKinds}
        onChange={handleChange}
        readOnly={locked}
        variant="cgvTable"
      />
    </div>
  )
}
