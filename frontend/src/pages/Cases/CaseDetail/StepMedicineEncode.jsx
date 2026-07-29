import { useState } from 'react'
import { PillIcon } from '../../../components/ui/Icons'
import api from '../../../lib/api'
import toast from 'react-hot-toast'

export default function StepMedicineEncode({ caseData, onUpdate }) {
  const [conformeName, setConformeName] = useState(caseData.medicineDetails?.conformeName || '')
  const [conformeRelationship, setConformeRelationship] = useState(caseData.medicineDetails?.conformeRelationship || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const normalizedRelationshipValue = conformeRelationship.trim()
    const normalizedRelationship = normalizedRelationshipValue.toLowerCase()
    const normalizedConformeName = conformeName.trim()
    const templateType =
      !normalizedConformeName && (normalizedRelationship === 'self' || !normalizedRelationship)
        ? 'personal'
        : 'proxy'
    try {
      const caseRes = await api.put(`/cases/${caseData.id}`, {
        medicineTemplateType: templateType,
        medicineConformeName: normalizedConformeName,
        medicineConformeRelationship: normalizedRelationshipValue,
      })
      onUpdate({
        amount: caseRes.data?.amount ?? caseData.amount,
        medicineDetails: {
          ...(caseData.medicineDetails || {}),
          templateType,
          conformeName: normalizedConformeName || null,
          conformeRelationship: normalizedRelationshipValue || null,
        },
        proxyName: normalizedConformeName || null,
        proxyRelationship: normalizedRelationshipValue || null,
        status: caseRes.data?.status ?? caseData.status,
      })
      toast.success(caseRes.data?.approvalsReset ? 'Medicine requester saved. Case returned to encoding for re-review.' : 'Medicine requester saved')
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save medicine requester')
        return
      }
      onUpdate({ amount: caseData.amount })
      toast.error(err.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card space-y-6">
      <div className="form-section-title flex items-center gap-2">
        <PillIcon className="h-4 w-4 text-brand-green" />
        Medicine Encoding
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-brand-dark">Requesting Party / Conforme</span>
            <input
              type="text"
              value={conformeName}
              onChange={(e) => setConformeName(e.target.value)}
              className="portal-input mt-1"
              placeholder="Full name of requesting party"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-brand-dark">Relation to Beneficiary</span>
            <input
              type="text"
              value={conformeRelationship}
              onChange={(e) => setConformeRelationship(e.target.value)}
              className="portal-input mt-1"
              placeholder="e.g. Self, Mother, Son, Spouse"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="portal-button-primary" id="btn-save-medicines">
          {saving ? 'Saving...' : 'Save Medicine Requester'}
        </button>
      </div>
    </div>
  )
}

