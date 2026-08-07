import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { PlusIcon, SearchIcon, EditIcon, TrashIcon } from '../../components/ui/Icons'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/ui/Icons'

const PAGE_SIZE = 20

function displayOptional(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized || ['\u00e2\u20ac\u201d', '\u2014', '\u2013'].includes(normalized)) return '-'
  return normalized
}

function formatAvailabilityTimestamp(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const dateText = date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  })
  const timeText = date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  })
  return `${dateText} ${timeText}`
}

// ─── Reusable centered modal wrapper ────────────────────────────────────────
function Modal({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl animate-slide-up">
        {children}
      </div>
    </div>
  )
}

export default function MedicineDatabase() {
  const user = useAuthStore((state) => state.user)

  // CHO and admin can fully manage medicines
  const canManageMedicines =
    user?.role === 'admin' || user?.role === 'city_health_office'

  const [medicines, setMedicines] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [categories, setCategories] = useState([])

  // Add / Edit modal
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [duplicateMatch, setDuplicateMatch] = useState(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const [form, setForm] = useState({
    genericName: '',
    unit: '',
    strength: '',
    category: '',
    isAvailable: true,
  })

  // Delete single confirmation modal
  const [deleteModal, setDeleteModal] = useState(null) // { id, name }

  // Delete All modal
  const [deleteAllModal, setDeleteAllModal] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  // CSV Import modal (admin-only)
  const [importing, setImporting] = useState(false)
  const [importModal, setImportModal] = useState(null)

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchMedicines = async (pg = page, overrides = {}) => {
    try {
      const nextSearch = overrides.search ?? search
      const nextCategory = overrides.category ?? category
      const params = new URLSearchParams()
      if (nextSearch) params.append('search', nextSearch)
      if (nextCategory !== 'All') params.append('category', nextCategory)
      params.append('page', String(pg))
      params.append('limit', String(PAGE_SIZE))
      const res = await api.get(`/medicines?${params}`)
      setMedicines(res.data.medicines || [])
      setTotal(res.data.total ?? 0)
      setTotalPages(res.data.totalPages ?? 1)
    } catch {
      toast.error('Failed to load medicines')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await api.get('/medicines/categories')
      setCategories(res.data.categories || [])
    } catch { /* silent */ }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.get('/medicines/categories')
        if (active) setCategories(res.data.categories || [])
      } catch { /* silent */ }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (search) params.append('search', search)
        if (category !== 'All') params.append('category', category)
        params.append('page', String(page))
        params.append('limit', String(PAGE_SIZE))
        const res = await api.get(`/medicines?${params}`)
        if (!active) return
        setMedicines(res.data.medicines || [])
        setTotal(res.data.total ?? 0)
        setTotalPages(res.data.totalPages ?? 1)
      } catch {
        if (active) toast.error('Failed to load medicines')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [page, search, category])

  // Live duplicate check in the Add/Edit modal — same identity the backend enforces on
  // save (generic name + strength/conc. + dosage form), just surfaced early so the case
  // maker sees it before hitting Save instead of only from the error toast.
  useEffect(() => {
    if (!showForm) {
      setDuplicateMatch(null)
      return
    }
    const genericName = form.genericName.trim()
    if (!genericName) {
      setDuplicateMatch(null)
      return
    }

    let active = true
    setCheckingDuplicate(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/medicines', { params: { search: genericName, limit: 25 } })
        if (!active) return
        const unit = form.unit.trim().toLowerCase()
        const strength = form.strength.trim().toLowerCase()
        const match = (res.data.medicines || []).find((m) =>
          m.id !== editing?.id &&
          m.genericName.trim().toLowerCase() === genericName.toLowerCase() &&
          (m.unit ?? '').trim().toLowerCase() === unit &&
          (m.strength ?? '').trim().toLowerCase() === strength,
        )
        setDuplicateMatch(match ?? null)
      } catch {
        // Duplicate check is a soft, non-blocking hint — the save endpoint enforces this for real.
      } finally {
        if (active) setCheckingDuplicate(false)
      }
    }, 350)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [showForm, form.genericName, form.unit, form.strength, editing])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null)
    setForm({ genericName: '', unit: '', strength: '', category: categories[0] ?? '', isAvailable: true })
    setShowForm(true)
  }

  const openEdit = (m) => {
    if (!canManageMedicines) return
    setEditing(m)
    setForm({
      genericName: m.genericName,
      unit: m.unit ?? '',
      strength: m.strength ?? '',
      category: m.category ?? '',
      isAvailable: m.isAvailable !== false,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!canManageMedicines) return
    if (!form.genericName.trim()) {
      toast.error('Generic name is required')
      return
    }
    if (duplicateMatch) {
      toast.error('This medicine (same name, strength, and dosage form) is already in the database.')
      return
    }
    try {
      if (editing) {
        await api.put(`/medicines/${editing.id}`, { ...form, brandName: editing.brandName ?? '' })
        toast.success('Medicine updated')
      } else {
        await api.post('/medicines', form)
        toast.success('Medicine added to database')
      }
      setShowForm(false)
      setEditing(null)
      fetchMedicines(page)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save')
    }
  }

  const handleToggleAvailability = async (m) => {
    if (!canManageMedicines) return
    const nextStatus = m.isAvailable === false ? true : false
    const localTimestamp = new Date().toISOString()
    setMedicines(prev => prev.map(item => item.id === m.id ? {
      ...item,
      isAvailable: nextStatus,
      availabilityUpdatedAt: localTimestamp,
      availableUpdatedAt: nextStatus ? localTimestamp : item.availableUpdatedAt,
      unavailableUpdatedAt: nextStatus ? item.unavailableUpdatedAt : localTimestamp,
    } : item))
    try {
      const { data } = await api.patch(`/medicines/${m.id}/availability`, { isAvailable: nextStatus })
      setMedicines(prev => prev.map(item => item.id === m.id ? {
        ...item,
        isAvailable: data.isAvailable,
        availabilityUpdatedAt: data.availabilityUpdatedAt,
        availableUpdatedAt: data.availableUpdatedAt,
        unavailableUpdatedAt: data.unavailableUpdatedAt,
      } : item))
      toast.success(`${m.genericName} set to ${nextStatus ? 'Available' : 'Not Available'}`)
    } catch {
      setMedicines(prev => prev.map(item => item.id === m.id ? {
        ...item,
        isAvailable: m.isAvailable,
        availabilityUpdatedAt: m.availabilityUpdatedAt,
        availableUpdatedAt: m.availableUpdatedAt,
        unavailableUpdatedAt: m.unavailableUpdatedAt,
      } : item))
      toast.error('Failed to update availability')
    }
  }

  const confirmDelete = (m) => {
    if (!canManageMedicines) return
    setDeleteModal({ id: m.id, name: m.genericName })
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    try {
      await api.delete(`/medicines/${deleteModal.id}`)
      toast.success('Medicine deleted')
      setDeleteModal(null)
      fetchMedicines(page)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete')
    }
  }

  const handleDeleteAll = async () => {
    if (!canManageMedicines) return
    setDeletingAll(true)
    try {
      const { data } = await api.delete('/medicines')
      toast.success(`Deleted ${data.deleted} medicines`)
      setDeleteAllModal(false)
      setPage(1)
      setCategory('All')
      fetchCategories()
      fetchMedicines(1)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete all')
    } finally {
      setDeletingAll(false)
    }
  }

  // CSV import (admin only)
  const previewCsv = (file) => {
    if (user?.role !== 'admin') return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = (e.target.result || '').replace(/^\uFEFF/, '')
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      const dataRows = Math.max(0, lines.length - 3)
      setImportModal({ file, name: file.name, rowCount: dataRows })
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (user?.role !== 'admin' || !importModal?.file) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importModal.file)
      const { data } = await api.post('/medicines/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (data.imported === 0) {
        toast('All rows already exist - nothing new imported.', { icon: 'ℹ️' })
      } else {
        const dupNote = data.duplicates > 0 ? `, ${data.duplicates} duplicates skipped` : ''
        toast.success(`Imported ${data.imported} medicines${dupNote}`)
      }
      setImportModal(null)
      fetchCategories()
      fetchMedicines()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="portal-kicker">Medicine Catalog</p>
          <h1 className="portal-page-title">Medicine Database</h1>
          <p className="portal-page-subtitle">{total.toLocaleString()} entries</p>
        </div>

        {canManageMedicines && (
          <div className="flex flex-wrap items-center gap-2">
            {user?.role === 'admin' && (
              <>
                <button
                  onClick={() => setDeleteAllModal(true)}
                  className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete All
                </button>
                <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) previewCsv(file)
                      e.target.value = ''
                    }}
                  />
                </label>
              </>
            )}
            <button
              onClick={openAdd}
              className="portal-button-green"
              id="btn-add-medicine"
            >
              <PlusIcon className="h-4 w-4" />
              Add Medicine
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search generic or brand name..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="portal-input pl-9"
            />
          </div>
          <div className="w-full sm:w-56">
            <select
              value={category}
              onChange={(e) => {
                setLoading(true)
                setCategory(e.target.value)
                setPage(1)
              }}
              className="portal-input"
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Add / Edit Modal ───────────────────────────────────────────────── */}
      {canManageMedicines && showForm && (
        <Modal onClose={() => { setShowForm(false); setEditing(null) }}>
          {/* Header */}
          <div className="rounded-t-2xl bg-gradient-to-r from-[#064e3b] to-[#065f46] px-6 py-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">
              {editing ? 'Edit Medicine' : 'Add New Medicine'}
            </h2>
            <button
              onClick={() => { setShowForm(false); setEditing(null) }}
              className="text-white/70 hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Generic Name */}
              <div className="sm:col-span-2">
                <label className="portal-label">Generic Name *</label>
                <input
                  value={form.genericName}
                  onChange={e => setForm({ ...form, genericName: e.target.value })}
                  className="portal-input"
                  placeholder="e.g. Amoxicillin"
                  autoFocus
                />
              </div>

              {/* Strength */}
              <div>
                <label className="portal-label">Strength / Concentration</label>
                <input
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                  className="portal-input"
                  placeholder="e.g. 250mg"
                />
              </div>

              {/* Dosage Form */}
              <div>
                <label className="portal-label">Dosage Form</label>
                <input
                  value={form.strength}
                  onChange={e => setForm({ ...form, strength: e.target.value })}
                  className="portal-input"
                  placeholder="e.g. Tablet / Capsule"
                />
              </div>

              {duplicateMatch && (
                <div className="sm:col-span-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="font-semibold">Already in the database</p>
                  <p className="mt-0.5 text-xs">
                    "{duplicateMatch.genericName}"
                    {duplicateMatch.unit ? ` (${duplicateMatch.unit})` : ''}
                    {duplicateMatch.strength ? ` — ${duplicateMatch.strength}` : ''} matches this entry exactly. Edit that one instead, or change the name/strength/dosage form to add a distinct medicine.
                  </p>
                </div>
              )}

              {/* Category */}
              <div>
                <label className="portal-label">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="portal-input"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Availability toggle */}
              <div className="sm:col-span-2">
                <label className="portal-label">Availability Status</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isAvailable: !form.isAvailable })}
                  className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm border flex items-center justify-center gap-2 transition-all ${
                    form.isAvailable
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${form.isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {form.isAvailable ? '✓ Available' : '✗ Not Available'}
                  <span className="ml-auto text-xs font-normal opacity-60">Click to toggle</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null) }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={Boolean(duplicateMatch) || checkingDuplicate}
                className="portal-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                id="btn-save-medicine"
              >
                {editing ? 'Update Medicine' : 'Save Medicine'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Single Confirmation Modal ──────────────────────────────── */}
      {deleteModal && (
        <Modal onClose={() => setDeleteModal(null)}>
          <div className="rounded-t-2xl bg-gradient-to-r from-red-700 to-red-600 px-6 py-4">
            <h2 className="font-display text-lg font-bold text-white">Delete Medicine</h2>
          </div>
          <div className="px-6 py-6 space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-900">"{deleteModal.name}"</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete All Confirmation Modal ─────────────────────────────────── */}
      {user?.role === 'admin' && deleteAllModal && (
        <Modal onClose={() => setDeleteAllModal(false)}>
          <div className="rounded-t-2xl bg-gradient-to-r from-red-700 to-red-600 px-6 py-4">
            <h2 className="font-display text-lg font-bold text-white">Delete All Medicines</h2>
          </div>
          <div className="px-6 py-6 space-y-4">
            <p className="text-sm text-slate-700">
              This will permanently delete{' '}
              <span className="font-semibold">{total.toLocaleString()} medicine records</span>.
              This action cannot be undone.
            </p>
            <p className="text-xs text-slate-500">You can re-import from CSV after clearing.</p>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeleteAllModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingAll}
                onClick={handleDeleteAll}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deletingAll ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── CSV Import Modal (admin only) ─────────────────────────────────── */}
      {user?.role === 'admin' && importModal && (
        <Modal onClose={() => setImportModal(null)}>
          <div className="rounded-t-2xl bg-gradient-to-r from-[#064e3b] to-[#065f46] px-6 py-4">
            <h2 className="font-display text-lg font-bold text-white">Import CSV</h2>
          </div>
          <div className="px-6 py-6 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium text-slate-700 truncate">{importModal.name}</p>
              <p className="mt-1 text-slate-500">~{importModal.rowCount} medicine rows detected</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Column mapping:</p>
              <p>Generic Name → Generic Name</p>
              <p>Brand Name → Brand Name</p>
              <p>Drug Category → Category</p>
              <p>Strength / Concentration → Strength / Conc.</p>
              <p>Dosage Form → Dosage Form</p>
              <p className="text-slate-500 mt-1">Status defaults to Available.</p>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setImportModal(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={handleImport}
                className="portal-button-green disabled:opacity-60"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr>
                    <th className="table-header text-center w-12">No.</th>
                    <th className="table-header text-left">Generic Name</th>
                    <th className="table-header text-left">Strength / Conc.</th>
                    <th className="table-header text-left">Dosage Form</th>
                    <th className="table-header text-left">Category</th>
                    <th className="table-header text-center">Availability Status</th>
                    <th className="table-header text-center">Available Updated</th>
                    <th className="table-header text-center">Not Available Updated</th>
                    <th className="table-header text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((m, idx) => (
                    <tr key={m.id} className="table-row">
                      <td className="table-cell text-center font-mono text-xs text-slate-400">
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="table-cell font-semibold text-brand-primary">{m.genericName}</td>
                      <td className="table-cell text-xs">{displayOptional(m.unit)}</td>
                      <td className="table-cell text-xs font-medium">{displayOptional(m.strength)}</td>
                      <td className="table-cell"><span className="badge badge-green">{m.category}</span></td>

                      {/* Availability toggle */}
                      <td className="table-cell text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(m)}
                          disabled={!canManageMedicines}
                          title={canManageMedicines ? 'Click to toggle availability' : 'Read only'}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all shadow-sm ${
                            m.isAvailable !== false
                              ? `bg-emerald-100 text-emerald-800 border border-emerald-300 ${canManageMedicines ? 'hover:bg-emerald-200 cursor-pointer' : 'cursor-default'}`
                              : `bg-rose-100 text-rose-800 border border-rose-300 ${canManageMedicines ? 'hover:bg-rose-200 cursor-pointer' : 'cursor-default'}`
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${m.isAvailable !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {m.isAvailable !== false ? 'Available' : 'Not Available'}
                        </button>
                      </td>

                      <td className="table-cell text-center text-xs text-slate-600">
                        {formatAvailabilityTimestamp(m.availableUpdatedAt)}
                      </td>

                      <td className="table-cell text-center text-xs text-slate-600">
                        {formatAvailabilityTimestamp(m.unavailableUpdatedAt)}
                      </td>

                      {/* Actions */}
                      <td className="table-cell text-center">
                        {canManageMedicines ? (
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => openEdit(m)}
                              title="Edit"
                              className="text-brand-primary hover:text-brand-dark transition-colors"
                            >
                              <EditIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => confirmDelete(m)}
                              title="Delete"
                              className="text-red-400 hover:text-red-600 transition-colors"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Read only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {medicines.length === 0 && !loading && (
                    <tr>
                      <td colSpan={9} className="table-cell py-10 text-center text-sm text-slate-400">
                        No medicines found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <span className="text-xs text-slate-500">
                Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <span className="text-xs text-slate-600 font-medium">Page {page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
