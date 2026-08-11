import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { formatDate, calculateAge } from '../../lib/utils'
import { VIGAN_BARANGAYS } from '../../lib/constants'
import { useAuthStore } from '../../store/authStore'
import { ChevronLeftIcon, IdCardIcon, EditIcon, TrashIcon, ClipboardIcon, ArrowRightIcon } from '../../components/ui/Icons'
import StatusBadge from '../../components/ui/StatusBadge'
import ClientSearchBar from '../../components/ClientSearchBar'
import DuplicateReviewModal from '../../components/clients/DuplicateReviewModal'
import { useRfidScanner } from '../../hooks/useRfidScanner'

function normalizeRfidUid(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '')
}

/** Masks a UID like "A1B2C3D4" → "A1••••D4" */
function maskRfidUid(uid) {
  if (!uid || uid.length <= 4) return uid
  const show = 2
  const masked = '•'.repeat(uid.length - show * 2)
  return uid.slice(0, show) + masked + uid.slice(-show)
}

function RfidIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="6" width="20" height="13" rx="2" strokeLinecap="round" />
      <path strokeLinecap="round" d="M15.5 10.5a3 3 0 0 1 0 4" />
      <path strokeLinecap="round" d="M17.5 8.5a6 6 0 0 1 0 8" />
      <rect x="6" y="10" width="5" height="4" rx="0.5" />
    </svg>
  )
}

function RfidEnrollBanner({ label, manualUid, onManualUidChange, onCancel, saving, onSubmit }) {
  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              {saving ? 'Saving card...' : `Ready — tap the RFID card for ${label} now`}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Tap the card, or paste/type the UID from the ACS reader utility below.
            </p>
          </div>
        </div>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xs font-medium">
          Cancel
        </button>
      </div>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={manualUid}
          onChange={(event) => onManualUidChange(event.target.value)}
          placeholder="ACS UID, e.g. 04A1B2C3"
          className="portal-input font-mono uppercase"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={saving || normalizeRfidUid(manualUid).length < 4}
          className="portal-button-green text-sm disabled:opacity-50"
        >
          Enroll
        </button>
      </form>
    </div>
  )
}

function buildCaseDescription(h) {
  const d = h.detail
  if (!d) return null
  switch (h.assistanceType) {
    case 'medicine': {
      if (d.medicines?.length) return `Requested medicine: ${d.medicines.join(', ')}`
      return 'Medicine assistance'
    }
    case 'burial': {
      const parts = []
      if (d.typeOfBill) parts.push(d.typeOfBill)
      if (d.funeralHome) parts.push(`via ${d.funeralHome}`)
      if (d.deceasedName) parts.push(`— deceased: ${d.deceasedName}`)
      return parts.length ? parts.join(' ') : 'Burial assistance'
    }
    case 'hospital': {
      if (d.hospitalName) return `Hospital: ${d.hospitalName}`
      return 'Hospital assistance'
    }
    case 'medical': {
      const parts = []
      if (d.clinicName) parts.push(d.clinicName)
      if (d.doctorName) parts.push(`Dr. ${d.doctorName}`)
      return parts.length ? parts.join(' · ') : 'Medical assistance'
    }
    case 'eyeglass': {
      const parts = []
      if (d.clinicName) parts.push(d.clinicName)
      if (d.doctorName) parts.push(`Dr. ${d.doctorName}`)
      return parts.length ? `Eyeglass — ${parts.join(' · ')}` : 'Eyeglass assistance'
    }
    case 'plain':
      return d.natureOfAssistance
        ? `Financial assistance: ${d.natureOfAssistance}`
        : 'General financial assistance'
    default:
      return null
  }
}

const defaultFamilyMember = { name: '', dateOfBirth: '', age: '', relationship: '', relationshipOther: '', sex: '', occupation: '' }
const FAMILY_SEX_OPTIONS = ['Male', 'Female']
const RELIGION_OPTIONS = ['Roman Catholic', 'Iglesia ni Cristo', 'Islam', 'Born Again Christian', 'Evangelical', 'Protestant', 'Aglipayan', 'Seventh-day Adventist', "Jehovah's Witness", 'Other']
const STANDARD_RELATIONSHIPS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandson', 'Granddaughter', 'Grandfather', 'Grandmother', 'Uncle', 'Aunt', 'Nephew', 'Niece', 'Son-in-Law', 'Daughter-in-Law', 'Father-in-Law', 'Mother-in-Law']
const RELATIONSHIP_OPTIONS = [...STANDARD_RELATIONSHIPS, 'Other']

