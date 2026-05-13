import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { FileTextIcon, PlusIcon, TrashIcon } from '../../../components/ui/Icons'
import { formatCurrency } from '../../../lib/utils'

const defaultMember = { name: '', age: '', relationship: '', civilStatus: '', occupation: '', monthlyIncome: '' }
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled']
const RELATIONSHIP_OPTIONS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandson', 'Granddaughter', 'Grandfather', 'Grandmother', 'Uncle', 'Aunt', 'Nephew', 'Niece', 'Son-in-Law', 'Daughter-in-Law', 'Father-in-Law', 'Mother-in-Law', 'Other']

export default function StepPlainDetails({ caseData, onUpdate, readOnly = false }) {
  const [saving, setSaving] = useState(false)
  const [family, setFamily] = useState(caseData.familyComposition || [])

  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      dateOfAssessment: caseData.dateOfAssessment || new Date().toISOString().slice(0, 10),
      presentingProblem: caseData.presentingProblem || '',
      findings: caseData.assessment || caseData.backgroundOfProblem || '',
      amount: caseData.amount ?? '',
    },
  })

  const amount = watch('amount')
  const parsedAmount = Number(amount)
  const isOverCap = Number.isFinite(parsedAmount) && parsedAmount > 35000

  const addFamilyMember = () => setFamily([...family, { ...defaultMember }])
  const removeFamilyMember = (i) => setFamily(family.filter((_, idx) => idx !== i))
  const updateFamilyMember = (i, field, val) =>
    setFamily(family.map((m, idx) => idx === i ? { ...m, [field]: val } : m))

  const onSave = async (data) => {
    setSaving(true)
    try {
      const casePayload = {
        dateOfAssessment: data.dateOfAssessment || null,
        presentingProblem: data.presentingProblem,
        backgroundOfProblem: data.findings,
        assessment: data.findings,
        familyComposition: family,
      }
      const [, plainRes] = await Promise.all([
        api.put(`/cases/${caseData.id}`, casePayload),
        api.put(`/cases/${caseData.id}/plain`, { amount: data.amount }),
      ])
      onUpdate({
        ...casePayload,
        amount: plainRes.data?.amount ?? data.amount,
      })
      toast.success('Plain AICS details saved')
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save details')
        return
      }
      onUpdate({
        dateOfAssessment: data.dateOfAssessment || null,
        presentingProblem: data.presentingProblem,
        backgroundOfProblem: data.findings,
        assessment: data.findings,
        familyComposition: family,
        amount: data.amount,
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
        Plain AICS Input
      </div>

      {readOnly && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          This form is view-only at this stage.
        </div>
      )}

      <form onSubmit={handleSubmit(onSave)}>
      <fieldset disabled={readOnly} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="portal-label">Date of Assessment</label>
            <input
              type="date"
              {...register('dateOfAssessment')}
              className="portal-input"
            />
          </div>
        </div>

        {/* Family Composition */}
        <div>
          <label className="portal-label">Family Composition</label>
          <div className="overflow-x-auto rounded-lg border border-slate-200 mt-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  {['Name', 'Age', 'Relationship', 'Civil Status', 'Occupation', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {family.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">No family members added</td></tr>
                )}
                {family.map((m, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <input type="text" value={m.name || ''} onChange={(e) => updateFamilyMember(i, 'name', e.target.value)} className="portal-input py-1 text-xs" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={m.age || ''} onChange={(e) => updateFamilyMember(i, 'age', e.target.value)} className="portal-input py-1 text-xs" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={m.relationship || ''} onChange={(e) => updateFamilyMember(i, 'relationship', e.target.value)} className="portal-input py-1 text-xs">
                        <option value="">Select</option>
                        {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={m.civilStatus || ''} onChange={(e) => updateFamilyMember(i, 'civilStatus', e.target.value)} className="portal-input py-1 text-xs">
                        <option value="">Select status</option>
                        {CIVIL_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={m.occupation || ''} onChange={(e) => updateFamilyMember(i, 'occupation', e.target.value)} className="portal-input py-1 text-xs" />
                    </td>
                    <td className="px-2 py-1.5">
                      <button type="button" onClick={() => removeFamilyMember(i)} className="text-red-400 hover:text-red-600">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addFamilyMember} className="portal-button-secondary text-xs mt-2">
            <PlusIcon className="h-3.5 w-3.5" /> Add Member
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="portal-label">Presenting Problem</label>
            <textarea
              {...register('presentingProblem')}
              className="portal-input"
              rows={3}
              placeholder="State the client's concern or reason for seeking Plain AICS assistance."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Findings</label>
            <textarea
              {...register('findings')}
              className="portal-input"
              rows={4}
              placeholder="Enter the findings that should be bridged directly to the template."
            />
          </div>
          <div>
            <label className="portal-label">Amount (PHP)</label>
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
                Amount exceeds {formatCurrency(35000)}. Ensure proper authorization.
              </p>
            )}
          </div>
        </div>

      </fieldset>
      {!readOnly && (
        <div className="flex flex-wrap gap-3 mt-4">
          <button type="submit" disabled={saving} className="portal-button-primary" id="btn-save-plain">
            {saving ? 'Saving...' : 'Save Details'}
          </button>
        </div>
      )}
      </form>
    </div>
  )
}
