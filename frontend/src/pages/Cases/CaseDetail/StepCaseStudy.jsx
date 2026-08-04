import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { FileTextIcon, PlusIcon, TrashIcon } from '../../../components/ui/Icons'
import MedicineTable from '../../../components/MedicineTable'
import NarrativePresetField from '../../../components/NarrativePresetField'
import SearchablePresetInput from '../../../components/SearchablePresetInput'
import { useAuthStore } from '../../../store/authStore'
import { OCCUPATION_OPTIONS, RELATIONSHIP_OPTIONS } from '../../../constants/caseFormOptions'
import { scrollToFirstError } from '../../../lib/formNavigation'
import { formatCurrency } from '../../../lib/utils'

const defaultMember = { name: '', age: '', relationship: '', civilStatus: '', occupation: '', monthlyIncome: '' }
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled']
const GUARANTEE_LETTER_MAX = 10000
const HOSPITAL_MEDICAL_GL_MAX = 30000
const PLAIN_AICS_MAX = 35000

function normalizeNarrativeText(value) {
  return String(value ?? '')
    .replace(/\u00e2\u20ac\u00a2/g, '-')
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac[\u0153\u009d]/g, '"')
    .replace(/\u00e2\u20ac[\u201c\u201d]/g, '-')
    .replace(/\u00c2\u00b7/g, '-')
    .replace(/\u00c2/g, '')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function resolveAmountCap(assistanceType) {
  if (['hospital', 'medical'].includes(assistanceType)) {
    return HOSPITAL_MEDICAL_GL_MAX
  }
  if (['burial', 'eyeglass'].includes(assistanceType)) {
    return GUARANTEE_LETTER_MAX
  }
  if (assistanceType === 'plain') {
    return PLAIN_AICS_MAX
  }
  return null
}

function amountLabelForType(assistanceType) {
  if (['burial', 'hospital', 'medical', 'eyeglass'].includes(assistanceType)) {
    return 'Guarantee Letter Amount (PHP)'
  }
  return 'Amount (PHP)'
}

function normalizeMedicineRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    isAvailable: row?.isAvailable ?? row?.medicine?.isAvailable ?? true,
  }))
}

