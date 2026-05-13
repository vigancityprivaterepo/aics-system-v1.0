import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { FileTextIcon, PlusIcon, TrashIcon } from '../../../components/ui/Icons'
import MedicineTable from '../../../components/MedicineTable'
import { formatCurrency } from '../../../lib/utils'

const defaultMember = { name: '', age: '', relationship: '', civilStatus: '', occupation: '', monthlyIncome: '' }
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled']
const RELATIONSHIP_OPTIONS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandson', 'Granddaughter', 'Grandfather', 'Grandmother', 'Uncle', 'Aunt', 'Nephew', 'Niece', 'Son-in-Law', 'Daughter-in-Law', 'Father-in-Law', 'Mother-in-Law', 'Other']
const GUARANTEE_LETTER_MAX = 10000
const PLAIN_AICS_MAX = 35000

function resolveAmountCap(assistanceType) {
  if (['burial', 'hospital', 'medical', 'eyeglass'].includes(assistanceType)) {
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

export default function StepCaseStudy({ caseData, onUpdate, readOnly = false }) {
  const isMedicine = caseData.assistanceType === 'medicine'
  const isBurial = caseData.assistanceType === 'burial'
  const [family, setFamily] = useState(caseData.familyComposition || [])
  const [medicines, setMedicines] = useState(caseData.medicines || [])
  const [saving, setSaving] = useState(false)
  const [analyzingFindings, setAnalyzingFindings] = useState(false)

  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      dateOfAssessment: caseData.dateOfAssessment || new Date().toISOString().slice(0, 10),
      socialWorkerName: caseData.socialWorkerName || '',
      presentingProblem: caseData.presentingProblem || '',
      findings: caseData.assessment || caseData.backgroundOfProblem || '',
      amount: caseData.amount ?? '',
      deceasedName: caseData.burialDetails?.deceasedName || '',
      deceasedAddress: caseData.burialDetails?.deceasedAddress || '',
      deceasedAge: caseData.burialDetails?.deceasedAge ?? '',
      deceasedOccupation: caseData.burialDetails?.deceasedOccupation || '',
      deceasedCivilStatus: caseData.burialDetails?.deceasedCivilStatus || '',
    },
  })

  const amount = watch('amount')
  const parsedAmount = Number(amount)
  const amountCap = resolveAmountCap(caseData.assistanceType)
  const isOverCap = !isMedicine && amountCap != null && Number.isFinite(parsedAmount) && parsedAmount > amountCap
  const medicineTotal = medicines.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0)

  const addFamilyMember = () => setFamily([...family, { ...defaultMember }])
  const removeFamilyMember = (index) => setFamily(family.filter((_, idx) => idx !== index))
  const updateFamilyMember = (index, field, value) =>
    setFamily(family.map((member, idx) => (idx === index ? { ...member, [field]: value } : member)))

  const handleAnalyzeFindings = async () => {
    const presentingProblem = String(watch('presentingProblem') ?? '').trim()
    if (!presentingProblem) {
      toast.error('Enter the presenting problem first.')
      return
    }

    setAnalyzingFindings(true)
    try {
      const res = await api.post(`/cases/${caseData.id}/generate-findings`, { presentingProblem })
      const nextFindings = String(res.data?.findings ?? '').trim()
      if (!nextFindings) {
        toast.error('Claude did not return any findings draft.')
        return
      }
      setValue('findings', nextFindings, { shouldDirty: true, shouldTouch: true })
      toast.success('Findings draft generated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate findings draft')
    } finally {
      setAnalyzingFindings(false)
    }
  }

  const onSave = async (data) => {
    setSaving(true)

    const casePayload = {
      dateOfAssessment: data.dateOfAssessment || null,
      socialWorkerName: data.socialWorkerName,
      presentingProblem: data.presentingProblem,
      backgroundOfProblem: data.findings,
      assessment: data.findings,
      familyComposition: family,
      amount: isMedicine ? undefined : data.amount,
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
        const [, medicinesRes] = await Promise.all([
          api.put(`/cases/${caseData.id}`, casePayload),
          api.post(`/cases/${caseData.id}/medicines`, { medicines }),
        ])

        const totalAmount = Number(medicinesRes.data?.totalAmount ?? medicineTotal)
        onUpdate({
          ...casePayload,
          medicines: medicinesRes.data?.medicines ?? medicines,
          amount: totalAmount,
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
        })
      } else {
        const res = await api.put(`/cases/${caseData.id}`, casePayload)
        onUpdate({
          ...casePayload,
          amount: res.data?.amount ?? data.amount,
        })
      }

      toast.success('Case study saved')
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save case study')
        return
      }

      onUpdate({
        ...casePayload,
        medicines: isMedicine ? medicines : caseData.medicines,
        amount: isMedicine ? medicineTotal : data.amount,
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
      toast.success('Saved (demo mode)')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="form-section-title flex items-center gap-2">
        <FileTextIcon className="h-4 w-4 text-brand-primary" />
        Uniform Case Study Narrative
      </div>

      {readOnly && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          This case study is view-only at this stage.
        </div>
      )}

      <form onSubmit={handleSubmit(onSave)}>
        <fieldset disabled={readOnly} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="portal-label">Date of Assessment</label>
              <input type="date" {...register('dateOfAssessment')} className="portal-input" />
            </div>
            <div className="sm:col-span-2">
              <label className="portal-label">Employee Name</label>
              <input
                type="text"
                {...register('socialWorkerName')}
                className="portal-input"
                placeholder="Full name of assigned social worker"
              />
            </div>
          </div>

          <div>
            <label className="portal-label">Family Composition</label>
            <div className="mt-1 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    {['Name', 'Age', 'Relationship', 'Civil Status', 'Occupation', ''].map((header) => (
                      <th key={header} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {family.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                        No family members added
                      </td>
                    </tr>
                  )}
                  {family.map((member, index) => (
                    <tr key={index} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={member.name || ''}
                          onChange={(e) => updateFamilyMember(index, 'name', e.target.value)}
                          className="portal-input py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={member.age || ''}
                          onChange={(e) => updateFamilyMember(index, 'age', e.target.value)}
                          className="portal-input py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={member.relationship || ''}
                          onChange={(e) => updateFamilyMember(index, 'relationship', e.target.value)}
                          className="portal-input py-1 text-xs"
                        >
                          <option value="">Select</option>
                          {RELATIONSHIP_OPTIONS.map((relationship) => (
                            <option key={relationship} value={relationship}>
                              {relationship}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={member.civilStatus || ''}
                          onChange={(e) => updateFamilyMember(index, 'civilStatus', e.target.value)}
                          className="portal-input py-1 text-xs"
                        >
                          <option value="">Select status</option>
                          {CIVIL_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={member.occupation || ''}
                          onChange={(e) => updateFamilyMember(index, 'occupation', e.target.value)}
                          className="portal-input py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <button type="button" onClick={() => removeFamilyMember(index)} className="text-red-400 hover:text-red-600">
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!readOnly && (
              <button type="button" onClick={addFamilyMember} className="portal-button-secondary mt-2 text-xs">
                <PlusIcon className="h-3.5 w-3.5" />
                Add Member
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {isBurial && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="form-section-title mb-4">Deceased Information</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="portal-label">Name of the Deceased</label>
                    <input
                      type="text"
                      {...register('deceasedName')}
                      className="portal-input"
                      placeholder="Full name of the deceased"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="portal-label">Address</label>
                    <input
                      type="text"
                      {...register('deceasedAddress')}
                      className="portal-input"
                      placeholder="Home address of the deceased"
                    />
                  </div>
                  <div>
                    <label className="portal-label">Age</label>
                    <input
                      type="number"
                      min="0"
                      {...register('deceasedAge')}
                      className="portal-input"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="portal-label">Civil Status</label>
                    <select {...register('deceasedCivilStatus')} className="portal-input">
                      <option value="">Select status</option>
                      {CIVIL_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="portal-label">Occupation</label>
                    <input
                      type="text"
                      {...register('deceasedOccupation')}
                      className="portal-input"
                      placeholder="Occupation of the deceased"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label className="portal-label">Presenting Problem</label>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={handleAnalyzeFindings}
                    disabled={analyzingFindings}
                    className="portal-button-secondary text-xs"
                  >
                    {analyzingFindings ? 'Generating...' : 'Generate Findings Draft'}
                  </button>
                )}
              </div>
              <textarea
                {...register('presentingProblem')}
                className="portal-input"
                rows={3}
                placeholder="State the client's concern or reason for seeking assistance."
              />
            </div>

            <div>
              <label className="portal-label">Findings / Narrative</label>
              <textarea
                {...register('findings')}
                className="portal-input"
                rows={6}
                placeholder="Write the uniform case study narrative that will map directly into the template findings."
              />
            </div>

            <div>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                The narrative above is used as the uniform template source for case study findings.
              </p>
            </div>
          </div>

          {isMedicine ? (
            <div className="border-t border-slate-200 pt-5">
              <div className="form-section-title mb-4">Medicine Items</div>
              <MedicineTable items={medicines} onChange={setMedicines} readOnly={readOnly} />
            </div>
          ) : (
            <div className="border-t border-slate-200 pt-5">
              <div className="grid grid-cols-1 gap-4 sm:max-w-sm">
                <div>
                  <label className="portal-label">{amountLabelForType(caseData.assistanceType)}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    {...register('amount')}
                    className="portal-input"
                    placeholder="0.00"
                  />
                  {isOverCap && (
                    <p className="mt-1 text-xs text-amber-600">
                      Amount exceeds {formatCurrency(amountCap)}. Ensure proper authorization.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </fieldset>

        {!readOnly && (
          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={saving} className="portal-button-primary" id="btn-save-case-study">
              {saving ? 'Saving...' : 'Save Case Study'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
