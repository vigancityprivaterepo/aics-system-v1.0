import { useState } from 'react'
import MedicineTable from '../../../components/MedicineTable'
import { PillIcon } from '../../../components/ui/Icons'
import api from '../../../lib/api'
import toast from 'react-hot-toast'
import { formatCurrency } from '../../../lib/utils'

export default function StepMedicineEncode({ caseData, onUpdate }) {
  const [medicines, setMedicines] = useState(caseData.medicines || [])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const amount = medicines.reduce((s, m) => s + (parseFloat(m.totalPrice) || 0), 0)
    try {
      await api.post(`/cases/${caseData.id}/medicines`, { medicines })
      onUpdate({ medicines, amount })
      toast.success('Medicines saved')
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save medicines')
        return
      }
      onUpdate({ medicines, amount })
      toast.success('Saved (demo mode)')
    } finally {
      setSaving(false)
    }
  }

  const totalAmount = medicines.reduce((s, m) => s + (parseFloat(m.totalPrice) || 0), 0)

  return (
    <div className="card">
      <div className="form-section-title flex items-center gap-2">
        <PillIcon className="h-4 w-4 text-brand-green" />
        Medicine Encoding
      </div>

      <MedicineTable
        items={medicines}
        onChange={setMedicines}
      />

      {medicines.length > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-bg border border-brand-green/20 px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-brand-dark">Total Amount Requested</p>
            <p className="text-xs text-slate-500">Grand total of all medicine items</p>
          </div>
          <p className="text-2xl font-display font-bold text-brand-primary">{formatCurrency(totalAmount)}</p>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button onClick={handleSave} disabled={saving || medicines.length === 0} className="portal-button-primary" id="btn-save-medicines">
          {saving ? 'Saving...' : 'Save Medicines'}
        </button>
      </div>
    </div>
  )
}
