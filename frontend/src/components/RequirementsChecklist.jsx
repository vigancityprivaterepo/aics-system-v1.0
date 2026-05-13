import { CheckIcon, XIcon } from './ui/Icons'
import { cn } from '../lib/utils'

const MEDICINE_REQUIREMENTS = [
  { key: 'prescription', label: 'Prescription' },
  { key: 'medical_cert', label: 'Medical Certificate' },
  { key: 'cho_cert', label: 'Certificate of Unavailability (CHO)' },
  { key: 'indigency', label: 'Certificate of Indigency' },
  { key: 'id_copy', label: 'Photocopy of Valid ID' },
  { key: 'personal_letter', label: 'Personal Letter addressed to the LCE' },
  { key: 'acknowledgement', label: 'Acknowledgement / Certification' },
]

const BURIAL_REQUIREMENTS = [
  { key: 'death_cert', label: 'Death Certificate' },
  { key: 'billing_stmt', label: 'Billing Statement' },
  { key: 'indigency', label: 'Certificate of Indigency' },
  { key: 'id_copy', label: 'Photocopy of Valid ID' },
]

const HOSPITAL_REQUIREMENTS = [
  { key: 'hospital_bill', label: 'Hospital Billing Statement' },
  { key: 'medical_cert', label: 'Medical Certificate' },
  { key: 'indigency', label: 'Certificate of Indigency' },
  { key: 'id_copy', label: 'Photocopy of Valid ID' },
]

const MEDICAL_REQUIREMENTS = [
  { key: 'med_request', label: 'Medical / Lab Request' },
  { key: 'medical_cert', label: 'Medical Certificate' },
  { key: 'indigency', label: 'Certificate of Indigency' },
  { key: 'id_copy', label: 'Photocopy of Valid ID' },
  { key: 'personal_letter', label: 'Personal Letter addressed to the LCE' },
]

const EYEGLASS_REQUIREMENTS = [
  { key: 'prescription',    label: 'Eyeglass Prescription' },
  { key: 'indigency',       label: 'Certificate of Indigency' },
  { key: 'id_copy',         label: 'Photocopy of Valid ID' },
  { key: 'personal_letter', label: 'Personal Letter addressed to the LCE' },
]

const PLAIN_REQUIREMENTS = [
  { key: 'indigency', label: 'Certificate of Indigency' },
  { key: 'id_copy', label: 'Photocopy of Valid ID' },
  { key: 'personal_letter', label: 'Personal Letter addressed to the LCE' },
]

const REQUIREMENTS_BY_TYPE = {
  medicine: MEDICINE_REQUIREMENTS,
  burial: BURIAL_REQUIREMENTS,
  hospital: HOSPITAL_REQUIREMENTS,
  medical: MEDICAL_REQUIREMENTS,
  eyeglass: EYEGLASS_REQUIREMENTS,
  plain: PLAIN_REQUIREMENTS,
}

export default function RequirementsChecklist({ assistanceType, requirements = {}, onChange, readOnly = false }) {
  const items = REQUIREMENTS_BY_TYPE[assistanceType] ?? MEDICINE_REQUIREMENTS

  const handleToggle = (key) => {
    if (readOnly) return
    onChange({ ...requirements, [key]: !requirements[key] })
  }

  const allComplete = items.every((r) => requirements[r.key])
  const completedCount = items.filter((r) => requirements[r.key]).length

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          {completedCount}/{items.length} documents received
        </p>
        <span className={cn(
          'badge',
          allComplete ? 'badge-green' : completedCount > 0 ? 'badge-amber' : 'badge-red'
        )}>
          {allComplete ? 'Complete' : completedCount > 0 ? 'Incomplete' : 'Not Started'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-brand-green transition-all duration-500"
          style={{ width: `${(completedCount / items.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-2">
        {items.map((req) => {
          const checked = !!requirements[req.key]
          return (
            <li key={req.key}>
              <button
                type="button"
                onClick={() => handleToggle(req.key)}
                disabled={readOnly}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-200',
                  checked
                    ? 'border-brand-green/30 bg-emerald-50 text-brand-dark'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                  readOnly && 'cursor-default'
                )}
              >
                <div className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all',
                  checked ? 'border-brand-green bg-brand-green' : 'border-slate-300 bg-white'
                )}>
                  {checked && <CheckIcon className="h-3 w-3 text-white" />}
                </div>
                <span className={cn('text-sm flex-1', checked && 'font-medium')}>
                  {req.label}
                </span>
                {checked && (
                  <span className="text-xs text-brand-teal font-medium">✓ Received</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {!allComplete && !readOnly && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <span className="text-amber-600 mt-0.5">⚠</span>
          <p className="text-xs text-amber-700">
            All documents must be received before proceeding to case study encoding.
          </p>
        </div>
      )}
    </div>
  )
}