function EncodingSectionHeader({ number, title, description }) {
  return (
    <div className="mb-4 flex items-start gap-3 border-b border-slate-200 pb-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">{number}</span>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
    </div>
  )
}
export default function StepCaseStudy({ caseData, onUpdate, readOnly = false, onNext }) {
  const isMedicine = caseData.assistanceType === 'medicine'
  const isBurial = caseData.assistanceType === 'burial'
  const currentUser = useAuthStore((state) => state.user)
  const [family, setFamily] = useState(caseData.familyComposition || [])
  const [medicines, setMedicines] = useState(normalizeMedicineRows(caseData.medicines || []))
  const [saving, setSaving] = useState(false)
  const [narrativeOptions, setNarrativeOptions] = useState([])
  const submitModeRef = useRef('save')

  const { control, register, handleSubmit, watch, setValue, getValues } = useForm({
    defaultValues: {
      dateOfAssessment: caseData.dateOfAssessment || new Date().toISOString().slice(0, 10),
      socialWorkerName: caseData.socialWorkerName || currentUser?.name || '',
      presentingProblem: caseData.presentingProblem || '',
      findings: caseData.assessment || caseData.backgroundOfProblem || '',
      amount: caseData.amount ?? '',
      deceasedName: caseData.burialDetails?.deceasedName || '',
      deceasedAddress: caseData.burialDetails?.deceasedAddress || '',
      deceasedAge: caseData.burialDetails?.deceasedAge ?? '',
      deceasedOccupation: caseData.burialDetails?.deceasedOccupation || '',
      deceasedCivilStatus: caseData.burialDetails?.deceasedCivilStatus || '',
      beneficiaryName: caseData.beneficiaryName || '',
      beneficiaryAge: caseData.beneficiaryAge || '',
      beneficiarySex: caseData.beneficiarySex || '',
      beneficiaryCivilStatus: caseData.beneficiaryCivilStatus || '',
      beneficiaryOccupation: caseData.beneficiaryOccupation || '',
      beneficiaryRequestorName: caseData.beneficiaryRequestorName || '',
      beneficiaryRequestorRelationship: caseData.beneficiaryRequestorRelationship || '',
    },
  })


  useEffect(() => {
    let active = true
    api.get('/settings/narrative-options', { params: { assistanceType: caseData.assistanceType } })
      .then(({ data }) => { if (active) setNarrativeOptions(data.options || []) })
      .catch(() => {})
    return () => { active = false }
  }, [caseData.assistanceType])

  useEffect(() => {
    if (!isMedicine) return
    setMedicines(normalizeMedicineRows(caseData.medicines || []))
  }, [caseData.medicines, isMedicine])

  useEffect(() => {
    if (caseData.socialWorkerName) return
    const fallbackWorkerName = String(currentUser?.name ?? '').trim()
    if (!fallbackWorkerName) return
    if (!String(getValues('socialWorkerName') ?? '').trim()) {
      setValue('socialWorkerName', fallbackWorkerName, { shouldDirty: false, shouldTouch: false })
    }
  }, [caseData.socialWorkerName, currentUser?.name, getValues, setValue])

  const amount = watch('amount')
  const parsedAmount = Number(amount)
  const amountCap = resolveAmountCap(caseData.assistanceType)
  const isOverCap = !isMedicine && amountCap != null && Number.isFinite(parsedAmount) && parsedAmount > amountCap

  const addFamilyMember = () => setFamily([...family, { ...defaultMember }])
  const removeFamilyMember = (index) => setFamily(family.filter((_, idx) => idx !== index))
  const updateFamilyMember = (index, field, value) =>
    setFamily(family.map((member, idx) => (idx === index ? { ...member, [field]: value } : member)))

  const handleInvalid = (validationErrors) => {
    scrollToFirstError(validationErrors)
    toast.error('Please complete the required fields first.')
  }

  const onSave = async (data) => {
    setSaving(true)

    const casePayload = {
      dateOfAssessment: data.dateOfAssessment || null,
      socialWorkerName: data.socialWorkerName,
      presentingProblem: normalizeNarrativeText(data.presentingProblem),
      backgroundOfProblem: normalizeNarrativeText(data.findings),
      assessment: normalizeNarrativeText(data.findings),
      familyComposition: family,
      amount: isMedicine ? undefined : data.amount,
      beneficiaryName: data.beneficiaryName || null,
      beneficiaryAge: data.beneficiaryAge || null,
      beneficiarySex: data.beneficiarySex || null,
      beneficiaryCivilStatus: data.beneficiaryCivilStatus || null,
      beneficiaryOccupation: data.beneficiaryOccupation || null,
      beneficiaryRequestorName: data.beneficiaryRequestorName || null,
      beneficiaryRequestorRelationship: data.beneficiaryRequestorRelationship || null,
    }
    const burialPayload = isBurial
      ? {
          deceasedName: data.deceasedName,
          deceasedAddress: data.deceasedAddress,
          deceasedAge: data.deceasedAge,
          deceasedOccupation: data.deceasedOccupation,
          deceasedCivilStatus: data.deceasedCivilStatus,
          amount: data.amount,
        }
      : null

    try {
      if (isMedicine) {
        const [caseRes, medicinesRes] = await Promise.all([
          api.put(`/cases/${caseData.id}`, casePayload),
          api.post(`/cases/${caseData.id}/medicines`, { medicines, amount: data.amount }),
        ])

        const totalAmount = Number(medicinesRes.data?.totalAmount ?? data.amount)
        onUpdate({
          ...casePayload,
          medicines: normalizeMedicineRows(medicinesRes.data?.medicines ?? medicines),
          amount: totalAmount,
          status: medicinesRes.data?.status ?? caseRes.data?.status ?? caseData.status,
        })
      } else if (isBurial) {
        const [caseRes, burialRes] = await Promise.all([
          api.put(`/cases/${caseData.id}`, casePayload),
          api.put(`/cases/${caseData.id}/burial`, burialPayload),
        ])

        onUpdate({
          ...casePayload,
          amount: caseRes.data?.amount ?? burialRes.data?.amount ?? data.amount,
          burialDetails: burialRes.data,
          beneficiaryName: burialRes.data?.deceasedName || caseData.proxyName || '',
          beneficiaryAddress: burialRes.data?.deceasedAddress || caseData.client?.address || '',
          status: burialRes.data?.status ?? caseRes.data?.status ?? caseData.status,
        })
      } else {
        const res = await api.put(`/cases/${caseData.id}`, casePayload)
        onUpdate({
          ...casePayload,
          amount: res.data?.amount ?? data.amount,
          status: res.data?.status ?? caseData.status,
        })
      }

      toast.success('Case study saved')
      if (submitModeRef.current === 'next') {
        onNext?.()
      }
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save case study')
        return
      }

      onUpdate({
        ...casePayload,
        medicines: isMedicine ? normalizeMedicineRows(medicines) : caseData.medicines,
        amount: data.amount,
        ...(isBurial
          ? {
              burialDetails: {
                ...(caseData.burialDetails || {}),
                ...burialPayload,
              },
              beneficiaryName: data.deceasedName || caseData.proxyName || '',
              beneficiaryAddress: data.deceasedAddress || '',
            }
          : {}),
      })
      toast.error(err.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="mb-5 flex items-start gap-3">
        <FileTextIcon className="mt-0.5 h-5 w-5 text-brand-primary" />
        <div>
          <h2 className="text-base font-semibold text-slate-900">Case Encoding</h2>
          <p className="mt-1 text-sm text-slate-500">Fill out the case study details in order. Each section maps to the generated report.</p>
        </div>
      </div>

      {readOnly && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          This case study is view-only at this stage.
        </div>
      )}

      <form onSubmit={handleSubmit(onSave, handleInvalid)}>
        <fieldset disabled={readOnly} className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <EncodingSectionHeader number="1" title="Assessment Info" description="Set the assessment date and assigned case worker." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="portal-label">Date of Assessment *</label>
                <input type="date" {...register('dateOfAssessment', { required: 'Date of assessment is required' })} className="portal-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="portal-label">Employee Name *</label>
                <input type="text" {...register('socialWorkerName', { required: 'Employee name is required' })} className="portal-input" placeholder="Full name of assigned social worker" />
                <p className="mt-1 text-xs text-slate-500">Auto-filled from the signed-in account. You can adjust it here if needed.</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <EncodingSectionHeader number="2" title="Household Members" description="Add family members included in the case study." />
            <div className="mt-1 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    {['Name', 'Age', 'Relationship', 'Civil Status', 'Occupation', ''].map((header) => (
                      <th key={header} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {family.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">No family members added</td></tr>}
                  {family.map((member, index) => (
                    <tr key={index} className="border-t border-slate-100">
                      <td className="px-2 py-1.5"><input type="text" value={member.name || ''} onChange={(e) => updateFamilyMember(index, 'name', e.target.value)} className="portal-input py-1 text-xs" /></td>
                      <td className="px-2 py-1.5"><input type="number" value={member.age || ''} onChange={(e) => updateFamilyMember(index, 'age', e.target.value)} className="portal-input py-1 text-xs" /></td>
                      <td className="px-2 py-1.5"><select value={member.relationship || ''} onChange={(e) => updateFamilyMember(index, 'relationship', e.target.value)} className="portal-input py-1 text-xs"><option value="">Select</option>{RELATIONSHIP_OPTIONS.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}<option value="Other">Other</option></select></td>
                      <td className="px-2 py-1.5"><select value={member.civilStatus || ''} onChange={(e) => updateFamilyMember(index, 'civilStatus', e.target.value)} className="portal-input py-1 text-xs"><option value="">Select status</option>{CIVIL_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                      <td className="px-2 py-1.5"><SearchablePresetInput value={member.occupation || ''} onChange={(value) => updateFamilyMember(index, 'occupation', value)} options={OCCUPATION_OPTIONS} placeholder="Search occupation" className="portal-input py-1 text-xs" listId={`family-occupation-${index}`} /></td>
                      <td className="px-2 py-1.5"><button type="button" onClick={() => removeFamilyMember(index)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!readOnly && <button type="button" onClick={addFamilyMember} className="portal-button-secondary mt-2 text-xs"><PlusIcon className="h-3.5 w-3.5" />Add Member</button>}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <EncodingSectionHeader number="3" title="Narrative" description="State the concern and write the findings used in the generated report." />
            <div className="grid grid-cols-1 gap-4">
              {isBurial && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <EncodingSectionHeader number="3A" title="Deceased Information" description="Complete this only for burial assistance." />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2"><label className="portal-label">Name of the Deceased</label><input type="text" {...register('deceasedName')} className="portal-input" placeholder="Full name of the deceased" /></div>
                    <div className="sm:col-span-2"><label className="portal-label">Address</label><input type="text" {...register('deceasedAddress')} className="portal-input" placeholder="Home address of the deceased" /></div>
                    <div><label className="portal-label">Age</label><input type="number" min="0" {...register('deceasedAge')} className="portal-input" placeholder="0" /></div>
                    <div><label className="portal-label">Civil Status</label><select {...register('deceasedCivilStatus')} className="portal-input"><option value="">Select status</option>{CIVIL_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                    <div className="sm:col-span-2"><label className="portal-label">Occupation</label><SearchablePresetInput value={watch('deceasedOccupation') || ''} onChange={(value) => setValue('deceasedOccupation', value, { shouldDirty: true, shouldTouch: true })} options={OCCUPATION_OPTIONS} placeholder="Search occupation" /></div>
                  </div>
                </div>
              )}
              {!isBurial && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <EncodingSectionHeader number="3A" title="Beneficiary" description="Only fill this in if the assistance is for someone other than the client (e.g. a household member) - otherwise leave blank." />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2"><label className="portal-label">Beneficiary Name</label><input type="text" {...register('beneficiaryName')} className="portal-input" placeholder="Leave blank if the beneficiary is the client" /></div>
                    <div><label className="portal-label">Age</label><input type="number" min="0" {...register('beneficiaryAge')} className="portal-input" placeholder="0" /></div>
                    <div><label className="portal-label">Sex</label><select {...register('beneficiarySex')} className="portal-input"><option value="">Select sex</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
                    <div><label className="portal-label">Civil Status</label><select {...register('beneficiaryCivilStatus')} className="portal-input"><option value="">Select status</option>{CIVIL_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                    <div><label className="portal-label">Occupation</label><SearchablePresetInput value={watch('beneficiaryOccupation') || ''} onChange={(value) => setValue('beneficiaryOccupation', value, { shouldDirty: true, shouldTouch: true })} options={OCCUPATION_OPTIONS} placeholder="Search occupation" /></div>
                    <div><label className="portal-label">Requesting Party</label><input type="text" {...register('beneficiaryRequestorName')} className="portal-input" placeholder="Who is filing this on the beneficiary's behalf" /></div>
                    <div><label className="portal-label">Requesting Party's Relationship to Beneficiary</label><select {...register('beneficiaryRequestorRelationship')} className="portal-input"><option value="">Select</option>{RELATIONSHIP_OPTIONS.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}</select></div>
                  </div>
                </div>
              )}
              <div>
                <Controller name="presentingProblem" control={control} rules={{ validate: (value) => String(value ?? '').replace(/<[^>]*>/g, '').trim().length > 0 || 'Presenting problem is required' }} render={({ field }) => <NarrativePresetField label="Presenting Problem *" value={field.value} onChange={field.onChange} options={narrativeOptions.filter((item) => item.field === 'presenting_problem')} readOnly={readOnly} minHeightClass="min-h-[7rem]" placeholder="State the client's concern or reason for seeking assistance." fieldName={field.name} />} />
              </div>
              <div>
                <Controller name="findings" control={control} rules={{ validate: (value) => String(value ?? '').replace(/<[^>]*>/g, '').trim().length > 0 || 'Findings are required' }} render={({ field }) => <NarrativePresetField label="Findings / Narrative *" value={field.value} onChange={field.onChange} options={narrativeOptions.filter((item) => item.field === 'findings')} readOnly={readOnly} minHeightClass="min-h-[12rem]" placeholder="Write the case study findings used in the generated report." fieldName={field.name} />} />
              </div>
            </div>
          </section>

          {isMedicine ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <EncodingSectionHeader number="4" title="Medicine Items" description="Encode prescribed medicines and quantities for this assistance." />
              <MedicineTable items={medicines} onChange={setMedicines} readOnly={readOnly} />
              <div className="mt-5 border-t border-slate-200 pt-4 sm:max-w-sm">
                <label className="portal-label">Total Amount Requested (PHP) *</label>
                <input type="number" min="0" step="0.01" required {...register('amount', { required: 'Amount is required' })} className="portal-input" placeholder="0.00" />
                <p className="mt-1 text-xs text-slate-500">Manually encode the financial assistance amount requested for this medicine case.</p>
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-slate-200 bg-white p-4"><EncodingSectionHeader number="4" title="Assistance Amount" description="Enter the amount for the guarantee letter or cash assistance." /><div className="grid grid-cols-1 gap-4 sm:max-w-sm"><div><label className="portal-label">{amountLabelForType(caseData.assistanceType)} *</label><input type="number" min="0" step="any" {...register('amount', { required: 'Amount is required' })} className="portal-input" placeholder="0.00" />{isOverCap && <p className="mt-1 text-xs text-amber-600">Amount exceeds {formatCurrency(amountCap)}. Ensure proper authorization.</p>}</div></div></section>
          )}
        </fieldset>
        {!readOnly && <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="submit" onClick={() => { submitModeRef.current = 'save' }} disabled={saving} className="portal-button-secondary" id="btn-save-case-study">{saving ? 'Saving...' : 'Save Case Encoding'}</button><button type="submit" onClick={() => { submitModeRef.current = 'next' }} disabled={saving} className="portal-button-primary" id="btn-save-next-case-study">{saving ? 'Saving...' : 'Save and Next'}</button></div>}
      </form>
    </div>
  )
}
