import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

const TYPES = [
  ['medicine', 'Medicine'], ['hospital', 'Hospital'], ['medical', 'Medical'],
  ['burial', 'Burial'], ['eyeglass', 'Eyeglass'], ['plain', 'Plain AICS'],
]
const EMPTY = { assistanceType: 'medicine', field: 'presenting_problem', label: '', content: '', sortOrder: 0, isActive: true }

export default function NarrativeOptionsSettings() {
  const [options, setOptions] = useState([])
  const [filter, setFilter] = useState('medicine')
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const { data } = await api.get('/settings/narrative-options', { params: { includeInactive: true } })
      setOptions(data.options || [])
    } catch { toast.error('Failed to load narrative options.') }
  }
  useEffect(() => { load() }, [])
  const visible = useMemo(() => options.filter((item) => item.assistanceType === filter), [options, filter])

  const reset = () => { setEditingId(null); setForm({ ...EMPTY, assistanceType: filter }) }
  const edit = (item) => { setEditingId(item.id); setForm({ ...item }) }
  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, sortOrder: Number(form.sortOrder) || 0 }
      if (editingId) await api.put(`/settings/narrative-options/${editingId}`, payload)
      else await api.post('/settings/narrative-options', payload)
      toast.success(editingId ? 'Narrative option updated.' : 'Narrative option added.')
      reset()
      await load()
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to save narrative option.') }
    finally { setSaving(false) }
  }
  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.label}"?`)) return
    try { await api.delete(`/settings/narrative-options/${item.id}`); await load(); toast.success('Narrative option deleted.') }
    catch (error) { toast.error(error.response?.data?.message || 'Failed to delete narrative option.') }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="mb-4 border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold text-slate-900">Presenting Problem &amp; Findings Options</h2>
          <p className="text-sm text-slate-500">Maintain reusable text choices shown to case makers for each assistance type.</p>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {TYPES.map(([value, label]) => <button key={value} type="button" onClick={() => { setFilter(value); setEditingId(null); setForm({ ...EMPTY, assistanceType: value }) }} className={filter === value ? 'portal-button-primary text-xs' : 'portal-button-secondary text-xs'}>{label}</button>)}
        </div>
        <form onSubmit={save} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div><label className="portal-label">Field</label><select className="portal-input" value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}><option value="presenting_problem">Presenting Problem</option><option value="findings">Findings</option></select></div>
          <div><label className="portal-label">Dropdown Label</label><input className="portal-input" required maxLength={150} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Hospital bill assistance" /></div>
          <div className="lg:col-span-2"><label className="portal-label">Text inserted into the case</label><textarea className="portal-input min-h-[7rem]" required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          <div><label className="portal-label">Display Order</label><input type="number" min="0" className="portal-input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></div>
          <label className="flex items-center gap-2 self-end pb-3 text-sm text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
          <div className="flex gap-2 lg:col-span-2"><button className="portal-button-primary" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update Option' : 'Add Option'}</button>{editingId && <button type="button" className="portal-button-secondary" onClick={reset}>Cancel</button>}</div>
        </form>
      </div>
      <div className="card overflow-hidden p-0">
        {visible.length === 0 ? <p className="p-5 text-sm text-slate-500">No options configured for this case type.</p> : visible.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-0 sm:flex-row sm:items-start sm:justify-between">
            <div><div className="flex items-center gap-2"><p className="font-medium text-slate-900">{item.label}</p>{!item.isActive && <span className="text-xs text-slate-400">Inactive</span>}</div><p className="mt-1 text-xs font-medium uppercase text-slate-400">{item.field === 'findings' ? 'Findings' : 'Presenting Problem'}</p><p className="mt-1 text-sm text-slate-600">{item.content}</p></div>
            <div className="flex shrink-0 gap-2"><button type="button" className="portal-button-secondary text-xs" onClick={() => edit(item)}>Edit</button><button type="button" className="text-sm text-red-600" onClick={() => remove(item)}>Delete</button></div>
          </div>
        ))}
      </div>
    </div>
  )
}