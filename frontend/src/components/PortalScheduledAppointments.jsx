import { useState } from 'react'

function formatDate(value) {
  if (!value) return 'Not yet available'
  return new Date(value).toLocaleString()
}

export default function PortalScheduledAppointments({ applications, className = '' }) {
  const [selectedScheduledAppointmentId, setSelectedScheduledAppointmentId] = useState('')

  const scheduledApplications = applications.filter((application) => application.appointmentSchedule)
  const resolvedSelectedAppointmentId = scheduledApplications.some(
    (application) => application.id === selectedScheduledAppointmentId
  )
    ? selectedScheduledAppointmentId
    : (scheduledApplications[0]?.id || '')
  const selectedScheduledAppointment = scheduledApplications.find(
    (application) => application.id === resolvedSelectedAppointmentId
  ) || null

  if (scheduledApplications.length === 0) return null

  return (
    <div className={`min-w-[260px] flex-1 rounded-xl border border-teal-200 bg-white p-5 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Scheduled Appointments</p>
      <p className="mt-1 text-sm text-slate-500">{scheduledApplications.length} appointment(s)</p>
      <div className="mt-4">
        <label className="portal-label">Select Appointment</label>
        <select
          value={resolvedSelectedAppointmentId}
          onChange={(event) => setSelectedScheduledAppointmentId(event.target.value)}
          className="portal-input"
        >
          {scheduledApplications.map((application) => (
            <option key={application.id} value={application.id}>
              {(application.referenceNumber || 'Pending')} - {formatDate(application.appointmentSchedule)}
            </option>
          ))}
        </select>
      </div>
      {selectedScheduledAppointment && (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-brand-primary">
            {selectedScheduledAppointment.referenceNumber || 'Pending'}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {selectedScheduledAppointment.applicant?.lastName}, {selectedScheduledAppointment.applicant?.firstName}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {selectedScheduledAppointment.applicant?.email || 'No email provided'}
          </p>
          <p className="mt-3 text-xs font-medium text-teal-700">
            {formatDate(selectedScheduledAppointment.appointmentSchedule)}
          </p>
        </div>
      )}
    </div>
  )
}
