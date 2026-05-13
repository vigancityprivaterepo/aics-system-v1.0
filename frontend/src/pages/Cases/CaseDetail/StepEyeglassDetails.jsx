import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { GlassesIcon } from '../../../components/ui/Icons'

export default function StepEyeglassDetails({ caseData, onUpdate }) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit } = useForm({
    defaultValues: {
      doctorName: caseData.eyeglassDetails?.doctorName || '',
      clinicName: caseData.eyeglassDetails?.clinicName || '',
      clinicAddress: caseData.eyeglassDetails?.clinicAddress || '',
      amount: caseData.amount ?? '',
    },
  })

  const onSave = async (data) => {
    setSaving(true)
    try {
      const res = await api.put(`/cases/${caseData.id}/eyeglass`, data)
      onUpdate({ eyeglassDetails: res.data, amount: res.data?.amount ?? data.amount })
      toast.success('Eyeglass details saved')
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save eyeglass details')
        return
      }
      onUpdate({ eyeglassDetails: data, amount: data.amount })
      toast.success('Saved (demo mode)')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="form-section-title flex items-center gap-2">
        <GlassesIcon className="h-4 w-4 text-brand-primary" />
        Eyeglass Details
      </div>

      <form onSubmit={handleSubmit(onSave)} className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-800">
            Client: {`${caseData.client?.firstName || ''} ${caseData.client?.lastName || ''}`.trim() || 'Not recorded'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="portal-label">Doctor / Optometrist Name</label>
            <input type="text" {...register('doctorName')} className="portal-input" placeholder="Full name of the optometrist or doctor" />
          </div>
          <div>
            <label className="portal-label">Clinic / Optical Shop Name</label>
            <input type="text" {...register('clinicName')} className="portal-input" placeholder="Name of the clinic or optical shop" />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Clinic / Optical Shop Address</label>
            <input type="text" {...register('clinicAddress')} className="portal-input" placeholder="City / Municipality, Province" />
          </div>
          <div>
            <label className="portal-label">Amount (PHP)</label>
            <input type="number" min="0" step="any" {...register('amount')} className="portal-input" placeholder="0.00" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="portal-button-primary" id="btn-save-eyeglass">
            {saving ? 'Saving...' : 'Save Eyeglass Details'}
          </button>
        </div>
      </form>
    </div>
  )
}
