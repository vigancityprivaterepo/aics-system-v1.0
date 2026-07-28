import { useState } from 'react'
import MedicineTable from '../../../components/MedicineTable'
import { PillIcon } from '../../../components/ui/Icons'
import api from '../../../lib/api'
import toast from 'react-hot-toast'

export default function StepMedicineEncode({ caseData, onUpdate }) {
  const [medicines, setMedicines] = useState(caseData.medicines || [])
  const [conformeName, setConformeName] = useState(caseData.medicineDetails?.conformeName || '')
  const [conformeRelationship, setConformeRelationship] = useState(caseData.medicineDetails?.conformeRelationship || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const normalizedRelationship = conformeRelationship.trim().toLowerCase()
    const templateType =
      normalizedRelationship === 'self' || (!conformeName.trim() && !normalizedRelationship)
        ? 'personal'
        : 'proxy'
    const medicinePayload = {
      medicines,
      ...(caseData.amount !== null && caseData.amount !== undefined && caseData.amount !== ''
        ? { amount: caseData.amount }
        : {}),
    }
    try {
      const [medicineRes, caseRes] = await Promise.all([
        api.post(`/cases/${caseData.id}/medicines`, medicinePayload),
        api.put(`/cases/${caseData.id}`, {
          medicineTemplateType: templateType,
          medicineConformeName: conformeName,
          medicineConformeRelationship: conformeRelationship,
        }),
      ])
      onUpdate({
        medicines: medicineRes.data?.medicines ?? medicines,
        amount: medicineRes.data?.totalAmount ?? caseRes.data?.amount ?? caseData.amount,
        medicineDetails: {
          ...(caseData.medicineDetails || {}),
          templateType,
          conformeName: conformeName.trim() || null,
          conformeRelationship: conformeRelationship.trim() || null,
        },
        status: caseRes.data?.status ?? medicineRes.data?.status ?? caseData.status,
      })
      toast.success((medicineRes.data?.approvalsReset || caseRes.data?.approvalsReset) ? 'Medicine details saved. Case returned to encoding for re-review.' : 'Medicine details saved')
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save medicines')
        return
      }
      onUpdate({ medicines, amount: caseData.amount })
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

      <MedicineTable
        items={medicines}
        onChange={setMedicines}
      />

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
        <button onClick={handleSave} disabled={saving || medicines.length === 0} className="portal-button-primary" id="btn-save-medicines">
          {saving ? 'Saving...' : 'Save Medicines'}
        </button>
      </div>
    </div>
  )
}
