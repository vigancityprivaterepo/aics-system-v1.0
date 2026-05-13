import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { formatDate } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'
import { ChevronLeftIcon, IdCardIcon, PhoneIcon, MapPinIcon, EditIcon, TrashIcon, ClipboardIcon, ArrowRightIcon } from '../../components/ui/Icons'
import StatusBadge from '../../components/ui/StatusBadge'
import ClientSearchBar from '../../components/ClientSearchBar'
import DuplicateReviewModal from '../../components/clients/DuplicateReviewModal'

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

function toEditForm(client) {
  return {
    lastName: client.lastName ?? '',
    firstName: client.firstName ?? '',
    middleName: client.middleName ?? '',
    dateOfBirth: client.dateOfBirth ?? '',
    sex: client.sex ?? '',
    civilStatus: client.civilStatus ?? '',
    clientCategory: client.clientCategory ?? 'walk-in',
    contactNumber: client.contactNumber ?? '',
    occupation: client.occupation ?? '',
    religion: client.religion ?? '',
  }
}

export default function ClientProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

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
  const [form, setForm] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    dateOfBirth: '',
    sex: '',
    civilStatus: '',
    clientCategory: 'walk-in',
    contactNumber: '',
    occupation: '',
    religion: '',
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
    if (!client || !isAdmin) return
    setForm(toEditForm(client))
    setEditMode(true)
  }

  const cancelEdit = () => {
    if (!client) return
    setForm(toEditForm(client))
    setEditMode(false)
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
    if (!client || !isAdmin) return
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
      contactNumber: form.contactNumber.trim() || null,
      occupation: form.occupation.trim() || null,
      religion: form.religion.trim() || null,
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
    if (!client || !duplicateModal?.payload) return
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
    <div className="animate-fade-in mx-auto max-w-4xl">
      <button onClick={() => navigate('/clients')} className="btn-ghost mb-4 text-sm">
        <ChevronLeftIcon className="h-4 w-4" />
        Back to Clients
      </button>

      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="portal-kicker">Client Record</p>
          <h1 className="portal-page-title">{client.lastName}, {client.firstName} {client.middleName || ''}</h1>
          <p className="portal-page-subtitle font-mono">{client.caseNumber}</p>
        </div>
        {isAdmin && !editMode && !client.mergedIntoClient && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
              title="Edit"
              aria-label="Edit"
            >
              <EditIcon className="h-4 w-4" />
            </button>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card">
          <div className="form-section-title flex items-center gap-2">
            <IdCardIcon className="h-4 w-4" />
            Personal Information
          </div>
          {!editMode ? (
            <div className="space-y-2 text-sm text-slate-700">
              <p><span className="font-semibold">Date of Birth:</span> {formatDate(client.dateOfBirth)}</p>
              <p><span className="font-semibold">Sex:</span> {client.sex || '-'}</p>
              <p><span className="font-semibold">Civil Status:</span> {client.civilStatus || '-'}</p>
              <p><span className="font-semibold">Occupation:</span> {client.occupation || '-'}</p>
              <p><span className="font-semibold">Religion:</span> {client.religion || '-'}</p>
              <p><span className="font-semibold">Category:</span> {client.clientCategory || '-'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <input
                  className="portal-input"
                  value={form.religion}
                  onChange={(e) => setForm((prev) => ({ ...prev, religion: e.target.value }))}
                  placeholder="e.g. Roman Catholic, Islam, INC"
                />
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
            </div>
          )}
        </div>

        <div className="card">
          <div className="form-section-title flex items-center gap-2">
            <PhoneIcon className="h-4 w-4" />
            Contact
          </div>
          {!editMode ? (
            <div className="space-y-2 text-sm text-slate-700">
              <p><span className="font-semibold">Phone:</span> {client.contactNumber || '-'}</p>
            </div>
          ) : (
            <div>
              <label className="portal-label">Phone</label>
              <input
                className="portal-input"
                value={form.contactNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, contactNumber: e.target.value }))}
                placeholder="09XXXXXXXXX"
              />
            </div>
          )}
        </div>

        <div className="card md:col-span-2">
          <div className="form-section-title flex items-center gap-2">
            <MapPinIcon className="h-4 w-4" />
            Address
          </div>
          <p className="text-sm text-slate-700">
            {[client.barangay, client.municipality, client.province, client.region].filter(Boolean).join(', ') || '-'}
          </p>
          <div className="mt-4 flex gap-2">
            {client.is4ps && <span className="badge badge-green">4Ps</span>}
            {client.isPwd && <span className="badge badge-blue">PWD</span>}
            {client.isSenior && <span className="badge badge-amber">Senior Citizen</span>}
          </div>
        </div>
      </div>

      {!editMode && (
        <div className="card mt-4 p-0 overflow-hidden">
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
        <div className="card mt-4">
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

      {isAdmin && editMode && (
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
