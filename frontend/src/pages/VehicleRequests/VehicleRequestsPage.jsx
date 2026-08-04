import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Ambulance, CheckCircle2, Download, Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import VehicleRequestPreview from './VehicleRequestPreview'

const VEHICLES = [
  ['ambulance', 'Ambulance'], ['city_coaster', 'City Coaster'], ['city_bus', 'City Bus'],
  ['van', 'Van'], ['truck', 'Truck'], ['manlift', 'Manlift'], ['other', 'Others'],
]
const STANDARD_OFFICES = [
  "City Mayor's Office", "City Administrator's Office", 'City Health Office',
  'City Social Welfare and Development Office', 'General Services Office', 'City Engineering Office',
  'City Planning and Development Office', "City Treasurer's Office", 'City Budget Office',
  'City Accounting Office', 'City Human Resource Management Office',
  'City Disaster Risk Reduction and Management Office', 'Sangguniang Panlungsod', 'Vigan City Police Station',
]
const today = () => new Date().toISOString().slice(0, 10)
const EMPTY = {
  vehicleType: 'ambulance', otherVehicle: '', requestDate: today(), requestedBy: '', office: '', address: '', purpose: '',
  destination: '', departureDate: today(), departureTime: '08:00', arrivalDate: today(), arrivalTime: '17:00', numberOfPassengers: 1,
  availability: 'pending', vehicleModel: '', unavailableReason: '', plateNumber: '', alternativeVehicle: '', alternativeModel: '', alternativePlate: '',
  driverPerDiem: 0, rentalFees: 0, tollFees: 0, otherFees: 0, fuelExpenses: 0, remarks: '', status: 'pending_admin',
}
const dateOnly = (value) => value ? String(value).slice(0, 10) : ''
const formatTravelDateTime = (dateValue, timeValue) => {
  const datePart = dateOnly(dateValue)
  if (!datePart && !timeValue) return ''
  const [hourText = '0', minuteText = '0'] = String(timeValue || '').split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (!datePart || !Number.isFinite(hour) || !Number.isFinite(minute)) return datePart || String(timeValue || '')
  const date = new Date(`${datePart}T00:00:00`)
  if (Number.isNaN(date.getTime())) return `${datePart} ${String(timeValue || '')}`.trim()
  const formattedDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${formattedDate}, ${displayHour}:${String(minute).padStart(2, '0')} ${period}`
}
const money = (value) => Number(value || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
const vehicleLabel = (value, other) => value === 'other' ? (other || 'Other') : VEHICLES.find(([key]) => key === value)?.[1] || value
const reviewStatus = (item) => item.status === 'approved' ? 'Approved by Administration' : 'Pending Administrative Approval'
const statusClass = (item) => item.availability === 'available'
  ? 'bg-emerald-100 text-emerald-800'
  : item.availability === 'unavailable'
    ? 'bg-red-100 text-red-700'
    : 'bg-amber-100 text-amber-800'

function SuggestInput({ listId, options, ...props }) {
  return <><input {...props} list={listId} className="portal-input" /><datalist id={listId}>{options.map((option) => <option key={option} value={option} />)}</datalist></>
}

function RequestForm({ initial, options, onClose, onSaved }) {
  const [form, setForm] = useState(initial ? {
    ...EMPTY, ...initial, requestDate: dateOnly(initial.requestDate), departureDate: dateOnly(initial.departureDate), arrivalDate: dateOnly(initial.arrivalDate),
  } : EMPTY)
  const [saving, setSaving] = useState(false)
  const locked = initial?.status === 'approved'
  const officeOptions = useMemo(() => [...new Set([...STANDARD_OFFICES, ...(options.offices || [])])], [options.offices])
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const total = useMemo(() => ['driverPerDiem', 'rentalFees', 'tollFees', 'otherFees', 'fuelExpenses'].reduce((sum, field) => sum + Number(form[field] || 0), 0), [form])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, numberOfPassengers: Number(form.numberOfPassengers), driverPerDiem: Number(form.driverPerDiem || 0), rentalFees: Number(form.rentalFees || 0), tollFees: Number(form.tollFees || 0), otherFees: Number(form.otherFees || 0), fuelExpenses: Number(form.fuelExpenses || 0) }
      const { data } = initial?.id ? await api.put(`/vehicle-requests/${initial.id}`, payload) : await api.post('/vehicle-requests', payload)
      toast.success(initial?.id ? 'Vehicle request updated.' : `${data.requestNumber} sent to City Health Office for review.`)
      onSaved(data)
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to save vehicle request.') }
    finally { setSaving(false) }
  }

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-3 sm:p-6">
    <div className="mx-auto w-full max-w-5xl bg-slate-50 shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-emerald-800 px-5 py-4 text-white">
        <div><h2 className="text-lg font-semibold">{initial?.id ? `Edit ${initial.requestNumber}` : 'New Vehicle Request'}</h2><p className="text-xs text-emerald-100">Vehicle Use / Lease Request Form</p></div>
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center" title="Close"><X className="h-5 w-5" /></button>
      </div>
      <form onSubmit={submit} className="space-y-6 p-5">
        {locked && <div className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">This request has been approved. Only Remarks can still be edited.</div>}
        <fieldset disabled={locked} style={{ display: 'contents' }}>
        <section><h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">Request Information</h3><div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div><label className="portal-label">Vehicle Requested *</label><select className="portal-input" value={form.vehicleType} onChange={(e) => set('vehicleType', e.target.value)}>{VEHICLES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          {form.vehicleType === 'other' && <div><label className="portal-label">Specify Vehicle *</label><input required className="portal-input" value={form.otherVehicle} onChange={(e) => set('otherVehicle', e.target.value)} /></div>}
          <div><label className="portal-label">Date of Request *</label><input required type="date" className="portal-input" value={form.requestDate} onChange={(e) => set('requestDate', e.target.value)} /></div>
          <div><label className="portal-label">Requested By *</label><input required className="portal-input" value={form.requestedBy} onChange={(e) => set('requestedBy', e.target.value)} /></div>
          <div><label className="portal-label">Office / Organization *</label><SuggestInput required listId="vehicle-offices" options={officeOptions} value={form.office} onChange={(e) => set('office', e.target.value)} placeholder="Enter office or organization" /></div>
          <div><label className="portal-label">Address *</label><SuggestInput required listId="vehicle-addresses" options={options.addresses || []} value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
          <div className="md:col-span-2 lg:col-span-3"><label className="portal-label">Purpose of Travel *</label><SuggestInput required listId="vehicle-purposes" options={options.purposes || []} value={form.purpose} onChange={(e) => set('purpose', e.target.value)} /></div>
        </div></section>
        <section><h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">Travel Details</h3><div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="md:col-span-2 lg:col-span-3"><label className="portal-label">Destination *</label><SuggestInput required listId="vehicle-destinations" options={options.destinations || []} value={form.destination} onChange={(e) => set('destination', e.target.value)} /></div>
          <div><label className="portal-label">Departure Date *</label><input required type="date" className="portal-input" value={form.departureDate} onChange={(e) => set('departureDate', e.target.value)} /></div>
          <div><label className="portal-label">Departure Time *</label><input required type="time" className="portal-input" value={form.departureTime} onChange={(e) => set('departureTime', e.target.value)} /></div>
          <div><label className="portal-label">Passengers *</label><input required min="1" type="number" className="portal-input" value={form.numberOfPassengers} onChange={(e) => set('numberOfPassengers', e.target.value)} /></div>
          <div><label className="portal-label">Arrival Date *</label><input required type="date" className="portal-input" value={form.arrivalDate} onChange={(e) => set('arrivalDate', e.target.value)} /></div>
          <div><label className="portal-label">Arrival Time *</label><input required type="time" className="portal-input" value={form.arrivalTime} onChange={(e) => set('arrivalTime', e.target.value)} /></div>
        </div></section>
        <section><h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">Vehicle Availability Assessment</h3><div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div><label className="portal-label">Availability of Vehicle Requested *</label><select className="portal-input" value={form.availability} onChange={(e) => set('availability', e.target.value)}><option value="pending">Pending Assessment</option><option value="available">Available</option><option value="unavailable">Not Available</option></select></div>
          <div><label className="portal-label">Make / Model</label><input className="portal-input" value={form.vehicleModel} onChange={(e) => set('vehicleModel', e.target.value)} /></div>
          <div><label className="portal-label">Plate Number</label><input className="portal-input" value={form.plateNumber} onChange={(e) => set('plateNumber', e.target.value)} /></div>
          {form.availability === 'unavailable' && <>
            <div className="md:col-span-2 lg:col-span-3"><label className="portal-label">Reason for Unavailability *</label><textarea required className="portal-input min-h-20" value={form.unavailableReason} onChange={(e) => set('unavailableReason', e.target.value)} /></div>
            <div><label className="portal-label">Alternative Vehicle</label><input className="portal-input" value={form.alternativeVehicle} onChange={(e) => set('alternativeVehicle', e.target.value)} /></div>
            <div><label className="portal-label">Alternative Model</label><input className="portal-input" value={form.alternativeModel} onChange={(e) => set('alternativeModel', e.target.value)} /></div>
            <div><label className="portal-label">Alternative Plate</label><input className="portal-input" value={form.alternativePlate} onChange={(e) => set('alternativePlate', e.target.value)} /></div>
          </>}
        </div></section>
        <section><h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">Estimated Expenses</h3><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[['driverPerDiem','Per Diem (Driver)'],['rentalFees','Rental Fees'],['tollFees','Toll Fees'],['otherFees','Other Fees'],['fuelExpenses','Fuel Expenses']].map(([field,label]) => <div key={field}><label className="portal-label">{label}</label><input min="0" step="0.01" type="number" className="portal-input" value={form[field]} onChange={(e) => set(field,e.target.value)} /></div>)}
          <div className="border-l-4 border-emerald-600 bg-white px-4 py-3"><p className="text-xs font-medium text-slate-500">Total Expenses</p><p className="mt-1 text-lg font-semibold text-slate-900">{money(total)}</p></div>
        </div></section>
        </fieldset>
        <section><label className="portal-label">Remarks</label><textarea className="portal-input min-h-20" value={form.remarks} onChange={(e) => set('remarks', e.target.value)} /></section>
        {initial?.choReviewedAt && <div className="border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">CHO result: <strong>{reviewStatus(initial)}</strong> by {initial.choReviewedByName || 'City Health Office'}.</div>}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-slate-50 py-4"><button type="button" onClick={onClose} className="portal-button-secondary">Cancel</button><button disabled={saving} className="portal-button-primary">{saving ? 'Saving...' : initial?.id ? 'Save Changes' : 'Submit for Approval'}</button></div>
      </form>
    </div>
  </div>
}

export default function VehicleRequestsPage() {
  const user = useAuthStore((state) => state.user)
  const isCho = user?.role === 'city_health_office'
  const [requests, setRequests] = useState([]), [options, setOptions] = useState({}), [search, setSearch] = useState(''), [status, setStatus] = useState(''), [editing, setEditing] = useState(undefined), [previewing, setPreviewing] = useState(null), [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { const { data } = await api.get('/vehicle-requests', { params: { search: search || undefined, status: status || undefined } }); setRequests(data.requests || []) } catch { toast.error('Failed to load vehicle requests.') } finally { setLoading(false) } }
  const loadOptions = () => api.get('/vehicle-requests/options').then(({data}) => setOptions(data)).catch(() => {})
  useEffect(() => { load(); if (isCho) loadOptions() }, [status, isCho])
  const approve = async (item) => { if(!window.confirm(`Approve ${item.requestNumber}?`)) return; try { await api.patch(`/vehicle-requests/${item.id}/approve`); await load(); toast.success('Vehicle request approved.') } catch (error) { toast.error(error.response?.data?.message || 'Failed to approve vehicle request.') } }
  const download = async (item) => { try { const res = await api.get(`/vehicle-requests/${item.id}/document`, { responseType: 'blob' }); const url=URL.createObjectURL(res.data); const a=document.createElement('a'); a.href=url; a.download=`${item.requestNumber}-vehicle-request.docx`; a.click(); URL.revokeObjectURL(url) } catch { toast.error('Failed to generate the vehicle request document.') } }
  const remove = async (item) => { if(!window.confirm(`Delete ${item.requestNumber}?`)) return; try { await api.delete(`/vehicle-requests/${item.id}`); await load(); toast.success('Vehicle request deleted.') } catch (error) { toast.error(error.response?.data?.message || 'Failed to delete vehicle request.') } }

  const pendingCount = useMemo(() => requests.filter((r) => r.status !== 'approved' && r.status !== 'processed').length, [requests])

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="portal-kicker">Transport Services</p><h1 className="portal-page-title">{isCho ? 'CHO Vehicle Requests' : 'Vehicle Request Approvals'}</h1><p className="portal-page-subtitle">{isCho ? 'Create ambulance requests for administrative approval.' : 'Review and approve requests submitted by the City Health Office.'}</p></div>{isCho && <button className="portal-button-primary" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> New Request</button>}</div>

    {pendingCount > 0 && !isCho && (
      <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="text-sm">
          <span className="font-semibold">Notice for Administrative Employees:</span> There {pendingCount === 1 ? 'is 1 request' : `are ${pendingCount} requests`} pending administrative approval. Documents generated or previewed prior to approval will not include the Mayor's e-signature.
        </div>
      </div>
    )}

    <div className="flex flex-col gap-3 border-y border-slate-200 bg-white px-4 py-3 sm:flex-row"><form className="flex flex-1 gap-2" onSubmit={(e)=>{e.preventDefault();load()}}><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input className="portal-input pl-9" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search control number, requester, office, destination" /></div><button className="portal-button-secondary">Search</button></form><select className="portal-input sm:w-56" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">All review statuses</option><option value="pending_admin">Pending Administrative Approval</option><option value="approved">Approved</option></select></div>
    <div className="overflow-hidden border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{['Control No.','Request Date','Requester / Office','Vehicle','Destination','Travel Date','Approval Status','Approved By',''].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{loading?<tr><td colSpan="9" className="px-4 py-10 text-center text-slate-400">Loading requests...</td></tr>:requests.length===0?<tr><td colSpan="9" className="px-4 py-10 text-center text-slate-400">No vehicle requests found.</td></tr>:requests.map(item=><tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3 font-mono font-semibold text-emerald-800">{item.requestNumber}</td><td className="px-4 py-3">{dateOnly(item.requestDate)}</td><td className="px-4 py-3"><p className="font-medium text-slate-900">{item.requestedBy}</p><p className="text-xs text-slate-500">{item.office}</p></td><td className="px-4 py-3">{vehicleLabel(item.vehicleType,item.otherVehicle)}</td><td className="max-w-56 px-4 py-3">{item.destination}</td><td className="px-4 py-3">{formatTravelDateTime(item.departureDate, item.departureTime)}</td><td className="px-4 py-3"><div className="flex flex-col gap-1"><span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium ${statusClass(item)}`}>{item.status !== 'approved' && item.status !== 'processed' && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />}{reviewStatus(item)}</span>{item.status !== 'approved' && item.status !== 'processed' && <span className="text-[11px] font-medium text-amber-700">⚠️ Signature withheld until approved</span>}</div></td><td className="px-4 py-3"><p>{item.choReviewedByName || '—'}</p>{item.choReviewedAt && <p className="text-xs text-slate-500">{dateOnly(item.choReviewedAt)}</p>}</td><td className="px-4 py-3"><div className="flex gap-1"><button title="Preview request" onClick={()=>setPreviewing(item)} className="flex h-9 w-9 items-center justify-center text-sky-700 hover:bg-sky-50"><Eye className="h-4 w-4"/></button><button title="Download DOCX" onClick={()=>download(item)} className="flex h-9 w-9 items-center justify-center text-emerald-700 hover:bg-emerald-50"><Download className="h-4 w-4"/></button>{isCho ? <><button title={item.status === 'approved' ? 'Edit remarks' : 'Edit request'} onClick={()=>setEditing(item)} className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-100"><Pencil className="h-4 w-4"/></button><button title="Delete request" disabled={item.status === 'approved'} onClick={()=>remove(item)} className="flex h-9 w-9 items-center justify-center text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 className="h-4 w-4"/></button></> : item.status !== 'approved' && <button title="Approve CHO request" onClick={()=>approve(item)} className="flex h-9 w-9 items-center justify-center text-emerald-700 hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4"/></button>}</div></td></tr>)}</tbody></table></div></div>
    {editing !== undefined && <RequestForm initial={editing} options={options} onClose={()=>setEditing(undefined)} onSaved={async()=>{setEditing(undefined);await load();loadOptions()}} />}
    {previewing && <VehicleRequestPreview request={previewing} onClose={()=>setPreviewing(null)} />}
  </div>
}
