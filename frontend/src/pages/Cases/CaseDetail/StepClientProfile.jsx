import { formatDate } from '../../../lib/utils'
import { IdCardIcon, PhoneIcon, MapPinIcon } from '../../../components/ui/Icons'

export default function StepClientProfile({ client }) {
  if (!client) return null

  return (
    <div className="card">
      <div className="form-section-title flex items-center gap-2">
        <IdCardIcon className="h-4 w-4 text-brand-primary" />
        Client Profile
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="portal-label">Full Name</p>
          <p className="font-semibold text-slate-800">
            {client.lastName}, {client.firstName} {client.middleName || ''}
          </p>
        </div>
        <div>
          <p className="portal-label">Date of Birth</p>
          <p className="text-slate-700">{formatDate(client.dateOfBirth)}</p>
        </div>
        <div>
          <p className="portal-label">Sex</p>
          <p className="text-slate-700">{client.sex || '—'}</p>
        </div>
        <div>
          <p className="portal-label">Civil Status</p>
          <p className="text-slate-700">{client.civilStatus || '—'}</p>
        </div>
        <div>
          <p className="portal-label">Occupation</p>
          <p className="text-slate-700">{client.occupation || '—'}</p>
        </div>
        <div>
          <p className="portal-label">Contact Number</p>
          <p className="text-slate-700">{client.contactNumber || '—'}</p>
        </div>
        <div>
          <p className="portal-label">Client Category</p>
          <p className="text-slate-700 capitalize">{client.clientCategory || 'walk-in'}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="portal-label">Address</p>
          <p className="text-slate-700">
            {[client.barangay, client.municipality, client.province, client.region].filter(Boolean).join(', ')}
          </p>
        </div>
        <div>
          <p className="portal-label">Classifications</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {client.is4ps && <span className="badge badge-green">4Ps</span>}
            {client.isPwd && <span className="badge badge-blue">PWD</span>}
            {client.isSenior && <span className="badge badge-amber">Senior Citizen</span>}
            {!client.is4ps && !client.isPwd && !client.isSenior && <span className="text-slate-400 text-xs">None</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
