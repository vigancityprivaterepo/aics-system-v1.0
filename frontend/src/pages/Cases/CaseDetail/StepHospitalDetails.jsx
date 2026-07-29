import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { HospitalIcon } from '../../../components/ui/Icons'
import HospitalFacilityPicker from '../../../components/HospitalFacilityPicker'
import { formatCurrency } from '../../../lib/utils'

const GL_MAX = 30000

export default function StepHospitalDetails({ caseData, onUpdate }) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      templateType: caseData.hospitalDetails?.templateType || 'personal',
      patientName: caseData.hospitalDetails?.patientName || '',
      hospitalName: caseData.hospitalDetails?.hospitalName || '',
      hospitalAddress: caseData.hospitalDetails?.hospitalAddress || '',
      doctorName: caseData.hospitalDetails?.doctorName || '',
      mdPosition: caseData.hospitalDetails?.mdPosition || '',
      admissionDate: caseData.hospitalDetails?.admissionDate || '',
      diagnosis: caseData.hospitalDetails?.diagnosis || '',
      typeOfBill: caseData.hospitalDetails?.typeOfBill || '',
      conformeName: caseData.hospitalDetails?.conformeName || '',
      conformeRelationship: caseData.hospitalDetails?.conformeRelationship || '',
      amount: caseData.amount ?? '',
    },
  })

  const amount = watch('amount')
  const parsedAmount = Number(amount)
  const isOverCap = Number.isFinite(parsedAmount) && parsedAmount > GL_MAX

  const handleFacilitySelect = (facility) => {
    const address = facility.fullAddress || [facility.municipality, facility.province].filter(Boolean).join(', ')
    setValue('hospitalName', facility.facilityName || '', { shouldDirty: true, shouldTouch: true })
    setValue('hospitalAddress', address, { shouldDirty: true, shouldTouch: true })
  }
  const onSave = async (data) => {
    setSaving(true)
    try {
      const res = await api.put(`/cases/${caseData.id}/hospital`, data)
      onUpdate({ hospitalDetails: res.data, amount: res.data?.amount ?? data.amount, proxyName: data.conformeName || null, proxyRelationship: data.conformeRelationship || null, status: res.data?.status ?? caseData.status })
      toast.success(res.data?.approvalsReset ? 'Hospital details saved. Case returned to encoding for re-review.' : 'Hospital details saved')
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save hospital details')
        return
      }
      onUpdate({ hospitalDetails: data, amount: data.amount, proxyName: data.conformeName || null, proxyRelationship: data.conformeRelationship || null })
      toast.error(err.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="form-section-title flex items-center gap-2">
        <HospitalIcon className="h-4 w-4 text-brand-primary" />
        Hospital Details &amp; Guarantee Letter
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
          {/* Sub-section: Patient & Admission Info */}
          <div className="sm:col-span-2 mt-2 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Patient &amp; Admission Info</p>
          </div>

          <div className="sm:col-span-2">
            <label className="portal-label">Patient Name *</label>
            <input type="text" {...register('patientName')} className="portal-input" placeholder="Full name of the patient" />
          </div>
          <div>
            <label className="portal-label">Admission Date</label>
            <input type="date" {...register('admissionDate')} className="portal-input" />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Diagnosis</label>
            <input type="text" {...register('diagnosis')} className="portal-input" placeholder="Diagnosis as indicated in medical records" />
          </div>

          {/* Sub-section: Hospital & Physician Details */}
          <div className="sm:col-span-2 mt-4 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Hospital &amp; Physician Details</p>
          </div>

          <div>
            <label className="portal-label">Hospital / Facility Name *</label>
            <HospitalFacilityPicker
              value={watch('hospitalName')}
              onChange={(value) => setValue('hospitalName', value, { shouldDirty: true, shouldTouch: true })}
              onSelect={handleFacilitySelect}
              placeholder="Search hospital or facility..."
            />
          </div>
          <div>
            <label className="portal-label">Hospital Address</label>
            <input type="text" {...register('hospitalAddress')} className="portal-input" placeholder="City / Municipality, Province" />
          </div>
          <div>
            <label className="portal-label">Doctor Name</label>
            <input type="text" {...register('doctorName')} className="portal-input" placeholder="Attending physician's full name" />
          </div>
          <div>
            <label className="portal-label">Doctor Position / Title</label>
            <input type="text" {...register('mdPosition')} className="portal-input" placeholder="e.g. MD, OB-GYNE, Surgeon" />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Type of Bill</label>
            <input type="text" {...register('typeOfBill')} className="portal-input" placeholder="e.g. hospital bill, room charges" />
          </div>

          {/* Sub-section: Representative & Conforme */}
          <div className="sm:col-span-2 mt-4 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Representative &amp; Conforme</p>
          </div>

          <div>
            <label className="portal-label">Conforme Name</label>
            <input type="text" {...register('conformeName')} className="portal-input" placeholder="Full name of representative / next of kin" />
          </div>
          <div>
            <label className="portal-label">Relationship to Patient</label>
            <input type="text" {...register('conformeRelationship')} className="portal-input" placeholder="e.g. Mother, Spouse, Self" />
          </div>

          {/* Sub-section: Financial Assistance */}
          <div className="sm:col-span-2 mt-4 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Financial Assistance</p>
          </div>

          <div>
            <label className="portal-label">Guarantee Letter Amount (PHP) *</label>
            <input type="number" min="0" step="any" {...register('amount')} className="portal-input" placeholder="0.00" />
            {isOverCap && (
              <p className="mt-1 text-xs text-amber-600">                Amount exceeds the maximum cap of {formatCurrency(GL_MAX)} per DSWD MC.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="portal-button-primary" id="btn-save-hospital">
            {saving ? 'Saving...' : 'Save Hospital Details'}
          </button>
        </div>
      </form>
    </div>
  )
}


