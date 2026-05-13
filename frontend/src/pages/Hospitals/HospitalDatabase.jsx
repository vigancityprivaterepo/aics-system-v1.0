import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { PlusIcon, SearchIcon, EditIcon, TrashIcon, HospitalIcon } from '../../components/ui/Icons'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/ui/Icons'

const PAGE_SIZE = 20

export default function HospitalDatabase() {
  const [facilities, setFacilities] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [types, setTypes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ province: '', municipality: '', facilityName: '', facilityType: '', fullAddress: '' })
  const [importing, setImporting] = useState(false)
  const [importModal, setImportModal] = useState(null)
  const [deleteAllModal, setDeleteAllModal] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  const fetchFacilities = async (pg = page) => {
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (filterType !== 'All') params.append('type', filterType)
      params.append('page', String(pg))
      params.append('limit', String(PAGE_SIZE))
      const res = await api.get(`/hospitals?${params}`)
      setFacilities(res.data.facilities || [])
      setTotal(res.data.total ?? 0)
      setTotalPages(res.data.totalPages ?? 1)
    } catch {
      toast.error('Failed to load hospital facilities')
    } finally {
      setLoading(false)
    }
  }

  const fetchTypes = async () => {
    try {
      const res = await api.get('/hospitals/types')
      setTypes(res.data.types || [])
    } catch { /* silent */ }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.get('/hospitals/types')
        if (active) setTypes(res.data.types || [])
      } catch {
        // Ignore optional type preload failures.
      }
    })()
    return () => { active = false }
  }, [])
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (search) params.append('search', search)
        if (filterType !== 'All') params.append('type', filterType)
        params.append('page', String(page))
        params.append('limit', String(PAGE_SIZE))
        const res = await api.get(`/hospitals?${params}`)
        if (!active) return
        setFacilities(res.data.facilities || [])
        setTotal(res.data.total ?? 0)
        setTotalPages(res.data.totalPages ?? 1)
      } catch {
        if (active) toast.error('Failed to load hospital facilities')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [page, search, filterType])
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  const resetForm = () => setForm({ province: '', municipality: '', facilityName: '', facilityType: '', fullAddress: '' })

  const handleSave = async () => {
    if (!form.province.trim() || !form.municipality.trim() || !form.facilityName.trim() || !form.facilityType.trim()) {
      toast.error('Province, Municipality, Facility Name, and Facility Type are required')
      return
    }
    try {
      if (editing) {
        await api.put(`/hospitals/${editing.id}`, form)
        toast.success('Facility updated')
      } else {
        await api.post('/hospitals', form)
        toast.success('Facility added to database')
      }
      setShowForm(false)
      setEditing(null)
      resetForm()
      fetchTypes()
      fetchFacilities(page)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save')
    }
  }

  const handleEdit = (h) => {
    setEditing(h)
    setForm({
      province:     h.province,
      municipality: h.municipality,
      facilityName: h.facilityName,
      facilityType: h.facilityType,
      fullAddress:  h.fullAddress ?? '',
    })
    setShowForm(true)
  }

  const previewCsv = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = (e.target.result || '').replace(/^\uFEFF/, '')
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      const dataRows = Math.max(0, lines.length - 2)
      setImportModal({ file, name: file.name, rowCount: dataRows })
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!importModal?.file) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importModal.file)
      const { data } = await api.post('/hospitals/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (data.imported === 0) {
        toast('All rows already exist - nothing new imported.', { icon: 'i' })
      } else {
        const dupNote = data.duplicates > 0 ? `, ${data.duplicates} duplicates skipped` : ''
        toast.success(`Imported ${data.imported} facilities${dupNote}`)
      }
      setImportModal(null)
      fetchTypes()
      fetchFacilities(1)
      setPage(1)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this facility?')) return
    try {
      await api.delete(`/hospitals/${id}`)
      toast.success('Deleted')
      fetchFacilities(page)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete')
    }
  }

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try {
      const { data } = await api.delete('/hospitals')
      toast.success(`Deleted ${data.deleted} facilities`)
      setDeleteAllModal(false)
      setPage(1)
      setFilterType('All')
      fetchTypes()
      fetchFacilities(1)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete all')
    } finally {
      setDeletingAll(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="portal-kicker">Hospital Catalog</p>
          <h1 className="portal-page-title">Hospital Database</h1>
          <p className="portal-page-subtitle">{total.toLocaleString()} facilities</p>
        </div>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => { setShowForm(!showForm); setEditing(null); resetForm() }}
            className="portal-button-green"
          >
            <PlusIcon className="h-4 w-4" />
            Add Facility
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card mb-4 border-2 border-brand-green/30 animate-slide-up">
          <div className="form-section-title">{editing ? 'Edit Facility' : 'Add New Facility'}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="portal-label">Province *</label>
              <input value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} className="portal-input" placeholder="e.g. Ilocos Sur" />
            </div>
            <div>
              <label className="portal-label">City / Municipality *</label>
              <input value={form.municipality} onChange={e => setForm({ ...form, municipality: e.target.value })} className="portal-input" placeholder="e.g. Vigan City" />
            </div>
            <div className="sm:col-span-2">
              <label className="portal-label">Facility Name *</label>
              <input value={form.facilityName} onChange={e => setForm({ ...form, facilityName: e.target.value })} className="portal-input" placeholder="e.g. Ilocos Sur Provincial Hospital" />
            </div>
            <div>
              <label className="portal-label">Facility Type *</label>
              <input value={form.facilityType} onChange={e => setForm({ ...form, facilityType: e.target.value })} className="portal-input" placeholder="e.g. Hospital, Clinic, Health Center" />
            </div>
            <div>
              <label className="portal-label">Full Address</label>
              <input value={form.fullAddress} onChange={e => setForm({ ...form, fullAddress: e.target.value })} className="portal-input" placeholder="Street, Barangay, City, Province, ZIP" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="portal-button-primary">Save Facility</button>
            <button onClick={() => { setShowForm(false); setEditing(null); resetForm() }} className="portal-button-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search facility name, municipality, or address..."
              value={search}
              onChange={e => { setLoading(true); setSearch(e.target.value) }}
              className="portal-input pl-9"
            />
          </div>
          <div className="w-full sm:w-52">
            <select value={filterType} onChange={e => { setLoading(true); setFilterType(e.target.value); setPage(1) }} className="portal-input">
              <option value="All">All Types</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Delete All Modal */}
      {deleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="rounded-t-xl bg-gradient-to-r from-red-700 to-red-600 px-6 py-4">
              <h2 className="font-display text-lg font-bold text-white">Delete All Facilities</h2>
            </div>
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-slate-700">
                This will permanently delete <span className="font-semibold">{total.toLocaleString()} facility records</span>. This action cannot be undone.
              </p>
              <p className="text-xs text-slate-500">You can re-import from CSV after clearing.</p>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setDeleteAllModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
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
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="rounded-t-xl bg-gradient-to-r from-[#064e3b] to-[#065f46] px-6 py-4">
              <h2 className="font-display text-lg font-bold text-white">Import CSV</h2>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className="font-medium text-slate-700 truncate">{importModal.name}</p>
                <p className="mt-1 text-slate-500">~{importModal.rowCount} facility rows detected</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold">Expected CSV columns:</p>
                <p>Province</p>
                <p>City / Municipality</p>
                <p>Facility Name</p>
                <p>Facility Type</p>
                <p>Full Address</p>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setImportModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
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
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header text-center w-12">No.</th>
                  <th className="table-header text-left">Province</th>
                  <th className="table-header text-left">City / Municipality</th>
                  <th className="table-header text-left">Facility Name</th>
                  <th className="table-header text-left">Facility Type</th>
                  <th className="table-header text-left">Full Address</th>
                  <th className="table-header text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((h, idx) => (
                  <tr key={h.id} className="table-row">
                    <td className="table-cell text-center font-mono text-xs text-slate-400">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="table-cell text-xs text-slate-500">{h.province}</td>
                    <td className="table-cell text-xs text-slate-500">{h.municipality}</td>
                    <td className="table-cell font-semibold text-brand-primary">{h.facilityName}</td>
                    <td className="table-cell">
                      <span className="badge badge-blue">{h.facilityType}</span>
                    </td>
                    <td className="table-cell text-xs text-slate-400 max-w-xs truncate">{h.fullAddress || 'â€”'}</td>
                    <td className="table-cell text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEdit(h)} className="text-brand-primary hover:text-brand-dark">
                          <EditIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(h.id)} className="text-red-400 hover:text-red-600">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {facilities.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="table-cell py-10 text-center text-sm text-slate-400">
                      No hospital facilities found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <span className="text-xs text-slate-500">
                Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <span className="text-xs text-slate-600 font-medium">Page {page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
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

