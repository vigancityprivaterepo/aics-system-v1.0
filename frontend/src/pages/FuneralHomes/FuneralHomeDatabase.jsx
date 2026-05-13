import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { PlusIcon, SearchIcon, EditIcon, TrashIcon, HeadstonIcon } from '../../components/ui/Icons'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/ui/Icons'

const PAGE_SIZE = 20

export default function FuneralHomeDatabase() {
  const [homes, setHomes] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', ownerName: '', address: '' })
  const [importing, setImporting] = useState(false)
  const [importModal, setImportModal] = useState(null)
  const [deleteAllModal, setDeleteAllModal] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  const fetchHomes = async (pg = page, overrides = {}) => {
    try {
      const nextSearch = overrides.search ?? search
      const params = new URLSearchParams()
      if (nextSearch) params.append('search', nextSearch)
      params.append('page', String(pg))
      params.append('limit', String(PAGE_SIZE))
      const res = await api.get(`/funeral-homes?${params}`)
      setHomes(res.data.funeralHomes || [])
      setTotal(res.data.total ?? 0)
      setTotalPages(res.data.totalPages ?? 1)
    } catch {
      toast.error('Failed to load funeral homes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (search) params.append('search', search)
        params.append('page', String(page))
        params.append('limit', String(PAGE_SIZE))
        const res = await api.get(`/funeral-homes?${params}`)
        if (!active) return
        setHomes(res.data.funeralHomes || [])
        setTotal(res.data.total ?? 0)
        setTotalPages(res.data.totalPages ?? 1)
      } catch {
        if (active) toast.error('Failed to load funeral homes')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [page, search])
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  const resetForm = () => setForm({ name: '', ownerName: '', address: '' })

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Funeral Home Name is required')
      return
    }
    try {
      if (editing) {
        await api.put(`/funeral-homes/${editing.id}`, form)
        toast.success('Funeral home updated')
      } else {
        await api.post('/funeral-homes', form)
        toast.success('Funeral home added')
      }
      setShowForm(false)
      setEditing(null)
      resetForm()
      fetchHomes(page)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save')
    }
  }

  const handleEdit = (h) => {
    setEditing(h)
    setForm({ name: h.name, ownerName: h.ownerName ?? '', address: h.address ?? '' })
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
      const { data } = await api.post('/funeral-homes/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (data.imported === 0) {
        toast('All rows already exist - nothing new imported.', { icon: 'i' })
      } else {
        const dupNote = data.duplicates > 0 ? `, ${data.duplicates} duplicates skipped` : ''
        toast.success(`Imported ${data.imported} funeral homes${dupNote}`)
      }
      setImportModal(null)
      fetchHomes(1)
      setPage(1)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this funeral home?')) return
    try {
      await api.delete(`/funeral-homes/${id}`)
      toast.success('Deleted')
      fetchHomes(page)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete')
    }
  }

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try {
      const { data } = await api.delete('/funeral-homes')
      toast.success(`Deleted ${data.deleted} funeral homes`)
      setDeleteAllModal(false)
      setPage(1)
      fetchHomes(1)
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
          <p className="portal-kicker">Burial Assistance</p>
          <h1 className="portal-page-title">Funeral Homes</h1>
          <p className="portal-page-subtitle">{total.toLocaleString()} funeral home{total !== 1 ? 's' : ''}</p>
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
            Add Funeral Home
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card mb-4 border-2 border-brand-green/30 animate-slide-up">
          <div className="form-section-title">{editing ? 'Edit Funeral Home' : 'Add New Funeral Home'}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="portal-label">Funeral Home Name *</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="portal-input"
                placeholder="e.g. Baquiran Funeral Home"
              />
            </div>
            <div>
              <label className="portal-label">Owner / Manager Name</label>
              <input
                value={form.ownerName}
                onChange={e => setForm({ ...form, ownerName: e.target.value })}
                className="portal-input"
                placeholder="e.g. Mr. Juan Dela Cruz"
              />
            </div>
            <div>
              <label className="portal-label">Address</label>
              <input
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="portal-input"
                placeholder="e.g. Vigan City, Ilocos Sur"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="portal-button-primary">Save</button>
            <button onClick={() => { setShowForm(false); setEditing(null); resetForm() }} className="portal-button-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card mb-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search funeral home name or address..."
            value={search}
            onChange={(e) => {
              setLoading(true)
              setSearch(e.target.value)
            }}
            className="portal-input pl-9"
          />
        </div>
      </div>

      {/* Delete All Modal */}
      {deleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="rounded-t-xl bg-gradient-to-r from-red-700 to-red-600 px-6 py-4">
              <h2 className="font-display text-lg font-bold text-white">Delete All Funeral Homes</h2>
            </div>
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-slate-700">
                This will permanently delete <span className="font-semibold">{total.toLocaleString()} record{total !== 1 ? 's' : ''}</span>. This action cannot be undone.
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
                <p className="mt-1 text-slate-500">~{importModal.rowCount} funeral home rows detected</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold">Expected CSV columns:</p>
                <p>Funeral Home</p>
                <p>Owner <span className="opacity-60">(optional)</span></p>
                <p>Address <span className="opacity-60">(optional)</span></p>
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
                  <th className="table-header text-left">Funeral Home Name</th>
                  <th className="table-header text-left">Owner / Manager</th>
                  <th className="table-header text-left">Address</th>
                  <th className="table-header text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {homes.map((h, idx) => (
                  <tr key={h.id} className="table-row">
                    <td className="table-cell text-center font-mono text-xs text-slate-400">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="table-cell font-semibold text-brand-primary">{h.name}</td>
                    <td className="table-cell text-xs text-slate-500">{h.ownerName || 'â€”'}</td>
                    <td className="table-cell text-xs text-slate-500">{h.address || 'â€”'}</td>
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
                {homes.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="table-cell py-10 text-center text-sm text-slate-400">
                      No funeral homes found.
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

