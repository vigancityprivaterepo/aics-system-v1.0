import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { HospitalIcon } from '../../../components/ui/Icons'
import HospitalFacilityPicker from '../../../components/HospitalFacilityPicker'
import PresetSelectField from '../../../components/PresetSelectField'
import HouseholdMemberQuickFill from '../../../components/HouseholdMemberQuickFill'
import FieldError from '../../../components/ui/FieldError'
import DraftRecoveryBanner from '../../../components/ui/DraftRecoveryBanner'
import {
  DOCTOR_POSITION_OPTIONS,
  HOSPITAL_BILL_TYPE_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from '../../../constants/caseFormOptions'
import { scrollToFirstError } from '../../../lib/formNavigation'
import { formatCurrency } from '../../../lib/utils'
import { useAutosaveDraft, readLocalDraft, clearLocalDraft } from '../../../lib/localDraft'

const GL_MAX = 30000

export default function StepHospitalDetails({ caseData, onUpdate, onNext }) {
  const [saving, setSaving] = useState(false)
  const submitModeRef = useRef('save')
  const draftKey = `case-draft:${caseData.id}:hospital`
  const [draft, setDraft] = useState(() => readLocalDraft(draftKey))
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    mode: 'onBlur',
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

  const formValues = watch()
  useAutosaveDraft(draftKey, { formValues }, { enabled: true })

  const restoreDraft = () => {
    if (!draft) return
    reset(draft.data.formValues)
    setDraft(null)
  }

  const discardDraft = () => {
    clearLocalDraft(draftKey)
    setDraft(null)
  }

  const amount = watch('amount')
  const templateType = watch('templateType')
  const mdPosition = watch('mdPosition')
  const typeOfBill = watch('typeOfBill')
  const conformeRelationship = watch('conformeRelationship')
  const parsedAmount = Number(amount)
  const isOverCap = Number.isFinite(parsedAmount) && parsedAmount > GL_MAX

  const handleFacilitySelect = (facility) => {
    const address = facility.fullAddress || [facility.municipality, facility.province].filter(Boolean).join(', ')
    setValue('hospitalName', facility.facilityName || '', { shouldDirty: true, shouldTouch: true })
    setValue('hospitalAddress', address, { shouldDirty: true, shouldTouch: true })
    setValue('doctorName', facility.doctorName || '', { shouldDirty: true, shouldTouch: true })
    setValue('mdPosition', facility.doctorTitle || '', { shouldDirty: true, shouldTouch: true })
  }
  const handleInvalid = (validationErrors) => {
    scrollToFirstError(validationErrors)
    toast.error('Please complete the required fields first.')
  }
  const onSave = async (data) => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        patientName: data.templateType === 'proxy' ? (data.patientName?.trim() || null) : null,
      }
      const res = await api.put(`/cases/${caseData.id}/hospital`, payload)
      onUpdate({ hospitalDetails: res.data, amount: res.data?.amount ?? data.amount, proxyName: data.conformeName || null, proxyRelationship: data.conformeRelationship || null, status: res.data?.status ?? caseData.status })
      clearLocalDraft(draftKey)
      toast.success(res.data?.approvalsReset ? 'Hospital details saved. Case returned to encoding for re-review.' : 'Hospital details saved')
      if (submitModeRef.current === 'next') {
        onNext?.()
      }
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

      {draft && (
        <DraftRecoveryBanner savedAt={draft.savedAt} onRestore={restoreDraft} onDiscard={discardDraft} />
      )}

      <form onSubmit={handleSubmit(onSave, handleInvalid)} className="space-y-4">
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
          <div className="sm:col-span-2 mt-2 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{templateType === 'proxy' ? 'Patient & Admission Info' : 'Admission Info'}</p>
          </div>

          {templateType === 'proxy' ? (
            <div className="sm:col-span-2">
              <label className="portal-label">Patient Name *</label>
              <input type="text" {...register('patientName', { validate: (value) => templateType !== 'proxy' || String(value ?? '').trim().length > 0 || 'Patient name is required for proxy template' })} className="portal-input" placeholder="Full name of the patient" />
              <FieldError message={errors.patientName?.message} />
            </div>
          ) : (
            <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Patient name will use the client profile for the personal template.
            </div>
          )}
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
            <div data-field-name="hospitalName">
              <input type="hidden" {...register('hospitalName', { required: 'Hospital / facility name is required' })} />
              <HospitalFacilityPicker
                value={watch('hospitalName')}
                onChange={(value) => setValue('hospitalName', value, { shouldDirty: true, shouldTouch: true })}
                onSelect={handleFacilitySelect}
                placeholder="Search hospital or facility..."
              />
            </div>
            <FieldError message={errors.hospitalName?.message} />
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
            <input type="hidden" {...register('mdPosition')} />
            <PresetSelectField
              value={mdPosition}
              onChange={(value) => setValue('mdPosition', value, { shouldDirty: true, shouldTouch: true })}
              options={DOCTOR_POSITION_OPTIONS}
              placeholder="Select doctor position / title"
              otherPlaceholder="Specify doctor position / title"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Type of Bill</label>
            <input type="hidden" {...register('typeOfBill')} />
            <PresetSelectField
              value={typeOfBill}
              onChange={(value) => setValue('typeOfBill', value, { shouldDirty: true, shouldTouch: true })}
              options={HOSPITAL_BILL_TYPE_OPTIONS}
              placeholder="Select bill type"
              otherPlaceholder="Specify bill type"
            />
          </div>

          {/* Sub-section: Representative & Conforme */}
          <div className="sm:col-span-2 mt-4 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Representative &amp; Conforme</p>
          </div>

          <div>
            <label className="portal-label">Conforme Name</label>
            <input type="text" {...register('conformeName')} className="portal-input" placeholder="Full name of representative / next of kin" />
            <HouseholdMemberQuickFill
              members={caseData.familyComposition || []}
              onSelect={(member) => {
                setValue('conformeName', member.name || '', { shouldDirty: true, shouldTouch: true })
                if (member.relationship) setValue('conformeRelationship', member.relationship, { shouldDirty: true, shouldTouch: true })
              }}
            />
          </div>
          <div>
            <label className="portal-label">Relationship to Patient</label>
            <input type="hidden" {...register('conformeRelationship')} />
            <PresetSelectField
              value={conformeRelationship}
              onChange={(value) => setValue('conformeRelationship', value, { shouldDirty: true, shouldTouch: true })}
              options={RELATIONSHIP_OPTIONS}
              placeholder="Select relationship"
              otherPlaceholder="Specify relationship"
            />
          </div>

          {/* Sub-section: Financial Assistance */}
          <div className="sm:col-span-2 mt-4 mb-1 flex items-center gap-2 border-b border-slate-150 pb-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Financial Assistance</p>
          </div>

          <div>
            <label className="portal-label">Guarantee Letter Amount (PHP) *</label>
            <input type="number" min="0" step="any" {...register('amount', { required: 'Amount is required' })} className="portal-input" placeholder="0.00" />
            <p className="mt-1 text-xs text-slate-400">Same amount shown in Case Encoding — saving here updates it there too.</p>
            <FieldError message={errors.amount?.message} />
            {isOverCap && (
              <p className="mt-1 text-xs text-amber-600">                Amount exceeds the maximum cap of {formatCurrency(GL_MAX)} per DSWD MC.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" onClick={() => { submitModeRef.current = 'save' }} disabled={saving} className="portal-button-secondary" id="btn-save-hospital">
            {saving ? 'Saving...' : 'Save Hospital Details'}
          </button>
          <button type="submit" onClick={() => { submitModeRef.current = 'next' }} disabled={saving} className="portal-button-primary" id="btn-save-next-hospital">
            {saving ? 'Saving...' : 'Save and Next'}
          </button>
        </div>
      </form>
    </div>
  )
}


