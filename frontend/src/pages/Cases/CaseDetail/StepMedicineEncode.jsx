import { useState } from 'react'
import MedicineTable from '../../../components/MedicineTable'
import { PillIcon } from '../../../components/ui/Icons'
import api from '../../../lib/api'
import toast from 'react-hot-toast'

export default function StepMedicineEncode({ caseData, onUpdate }) {
  const [medicines, setMedicines] = useState(caseData.medicines || [])
  const [amount, setAmount] = useState(caseData.amount ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const numAmount = parseFloat(amount) || 0
    try {
      const res = await api.post(`/cases/${caseData.id}/medicines`, { medicines, amount: numAmount })
      onUpdate({
        medicines: res.data?.medicines ?? medicines,
        amount: res.data?.totalAmount ?? numAmount,
        status: res.data?.status ?? caseData.status,
      })
      toast.success(res.data?.approvalsReset ? 'Medicines saved. Case returned to encoding for re-review.' : 'Medicines and total amount saved')
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

      <div className="rounded-xl bg-brand-bg border border-brand-green/20 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label className="text-sm font-semibold text-brand-dark block">Total Amount Requested (PHP) *</label>
            <p className="text-xs text-slate-500">Manually encode the financial assistance amount requested for this medicine case.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">₱</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="portal-input pl-8 font-mono font-bold text-lg text-brand-primary"
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
