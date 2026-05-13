import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { CrossIcon } from '../../../components/ui/Icons'
import { formatCurrency } from '../../../lib/utils'

const GL_MAX = 10000
const INTERMENT_PRESETS = [
  'Vigan Public Cemetery',
  'Jardin De Caridad Memorial Park',
  'Vigan Catholic Cemetery',
  'Ayusan Catholic Cemetery',
  'Loyola Cemetery',
]
const FUNERAL_HOME_PRESETS = [
  {
    owner: 'MR. LAWRENCE BAQUIRAN',
    title: 'Owner',
    funeralHome: 'La Funeraria Lawrence Baquiran',
    address: 'Vigan City, Ilocos Sur',
  },
  {
    owner: 'MR. ALFREDO QUITORIANO',
    title: 'Owner/Manager',
    funeralHome: 'Holy Angel Gabriel Funeral Homes',
    address: 'Vigan City, Ilocos Sur',
  },
  {
    owner: 'MR. OSCAR L. PINEDA',
    title: 'Owner/Manager',
    funeralHome: 'Pineda Funeral Services',
    address: 'Bulag Centro, Bantay Ilocos Sur',
  },
  {
    owner: 'MR. JONAS GUY DE LEON',
    title: 'Owner',
    funeralHome: 'Funeraria Singson',
    address: 'Vigan City, Ilocos Sur',
  },
]

export default function StepBurialDetails({ caseData, onUpdate }) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      deceasedName: caseData.burialDetails?.deceasedName || '',
      dateOfDeath: caseData.burialDetails?.dateOfDeath || '',
      causeOfDeath: caseData.burialDetails?.causeOfDeath || '',
      funeralHome: caseData.burialDetails?.funeralHome || '',
      funeralHomeOwner: caseData.burialDetails?.funeralHomeOwner || '',
      funeralOwnerAddress: caseData.burialDetails?.funeralOwnerAddress || '',
      typeOfBill: caseData.burialDetails?.typeOfBill || '',
      intermentPlace: caseData.burialDetails?.intermentPlace || '',
      conformeName: caseData.burialDetails?.conformeName || '',
      conformeRelationship: caseData.burialDetails?.conformeRelationship || '',
      amount: caseData.amount ?? '',
    }
  })

  const _existingInterment = caseData.burialDetails?.intermentPlace || ''
  const [intermentPreset, setIntermentPreset] = useState(
    INTERMENT_PRESETS.includes(_existingInterment) ? _existingInterment : (_existingInterment ? 'others' : '')
  )

  const amount = watch('amount')
  const parsedAmount = Number(amount)
  const isOverCap = Number.isFinite(parsedAmount) && parsedAmount > GL_MAX

  const onSave = async (data) => {
    setSaving(true)
    try {
      const res = await api.put(`/cases/${caseData.id}/burial`, data)
      onUpdate({
        burialDetails: data,
        amount: res.data?.amount ?? data.amount,
        beneficiaryName: data.deceasedName || caseData.proxyName || '',
        proxyRelationship: data.conformeRelationship || null,
      })
      toast.success('Burial details saved')
    } catch (err) {
      if (err.response) {
        toast.error(err.response?.data?.message || 'Failed to save burial details')
        return
      }
      onUpdate({
        burialDetails: data,
        amount: data.amount,
        beneficiaryName: data.deceasedName || caseData.proxyName || '',
        proxyRelationship: data.conformeRelationship || null,
      })
      toast.success('Saved (demo mode)')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="form-section-title flex items-center gap-2">
        <CrossIcon className="h-4 w-4 text-brand-primary" />
        Burial Details &amp; Guarantee Letter
      </div>

      <form onSubmit={handleSubmit(onSave)} className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-800">Beneficiary: {caseData.beneficiaryName || caseData.burialDetails?.deceasedName || 'No deceased name recorded'}</p>
          <p className="mt-1 text-slate-500">
            Proxy / Requestor: {caseData.proxyName || `${caseData.client?.firstName || ''} ${caseData.client?.lastName || ''}`.trim() || 'Not recorded'}
            {caseData.proxyRelationship ? ` (${caseData.proxyRelationship})` : ''}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="portal-label">Name of Deceased</label>
            <input type="text" {...register('deceasedName', { required: true })} className="portal-input" placeholder="Full name of the deceased" />
          </div>
          <div>
            <label className="portal-label">Date of Death</label>
            <input type="date" {...register('dateOfDeath')} className="portal-input" />
          </div>
          <div>
            <label className="portal-label">Funeral Home / Service Provider</label>
            <input type="text" {...register('funeralHome')} className="portal-input" placeholder="Funeral home name" />
          </div>
          <div>
            <label className="portal-label">Funeral Home Preset</label>
            <select
              className="portal-input"
              defaultValue=""
              onChange={(e) => {
                const selected = FUNERAL_HOME_PRESETS.find((item) => item.funeralHome === e.target.value)
                if (!selected) return
                setValue('funeralHome', selected.funeralHome, { shouldDirty: true, shouldTouch: true })
                setValue('funeralHomeOwner', selected.owner, { shouldDirty: true, shouldTouch: true })
                setValue('funeralOwnerAddress', selected.address, { shouldDirty: true, shouldTouch: true })
              }}
            >
              <option value="">Select preset (optional)</option>
              {FUNERAL_HOME_PRESETS.map((item) => (
                <option key={item.funeralHome} value={item.funeralHome}>
                  {item.owner} - {item.funeralHome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="portal-label">Funeral Home Owner</label>
            <input type="text" {...register('funeralHomeOwner')} className="portal-input" placeholder="Owner / Manager name" />
          </div>
          <div>
            <label className="portal-label">Owner / Manager Title</label>
            <input
              type="text"
              className="portal-input bg-slate-50 text-slate-500"
              value="Owner/Manager"
              readOnly
            />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Funeral Home Address</label>
            <input type="text" {...register('funeralOwnerAddress')} className="portal-input" placeholder="City / Municipality, Province" />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Cause of Death</label>
            <input type="text" {...register('causeOfDeath')} className="portal-input" placeholder="Cause of death as on death certificate" />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Type of Bill</label>
            <input type="text" {...register('typeOfBill')} className="portal-input" placeholder="e.g. funeral bill, embalming fee" />
          </div>
          <div className="sm:col-span-2">
            <label className="portal-label">Place of Interment</label>
            <select
              value={intermentPreset}
              onChange={(e) => {
                setIntermentPreset(e.target.value)
                if (e.target.value !== 'others') setValue('intermentPlace', e.target.value)
                else setValue('intermentPlace', '')
              }}
              className="portal-input"
            >
              <option value="">Select cemetery…</option>
              {INTERMENT_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value="others">Others (specify)</option>
            </select>
            {intermentPreset === 'others' && (
              <input
                type="text"
                {...register('intermentPlace')}
                className="portal-input mt-2"
                placeholder="Specify place of interment"
              />
            )}
          </div>
          <div>
            <label className="portal-label">Conforme Name</label>
            <input type="text" {...register('conformeName')} className="portal-input" placeholder="Full name of representative/next of kin" />
          </div>
          <div>
            <label className="portal-label">Relationship to Deceased</label>
            <input type="text" {...register('conformeRelationship')} className="portal-input" placeholder="e.g. Daughter, Son, Spouse" />
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
          <button type="submit" disabled={saving} className="portal-button-primary" id="btn-save-burial">
            {saving ? 'Saving...' : 'Save Burial Details'}
          </button>
        </div>
      </form>

    </div>
  )
}
