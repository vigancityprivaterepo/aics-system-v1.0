import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { FileTextIcon } from '../../../components/ui/Icons'
import { formatCurrency } from '../../../lib/utils'

const GL_MAX = 10000

export default function StepMedicalDetails({ caseData, onUpdate }) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      templateType: caseData.medicalDetails?.templateType || 'personal',
      clinicName: caseData.medicalDetails?.clinicName || '',
      clinicAddress: caseData.medicalDetails?.clinicAddress || '',
      doctorName: caseData.medicalDetails?.doctorName || '',
      mdPosition: caseData.medicalDetails?.mdPosition || '',
      consultationDate: caseData.medicalDetails?.consultationDate || '',
      medicalType: caseData.medicalDetails?.medicalType || '',
      diagnosedType: caseData.medicalDetails?.diagnosedType || '',
      operationType: caseData.medicalDetails?.operationType || '',
      diagnosis: caseData.medicalDetails?.diagnosis || '',
      typeOfBill: caseData.medicalDetails?.typeOfBill || '',
      conformeName: caseData.medicalDetails?.conformeName || '',
      conformeRelationship: caseData.medicalDetails?.conformeRelationship || '',
      amount: caseData.amount ?? '',
    },
  })

  const amount = watch('amount')
  const parsedAmount = Number(amount)
  const isOverCap = Number.isFinite(parsedAmount) && parsedAmount > GL_MAX

  const onSave = async (data) => {
    setSaving(true)
    try {
      const res = await api.put(`/cases/${caseData.id}/medical`, data)
      onUpdate({ medicalDetails: res.data, amount: res.data?.amount ?? data.amount })
      toast.success('Medical details saved')
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save medical details')
        return
      }
      onUpdate({ medicalDetails: data, amount: data.amount })
      toast.success('Saved (demo mode)')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="form-section-title flex items-center gap-2">
        <FileTextIcon className="h-4 w-4 text-brand-primary" />
        Medical Details &amp; Guarantee Letter
      </div>

      <form onSubmit={handleSubmit(onSave)} className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-800">
            Client: {`${caseData.client?.firstName || ''} ${caseData.client?.lastName || ''}`.trim() || 'Not recorded'}
          </p>
        </div>

        <div>
          <label className="portal-label">Template Type</label>
          <div className="mt-1 flex gap-4">
            {['personal', 'proxy'].map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" value={t} {...register('templateType')} className="accent-brand-primary" />
                <span className="capitalize">{t}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="portal-label">Clinic / Facility Name</label>
            <input type="text" {...register('clinicName')} className="portal-input" placeholder="Name of the clinic or facility" />
          </div>
          <div>
            <label className="portal-label">Clinic Address</label>
            <input type="text" {...register('clinicAddress')} className="portal-input" placeholder="City / Municipality, Province" />
          </div>
          <div>
            <label className="portal-label">Doctor Name</label>
            <input type="text" {...register('doctorName')} className="portal-input" placeholder="Attending physician's full name" />
          </div>
          <div>
            <label className="portal-label">Doctor Position / Title</label>
            <input type="text" {...register('mdPosition')} className="portal-input" placeholder="e.g. MD, OB-GYNE, Surgeon" />
          </div>
          <div>
            <label className="portal-label">Consultation Date</label>
            <input type="date" {...register('consultationDate')} className="portal-input" />
          </div>
          <div>
            <label className="portal-label">Type of Bill</label>
            <input type="text" {...register('typeOfBill')} className="portal-input" placeholder="e.g. consultation fee, laboratory" />
          </div>
          <div>
            <label className="portal-label">Medical Type</label>
            <input type="text" {...register('medicalType')} className="portal-input" placeholder="e.g. out-patient, in-patient" />
          </div>
          <div>
            <label className="portal-label">Diagnosed Type</label>
            <input type="text" {...register('diagnosedType')} className="portal-input" placeholder="e.g. chronic, acute" />
          </div>
          <div>
            <label className="portal-label">Operation Type</label>
            <input type="text" {...register('operationType')} className="portal-input" placeholder="e.g. appendectomy (leave blank if none)" />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Diagnosis</label>
            <input type="text" {...register('diagnosis')} className="portal-input" placeholder="Diagnosis as indicated in medical records" />
          </div>
          <div>
            <label className="portal-label">Conforme Name</label>
            <input type="text" {...register('conformeName')} className="portal-input" placeholder="Full name of representative / next of kin" />
          </div>
          <div>
            <label className="portal-label">Relationship to Patient</label>
            <input type="text" {...register('conformeRelationship')} className="portal-input" placeholder="e.g. Mother, Spouse, Self" />
          </div>
          <div>
            <label className="portal-label">Guarantee Letter Amount (PHP)</label>
            <input type="number" min="0" step="any" {...register('amount')} className="portal-input" placeholder="0.00" />
            {isOverCap && (
              <p className="mt-1 text-xs text-amber-600">
                ⚠ Amount exceeds the maximum cap of {formatCurrency(GL_MAX)} per DSWD MC.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="portal-button-primary" id="btn-save-medical">
            {saving ? 'Saving...' : 'Save Medical Details'}
          </button>
        </div>
      </form>
    </div>
  )
}
