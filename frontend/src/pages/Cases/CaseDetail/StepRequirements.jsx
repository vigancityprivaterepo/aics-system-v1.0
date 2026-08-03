import { useState } from 'react'
import RequirementsChecklist from '../../../components/RequirementsChecklist'
import { ClipboardIcon } from '../../../components/ui/Icons'
import api from '../../../lib/api'
import toast from 'react-hot-toast'

export default function StepRequirements({ caseData, onUpdate, locked }) {
  const [saving, setSaving] = useState(false)

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

  return (
    <div className="card">
      <div className="form-section-title flex items-center justify-between">
        <span className="flex items-center gap-2">
          <ClipboardIcon className="h-4 w-4 text-brand-primary" />
          Requirements Checklist
        </span>
        {saving && <span className="text-xs text-slate-400 animate-pulse">Saving...</span>}
      </div>
      <RequirementsChecklist
        assistanceType={caseData.assistanceType}
        requirements={caseData.requirements || {}}
        plainAssistanceKinds={caseData.plainDetails?.assistanceKinds || []}
        onChange={handleChange}
        readOnly={locked}
        variant="cgvTable"
      />
    </div>
  )
}

