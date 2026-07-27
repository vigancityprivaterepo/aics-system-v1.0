import { useState } from 'react'
import MedicineTable from '../../../components/MedicineTable'
import { PillIcon } from '../../../components/ui/Icons'
import api from '../../../lib/api'
import toast from 'react-hot-toast'

export default function StepMedicineEncode({ caseData, onUpdate }) {
  const [medicines, setMedicines] = useState(caseData.medicines || [])
  const [amount, setAmount] = useState(caseData.amount ?? '')
  const [templateType, setTemplateType] = useState(caseData.medicineDetails?.templateType || 'personal')
  const [conformeName, setConformeName] = useState(caseData.medicineDetails?.conformeName || '')
  const [conformeRelationship, setConformeRelationship] = useState(caseData.medicineDetails?.conformeRelationship || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const numAmount = parseFloat(amount) || 0
    try {
      const [medicineRes, caseRes] = await Promise.all([
        api.post(`/cases/${caseData.id}/medicines`, { medicines, amount: numAmount }),
        api.put(`/cases/${caseData.id}`, {
          medicineTemplateType: templateType,
          medicineConformeName: conformeName,
          medicineConformeRelationship: conformeRelationship,
        }),
      ])
      onUpdate({
        medicines: medicineRes.data?.medicines ?? medicines,
        amount: medicineRes.data?.totalAmount ?? caseRes.data?.amount ?? numAmount,
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
      onUpdate({ medicines, amount: numAmount })
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
        <div>
          <label className="text-sm font-semibold text-brand-dark block">Medicine Case Study Template</label>
          <select value={templateType} onChange={(e) => setTemplateType(e.target.value)} className="portal-input mt-1 max-w-xs">
            <option value="personal">Personal</option>
            <option value="proxy">Proxy / Representative</option>
          </select>
        </div>

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
      <div className="rounded-xl bg-brand-bg border border-brand-green/20 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label className="text-sm font-semibold text-brand-dark block">Total Amount Requested (PHP) *</label>
            <p className="text-xs text-slate-500">Manually encode the financial assistance amount requested for this medicine case.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-xs">PHP</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="portal-input pl-12 font-mono font-bold text-lg text-brand-primary"
            />
          </div>
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
