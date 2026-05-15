import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { formatCurrency } from '../../lib/utils'
import { PlusIcon, SearchIcon, EditIcon, TrashIcon, PillIcon } from '../../components/ui/Icons'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/ui/Icons'

const PAGE_SIZE = 20

export default function MedicineDatabase() {
  const [medicines, setMedicines] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [categories, setCategories] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ genericName: '', brandName: '', unit: '', strength: '', category: '', unitPrice: '' })
  const [importing, setImporting] = useState(false)
  const [importModal, setImportModal] = useState(null) // { file, name, rowCount } or null
  const [deleteAllModal, setDeleteAllModal] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

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
      } catch {
        // Ignore optional category preload failures.
      }
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

  const handleSave = async () => {
    try {
      if (editing) {
        await api.put(`/medicines/${editing.id}`, form)
        toast.success('Medicine updated')
      } else {
        await api.post('/medicines', form)
        toast.success('Medicine added to database')
      }
      setShowForm(false)
      setEditing(null)
      setForm({ genericName: '', brandName: '', unit: '', strength: '', category: '', unitPrice: '' })
      fetchMedicines(page)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save')
    }
  }

  const handleEdit = (m) => {
    setEditing(m)
    setForm({ genericName: m.genericName, brandName: m.brandName, unit: m.unit, strength: m.strength ?? '', category: m.category, unitPrice: m.unitPrice })
    setShowForm(true)
  }

  // Count data rows in CSV for confirmation preview (client-side)
  const previewCsv = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = (e.target.result || '').replace(/^\uFEFF/, '')
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      // Estimate data rows: subtract up to 3 header/title rows
      const dataRows = Math.max(0, lines.length - 3)
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
      const { data } = await api.post('/medicines/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (data.imported === 0) {
        toast('All rows already exist - nothing new imported.', { icon: 'i' })
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

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this medicine?')) return
    try {
      await api.delete(`/medicines/${id}`)
      toast.success('Deleted')
      fetchMedicines(page)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete')
    }
  }

  const handleDeleteAll = async () => {
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

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="portal-kicker">Medicine Catalog</p>
          <h1 className="portal-page-title">Medicine Database</h1>
          <p className="portal-page-subtitle">{total.toLocaleString()} entries</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDeleteAllModal(true)}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2">
            <TrashIcon className="h-4 w-4" />
            Delete All
          </button>
          <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
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
          <button onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ genericName: '', brandName: '', unit: '', strength: '', category: '', unitPrice: '' }) }}
            className="portal-button-green" id="btn-add-medicine">
            <PlusIcon className="h-4 w-4" />
            Add Medicine
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card mb-4 border-2 border-brand-green/30 animate-slide-up">
          <div className="form-section-title">{editing ? 'Edit Medicine' : 'Add New Medicine'}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="portal-label">Generic Name *</label>
              <input value={form.genericName} onChange={e => setForm({ ...form, genericName: e.target.value })} className="portal-input" placeholder="e.g. Amoxicillin" />
            </div>
            <div>
              <label className="portal-label">Brand Name</label>
              <input value={form.brandName} onChange={e => setForm({ ...form, brandName: e.target.value })} className="portal-input" placeholder="e.g. Amoxil" />
            </div>
            <div>
              <label className="portal-label">Strength / Concentration</label>
              <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="portal-input" placeholder="e.g. 250mg / 125mg/5mL" />
            </div>
            <div>
              <label className="portal-label">Dosage Form</label>
              <input value={form.strength} onChange={e => setForm({ ...form, strength: e.target.value })} className="portal-input" placeholder="e.g. Tablet / Capsule / Suspension" />
            </div>
            <div>
              <label className="portal-label">Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="portal-input">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="portal-label">Unit Price (PHP)</label>
              <input type="number" min="0" step="0.01" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} className="portal-input" placeholder="0.00" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="portal-button-primary" id="btn-save-medicine">Save Medicine</button>
            <button onClick={() => setShowForm(false)} className="portal-button-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search generic or brand name..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="portal-input pl-9" />
          </div>
          <div className="w-full sm:w-56">
            <select
              value={category}
              onChange={(e) => {
                const nextCategory = e.target.value
                setLoading(true)
                setCategory(nextCategory)
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

      {/* Delete All Confirmation Modal */}
      {deleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="rounded-t-xl bg-gradient-to-r from-red-700 to-red-600 px-6 py-4">
              <h2 className="font-display text-lg font-bold text-white">Delete All Medicines</h2>
            </div>
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-slate-700">
                This will permanently delete <span className="font-semibold">{total.toLocaleString()} medicine records</span>. This action cannot be undone.
              </p>
              <p className="text-xs text-slate-500">You can re-import from CSV after clearing.</p>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setDeleteAllModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
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

      {/* CSV Import Confirmation Modal */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="rounded-t-xl bg-gradient-to-r from-[#064e3b] to-[#065f46] px-6 py-4">
              <h2 className="font-display text-lg font-bold text-white">Import CSV</h2>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className="font-medium text-slate-700 truncate">{importModal.name}</p>
                <p className="mt-1 text-slate-500">~{importModal.rowCount} medicine rows detected</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold">Column mapping:</p>
                <p>Generic Name to Generic Name</p>
                <p>Brand Name to Brand Name</p>
                <p>Drug Category to Category</p>
                <p>Strength / Concentration to Strength / Conc.</p>
                <p>Dosage Form to Dosage Form</p>
                <p className="text-slate-500 mt-1">Unit Price defaults to PHP 0.00 - update after import.</p>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setImportModal(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
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
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" /></div>
        ) : (
          <>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header text-center w-12">No.</th>
                <th className="table-header text-left">Generic Name</th>
                <th className="table-header text-left">Brand Name</th>
                <th className="table-header text-left">Strength / Conc.</th>
                <th className="table-header text-left">Dosage Form</th>
                <th className="table-header text-left">Category</th>
                <th className="table-header text-right">Unit Price</th>
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
                  <td className="table-cell text-slate-500">{m.brandName || 'â€”'}</td>
                  <td className="table-cell text-xs">{m.unit || 'â€”'}</td>
                  <td className="table-cell text-xs font-medium">{m.strength || 'â€”'}</td>
                  <td className="table-cell"><span className="badge badge-green">{m.category}</span></td>
                  <td className="table-cell text-right font-mono font-semibold">{formatCurrency(m.unitPrice)}</td>
                  <td className="table-cell text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleEdit(m)} className="text-brand-primary hover:text-brand-dark"><EditIcon className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {medicines.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="table-cell py-10 text-center text-sm text-slate-400">No medicines found.</td>
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