function toEditForm(client) {
  return {
    lastName: client.lastName ?? '',
    firstName: client.firstName ?? '',
    middleName: client.middleName ?? '',
    dateOfBirth: client.dateOfBirth ?? '',
    sex: client.sex ?? '',
    civilStatus: client.civilStatus ?? '',
    clientCategory: client.clientCategory ?? 'walk-in',
    barangay: client.barangay ?? '',
    municipality: client.municipality ?? 'Vigan City',
    province: client.province ?? 'Ilocos Sur',
    region: client.region ?? 'Region I',
    contactNumber: client.contactNumber ?? '',
    occupation: client.occupation ?? '',
    religion: client.religion ?? '',
    familyComposition: Array.isArray(client.familyComposition)
      ? client.familyComposition.map((m) => {
          const isStd = STANDARD_RELATIONSHIPS.includes(m.relationship)
          return {
            ...m,
            dateOfBirth: m.dateOfBirth ?? '',
            relationshipOther: isStd ? '' : (m.relationship || ''),
            relationship: isStd ? m.relationship : 'Other',
          }
        })
      : [],
  }
}

export default function ClientProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const canEditClientProfile = ['admin', 'employee'].includes(user?.role)

  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const HISTORY_PAGE_SIZE = 5
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [duplicateModal, setDuplicateModal] = useState(null)
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeTarget, setMergeTarget] = useState(null)
  const [mergeNotes, setMergeNotes] = useState('')
  const [merging, setMerging] = useState(false)
  // RFID enrollment state — target is null | { type: 'client' } | { type: 'family', index, name }
  const [rfidEnrollTarget, setRfidEnrollTarget] = useState(null)
  const [rfidSaving, setRfidSaving] = useState(false)
  const [manualRfidUid, setManualRfidUid] = useState('')
  const [form, setForm] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    dateOfBirth: '',
    sex: '',
    civilStatus: '',
    clientCategory: 'walk-in',
    barangay: '',
    municipality: 'Vigan City',
    province: 'Ilocos Sur',
    region: 'Region I',
    contactNumber: '',
    occupation: '',
    religion: '',
    familyComposition: [],
  })

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const res = await api.get(`/clients/${id}`)
        setClient(res.data)
        setForm(toEditForm(res.data))
      } catch (err) {
        toast.error(err.response?.data?.message ?? 'Failed to load client profile.')
        setClient(null)
      } finally {
        setLoading(false)
      }
    }

    fetchClient()
  }, [id])

  const startEdit = () => {
    if (!client || !canEditClientProfile) return
    setForm(toEditForm(client))
    setEditMode(true)
  }

  const cancelEdit = () => {
    if (!client) return
    setForm(toEditForm(client))
    setEditMode(false)
  }


  const addFamilyMember = () => {
    setForm((prev) => ({
      ...prev,
      familyComposition: [...(prev.familyComposition || []), { ...defaultFamilyMember }],
    }))
  }

  const updateFamilyMember = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      familyComposition: (prev.familyComposition || []).map((member, idx) => (
        idx === index ? { ...member, [field]: value } : member
      )),
    }))
  }

  const removeFamilyMember = (index) => {
    setForm((prev) => ({
      ...prev,
      familyComposition: (prev.familyComposition || []).filter((_, idx) => idx !== index),
    }))
  }

  const handleDelete = async () => {
    if (!client || !isAdmin) return
    if (!window.confirm(`Delete client ${client.firstName} ${client.lastName} (${client.caseNumber})? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api.delete(`/clients/${client.id}`)
      toast.success('Client deleted.')
      navigate('/clients')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete client.')
    } finally {
      setDeleting(false)
    }
  }

  const saveEdit = async () => {
    if (!client || !canEditClientProfile) return
    if (!form.lastName.trim() || !form.firstName.trim()) {
      toast.error('First name and last name are required.')
      return
    }

    const payload = {
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || null,
      dateOfBirth: form.dateOfBirth || null,
      sex: form.sex || null,
      civilStatus: form.civilStatus || null,
      clientCategory: form.clientCategory || 'walk-in',
      barangay: form.barangay || null,
      municipality: form.municipality.trim() || null,
      province: form.province.trim() || null,
      region: form.region.trim() || null,
      contactNumber: form.contactNumber.trim() || null,
      occupation: form.occupation.trim() || null,
      religion: form.religion.trim() || null,
      familyComposition: (form.familyComposition || [])
        .map((member) => {
          let finalRel = String(member.relationship || '').trim()
          if (member.relationship === 'Other') {
            finalRel = String(member.relationshipOther || '').trim() || 'Other'
          }
          const dateOfBirth = member.dateOfBirth || null
          return {
            name: String(member.name || '').trim(),
            dateOfBirth,
            age: dateOfBirth ? calculateAge(dateOfBirth) : (member.age === '' ? null : member.age),
            relationship: finalRel,
            sex: member.sex || null,
            occupation: String(member.occupation || '').trim(),
            rfidUid: member.rfidUid ?? null,
          }
        })
        .filter((member) => member.name || member.relationship || member.occupation || member.age !== null || member.dateOfBirth),
    }

    setSaving(true)
    try {
      const res = await api.put(`/clients/${client.id}`, payload)
      setClient(res.data)
      setForm(toEditForm(res.data))
      setEditMode(false)
      toast.success('Client personal info updated.')
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.matches) {
        setDuplicateModal({
          payload,
          ...err.response.data,
        })
      } else {
        toast.error(err.response?.data?.message ?? 'Failed to update client info.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAnyway = async (reason) => {
    if (!client || !canEditClientProfile || !duplicateModal?.payload) return
    setSaving(true)
    try {
      const res = await api.put(`/clients/${client.id}`, {
        ...duplicateModal.payload,
        overrideDuplicateReason: reason,
      })
      setClient(res.data)
      setForm(toEditForm(res.data))
      setEditMode(false)
      setDuplicateModal(null)
      toast.success('Client personal info updated with override.')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update client info.')
    } finally {
      setSaving(false)
    }
  }

  const handleMerge = async () => {
    if (!client || !mergeTarget) return
    if (mergeTarget.id === client.id) {
      toast.error('Select a different client as the merge target.')
      return
    }

    setMerging(true)
    try {
      const res = await api.post(`/clients/${client.id}/merge`, {
        targetClientId: mergeTarget.id,
        notes: mergeNotes.trim() || 'Merged after duplicate review.',
      })
      toast.success('Client merged successfully.')
      navigate(`/clients/${res.data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to merge client.')
    } finally {
      setMerging(false)
    }
  }

  // RFID enrollment — called when scanner fires while rfidEnrollTarget is set
  const handleRfidEnrollScan = useCallback(
    async (rawUid) => {
      const uid = normalizeRfidUid(rawUid)
      if (rfidSaving || !client || !rfidEnrollTarget || uid.length < 4) return
      setRfidSaving(true)
      try {
        const endpoint = rfidEnrollTarget.type === 'family'
          ? `/clients/${client.id}/family/${rfidEnrollTarget.index}/rfid`
          : `/clients/${client.id}/rfid`
        const res = await api.patch(endpoint, { rfidUid: uid })
        setClient(res.data)
        const label = rfidEnrollTarget.type === 'family' ? (rfidEnrollTarget.name || 'family member') : 'client'
        setRfidEnrollTarget(null)
        setManualRfidUid('')
        toast.success(`RFID card enrolled for ${label} (UID: ${uid})`)
      } catch (err) {
        toast.error(err.response?.data?.message ?? 'Failed to enroll RFID card.')
      } finally {
        setRfidSaving(false)
      }
    },
    [client, rfidSaving, rfidEnrollTarget]
  )

  const handleManualRfidEnroll = (event) => {
    event.preventDefault()
    handleRfidEnrollScan(manualRfidUid)
  }

  const handleRfidRemove = async (target) => {
    if (!client) return
    const label = target.type === 'family' ? (target.name || 'this family member') : 'this client'
    if (!window.confirm(`Remove the RFID card from ${label}? They will need to be re-enrolled.`)) return
    setRfidSaving(true)
    try {
      const endpoint = target.type === 'family'
        ? `/clients/${client.id}/family/${target.index}/rfid`
        : `/clients/${client.id}/rfid`
      const res = await api.patch(endpoint, { rfidUid: null })
      setClient(res.data)
      toast.success('RFID card removed.')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to remove RFID card.')
    } finally {
      setRfidSaving(false)
    }
  }

  useRfidScanner({ onScan: handleRfidEnrollScan, enabled: !!rfidEnrollTarget })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="card">
        <p className="text-sm text-slate-500">Client not found.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in mx-auto w-full max-w-[1440px] px-3 sm:px-5 lg:px-8">
      <button onClick={() => navigate('/clients')} className="btn-ghost mb-4 text-sm">
        <ChevronLeftIcon className="h-4 w-4" />
        Back to Clients
      </button>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="portal-kicker">Client Record</p>
          <h1 className="portal-page-title break-words">{client.lastName}, {client.firstName} {client.middleName || ''}</h1>
          <p className="portal-page-subtitle font-mono">{client.caseNumber}</p>
        </div>
        {canEditClientProfile && !editMode && !client.mergedIntoClient && (
          <div className="flex shrink-0 justify-end gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
              title="Edit"
              aria-label="Edit"
            >
              <EditIcon className="h-4 w-4" />
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                title="Delete client"
                aria-label="Delete client"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {client.mergedIntoClient && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-semibold text-amber-900">This client profile has been merged.</p>
          <p className="mt-1 text-sm text-amber-800">
            Redirect active case history to {client.mergedIntoClient.caseNumber} - {client.mergedIntoClient.firstName} {client.mergedIntoClient.lastName}.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/clients/${client.mergedIntoClient.id}`)}
            className="portal-button-secondary mt-3"
          >
            Open surviving profile
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div className="card">
          <div className="form-section-title flex items-center gap-2">
            <IdCardIcon className="h-4 w-4" />
            Personal Information
          </div>
          {!editMode ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
              <p><span className="font-semibold">Date of Birth:</span> {formatDate(client.dateOfBirth)}</p>
              <p><span className="font-semibold">Sex:</span> {client.sex || '-'}</p>
              <p><span className="font-semibold">Civil Status:</span> {client.civilStatus || '-'}</p>
              <p><span className="font-semibold">Occupation:</span> {client.occupation || '-'}</p>
              <p><span className="font-semibold">Religion:</span> {client.religion || '-'}</p>
              <p><span className="font-semibold">Category:</span> {client.clientCategory || '-'}</p>
              <p><span className="font-semibold">Phone:</span> {client.contactNumber || '-'}</p>
              <p className="sm:col-span-2"><span className="font-semibold">Address:</span> {[client.barangay, client.municipality, client.province, client.region].filter(Boolean).join(', ') || '-'}</p>
              <div className="flex flex-wrap gap-2 pt-1 lg:col-span-3">
                {client.is4ps && <span className="badge badge-green">4Ps</span>}
                {client.isPwd && <span className="badge badge-blue">PWD</span>}
                {client.isSenior && <span className="badge badge-amber">Senior Citizen</span>}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="portal-label">Last Name *</label>
                <input
                  className="portal-input"
                  value={form.lastName}
                  onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
              <div>
                <label className="portal-label">First Name *</label>
                <input
                  className="portal-input"
                  value={form.firstName}
                  onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div>
                <label className="portal-label">Middle Name</label>
                <input
                  className="portal-input"
                  value={form.middleName}
                  onChange={(e) => setForm((prev) => ({ ...prev, middleName: e.target.value }))}
                />
              </div>
              <div>
                <label className="portal-label">Date of Birth</label>
                <input
                  type="date"
                  className="portal-input"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                />
              </div>
              <div>
                <label className="portal-label">Sex</label>
                <select
                  className="portal-input"
                  value={form.sex}
                  onChange={(e) => setForm((prev) => ({ ...prev, sex: e.target.value }))}
                >
                  <option value="">Select sex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="portal-label">Civil Status</label>
                <select
                  className="portal-input"
                  value={form.civilStatus}
                  onChange={(e) => setForm((prev) => ({ ...prev, civilStatus: e.target.value }))}
                >
                  <option value="">Select status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                  <option value="Divorced">Divorced</option>
                </select>
              </div>
              <div>
                <label className="portal-label">Occupation</label>
                <input
                  className="portal-input"
                  value={form.occupation}
                  onChange={(e) => setForm((prev) => ({ ...prev, occupation: e.target.value }))}
                  placeholder="e.g. Farmer, Vendor, Unemployed"
                />
              </div>
              <div>
                <label className="portal-label">Religion</label>
                <select
                  className="portal-input"
                  value={form.religion}
                  onChange={(e) => setForm((prev) => ({ ...prev, religion: e.target.value }))}
                >
                  <option value="">Select religion</option>
                  {form.religion && !RELIGION_OPTIONS.includes(form.religion) && <option value={form.religion}>{form.religion}</option>}
                  {RELIGION_OPTIONS.map((religion) => <option key={religion} value={religion}>{religion}</option>)}
                </select>
              </div>
              <div>
                <label className="portal-label">Category</label>
                <select
                  className="portal-input"
                  value={form.clientCategory}
                  onChange={(e) => setForm((prev) => ({ ...prev, clientCategory: e.target.value }))}
                >
                  <option value="walk-in">Walk-in</option>
                  <option value="referred">Referred</option>
                  <option value="rescued">Rescued</option>
                </select>
              </div>
              <div>
                <label className="portal-label">Phone</label>
                <input
                  className="portal-input"
                  value={form.contactNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, contactNumber: e.target.value }))}
                  placeholder="09XXXXXXXXX"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="portal-label">Barangay</label>
                <select
                  className="portal-input"
                  value={form.barangay}
                  onChange={(e) => setForm((prev) => ({ ...prev, barangay: e.target.value }))}
                >
                  <option value="">Select barangay</option>
                  {form.barangay && !VIGAN_BARANGAYS.includes(form.barangay) && <option value={form.barangay}>{form.barangay}</option>}
                  {VIGAN_BARANGAYS.map((barangay) => <option key={barangay} value={barangay}>{barangay}</option>)}
                </select>
              </div>
              <div>
                <label className="portal-label">City / Municipality</label>
                <input
                  className="portal-input bg-slate-50 text-slate-500 cursor-not-allowed"
                  value={form.municipality}
                  onChange={(e) => setForm((prev) => ({ ...prev, municipality: e.target.value }))}
                  readOnly
                />
              </div>
              <div>
                <label className="portal-label">Province</label>
                <input
                  className="portal-input bg-slate-50 text-slate-500 cursor-not-allowed"
                  value={form.province}
                  onChange={(e) => setForm((prev) => ({ ...prev, province: e.target.value }))}
                  readOnly
                />
              </div>
              <div>
                <label className="portal-label">Region</label>
                <input
                  className="portal-input bg-slate-50 text-slate-500 cursor-not-allowed"
                  value={form.region}
                  onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}
                  readOnly
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-4">
        <div className="form-section-title flex items-center justify-between">
          <span>Family Composition</span>
          {editMode && (
            <button type="button" onClick={addFamilyMember} className="portal-button-secondary text-xs">
              Add Member
            </button>
          )}
        </div>

        {!editMode ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Age</th>
                  <th className="px-3 py-2 text-left">Relationship</th>
                  <th className="px-3 py-2 text-left">Sex</th>
                  <th className="px-3 py-2 text-left">Occupation</th>
                  <th className="px-3 py-2 text-left">RFID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {client.familyComposition?.length ? client.familyComposition.map((member, index) => (
                  <tr key={`${member.name || 'member'}-${index}`}>
                    <td className="px-3 py-2 font-medium text-slate-800">{member.name || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{member.dateOfBirth ? (calculateAge(member.dateOfBirth) ?? '-') : (member.age ?? '-')}</td>
                    <td className="px-3 py-2 text-slate-600">{member.relationship || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{member.sex || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{member.occupation || '-'}</td>
                    <td className="px-3 py-2">
                      {!client.mergedIntoClient && (
                        member.rfidUid ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono rounded bg-slate-100 px-1.5 py-0.5 text-[10px] tracking-widest text-slate-600">
                              {maskRfidUid(member.rfidUid)}
                            </span>
                            <button
                              type="button"
                              disabled={rfidSaving}
                              onClick={() => { setManualRfidUid(''); setRfidEnrollTarget({ type: 'family', index, name: member.name }) }}
                              className="text-[11px] font-medium text-brand-primary hover:underline disabled:opacity-50"
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              disabled={rfidSaving}
                              onClick={() => handleRfidRemove({ type: 'family', index, name: member.name })}
                              className="text-[11px] font-medium text-rose-600 hover:underline disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={rfidSaving}
                            onClick={() => { setManualRfidUid(''); setRfidEnrollTarget({ type: 'family', index, name: member.name }) }}
                            className="text-[11px] font-medium text-emerald-700 hover:underline disabled:opacity-50"
                          >
                            + Enroll RFID
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="px-3 py-4 text-center text-slate-400">No household members saved.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {rfidEnrollTarget?.type === 'family' && (
              <div className="p-3 pt-0">
                <RfidEnrollBanner
                  label={rfidEnrollTarget.name || 'this family member'}
                  manualUid={manualRfidUid}
                  onManualUidChange={setManualRfidUid}
                  onCancel={() => setRfidEnrollTarget(null)}
                  saving={rfidSaving}
                  onSubmit={handleManualRfidEnroll}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Date of Birth</th>
                  <th className="px-3 py-2 text-left">Relationship</th>
                  <th className="px-3 py-2 text-left">Sex</th>
                  <th className="px-3 py-2 text-left">Occupation</th>
                  <th className="w-12 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(form.familyComposition || []).length ? form.familyComposition.map((member, index) => {
                  const isStandard = STANDARD_RELATIONSHIPS.includes(member.relationship)
                  const selectVal = isStandard ? member.relationship : (member.relationship ? 'Other' : '')
                  const otherVal = !isStandard && member.relationship !== 'Other' ? (member.relationshipOther || member.relationship) : (member.relationshipOther || '')

                  return (
                    <tr key={index}>
                      <td className="px-3 py-2"><input value={member.name || ''} onChange={(e) => updateFamilyMember(index, 'name', e.target.value)} className="portal-input" /></td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={member.dateOfBirth || ''}
                          onChange={(e) => updateFamilyMember(index, 'dateOfBirth', e.target.value)}
                          className="portal-input"
                        />
                        {member.dateOfBirth && (
                          <p className="mt-1 text-[11px] text-slate-500">Age: {calculateAge(member.dateOfBirth) ?? '-'}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {selectVal === 'Other' ? (
                          <div className="relative flex items-center">
                            <input
                              value={otherVal}
                              onChange={(e) => updateFamilyMember(index, 'relationshipOther', e.target.value)}
                              className="portal-input pr-7"
                              placeholder="Specify (e.g. Live-in Partner)"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                updateFamilyMember(index, 'relationship', '')
                                updateFamilyMember(index, 'relationshipOther', '')
                              }}
                              className="absolute right-2 text-slate-400 hover:text-slate-600 focus:outline-none text-xs"
                              title="Back to dropdown list"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <select
                            value={selectVal}
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === 'Other') {
                                updateFamilyMember(index, 'relationship', 'Other')
                              } else {
                                updateFamilyMember(index, 'relationship', val)
                                updateFamilyMember(index, 'relationshipOther', '')
                              }
                            }}
                            className="portal-input"
                          >
                            <option value="">Select</option>
                            {RELATIONSHIP_OPTIONS.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}
                          </select>
                        )}
                      </td>
                    <td className="px-3 py-2">
                      <select value={member.sex || ''} onChange={(e) => updateFamilyMember(index, 'sex', e.target.value)} className="portal-input">
                        <option value="">Select</option>
                        {FAMILY_SEX_OPTIONS.map((sex) => <option key={sex} value={sex}>{sex}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2"><input value={member.occupation || ''} onChange={(e) => updateFamilyMember(index, 'occupation', e.target.value)} className="portal-input" /></td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => removeFamilyMember(index)} className="rounded border border-rose-200 p-2 text-rose-600 hover:bg-rose-50" title="Remove member">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              }) : (
                  <tr>
                    <td colSpan="6" className="px-3 py-4 text-center text-slate-400">No household members added.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* ── RFID Card Panel ─────────────────────────────────────────── */}
      {!editMode && !client.mergedIntoClient && (
        <div className="card lg:col-span-1">
          <div className="form-section-title flex items-center gap-2 mb-3">
            <RfidIcon />
            RFID Card
          </div>

          {client.rfidUid ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">Enrolled UID:</span>{' '}
                  <span className="font-mono bg-slate-100 rounded px-2 py-0.5 text-xs tracking-widest">
                    {maskRfidUid(client.rfidUid)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-400">Card is active. Tapping this card will instantly find this client.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setManualRfidUid(''); setRfidEnrollTarget({ type: 'client' }) }}
                  disabled={rfidSaving}
                  className="portal-button-secondary text-sm"
                >
                  Replace Card
                </button>
                <button
                  type="button"
                  onClick={() => handleRfidRemove({ type: 'client' })}
                  disabled={rfidSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">No RFID card enrolled</p>
                <p className="mt-1 text-xs text-slate-500">Enroll a card so this client can be found instantly by tapping at the front desk.</p>
              </div>
              {rfidEnrollTarget?.type !== 'client' && (
                <button
                  type="button"
                  onClick={() => { setManualRfidUid(''); setRfidEnrollTarget({ type: 'client' }) }}
                  disabled={rfidSaving}
                  className="portal-button-green text-sm"
                >
                  Enroll RFID Card
                </button>
              )}
            </div>
          )}

          {rfidEnrollTarget?.type === 'client' && (
            <RfidEnrollBanner
              label="this client"
              manualUid={manualRfidUid}
              onManualUidChange={setManualRfidUid}
              onCancel={() => setRfidEnrollTarget(null)}
              saving={rfidSaving}
              onSubmit={handleManualRfidEnroll}
            />
          )}
        </div>
      )}

      {!editMode && (
        <div className="card p-0 overflow-hidden lg:col-span-2">
          <div className="form-section-title flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-100">
            <ClipboardIcon className="h-4 w-4" />
            Case History
          </div>
          {client.history?.length > 0 ? (() => {
            const totalPages = Math.ceil(client.history.length / HISTORY_PAGE_SIZE)
            const pageItems = client.history.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
            return (
              <>
                <ul className="divide-y divide-slate-100">
                  {pageItems.map((h) => {
                    const desc = buildCaseDescription(h)
                    return (
                      <li
                        key={h.id}
                        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => navigate(`/cases/${h.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-brand-primary">{h.caseNumber || '—'}</span>
                            <span className="badge badge-slate capitalize">{h.assistanceType}</span>
                            <StatusBadge status={h.status} />
                          </div>
                          {desc && (
                            <p className="mt-0.5 text-xs text-slate-500 truncate">{desc}</p>
                          )}
                          <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(h.dateOfAssessment) || '—'}</p>
                        </div>
                        <ArrowRightIcon className="h-4 w-4 text-slate-300 shrink-0" />
                      </li>
                    )
                  })}
                </ul>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
                    <span className="text-xs text-slate-400">
                      Page {historyPage} of {totalPages} &mdash; {client.history.length} total
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                        disabled={historyPage === totalPages}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )
          })() : (
            <p className="px-4 py-6 text-sm text-slate-400 italic">No cases on record.</p>
          )}
        </div>
      )}

      {isAdmin && !editMode && !client.mergedIntoClient && (
        <div className="card lg:col-span-3">
          <div className="form-section-title">Duplicate Management</div>
          {!mergeMode ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">Merge this profile into another client</p>
                <p className="mt-1 text-sm text-slate-500">Use this only when both records belong to the same person and you want one surviving history.</p>
              </div>
              <button type="button" onClick={() => setMergeMode(true)} className="portal-button-secondary">
                Start Merge
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <ClientSearchBar
                onSelect={(selected) => setMergeTarget(selected)}
                placeholder="Search the surviving client profile..."
                showRfid={false}
              />


              {mergeTarget && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{mergeTarget.lastName}, {mergeTarget.firstName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {mergeTarget.caseNumber} | {formatDate(mergeTarget.dateOfBirth) || '-'} | {[mergeTarget.barangay, mergeTarget.municipality].filter(Boolean).join(', ') || 'No address'}
                  </p>
                </div>
              )}

              <div>
                <label className="portal-label">Merge notes</label>
                <textarea
                  rows="4"
                  value={mergeNotes}
                  onChange={(event) => setMergeNotes(event.target.value)}
                  className="portal-input"
                  placeholder="State why these two profiles belong to the same person."
                />
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMergeMode(false)
                    setMergeTarget(null)
                    setMergeNotes('')
                  }}
                  className="portal-button-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={merging || !mergeTarget || mergeNotes.trim().length < 3}
                  onClick={handleMerge}
                  className="rounded-lg border border-amber-600 bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                >
                  {merging ? 'Merging...' : 'Merge into selected client'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      </div>

      {canEditClientProfile && editMode && (
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={cancelEdit} className="portal-button-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={saveEdit} className="portal-button-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      <DuplicateReviewModal
        open={!!duplicateModal}
        title="This update matches another client profile"
        message="Review the likely duplicate before saving. If you still need to keep this as a separate record, provide a reason and save anyway."
        matches={duplicateModal?.matches || []}
        saving={saving}
        showUseExisting={false}
        createAnywayLabel="Save anyway"
        onClose={() => setDuplicateModal(null)}
        onCreateAnyway={handleSaveAnyway}
        onViewProfile={(match) => navigate(`/clients/${match.id}`)}
      />
    </div>
  )
}

