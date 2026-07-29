import { Fragment } from 'react'
import { CheckIcon } from './ui/Icons'
import { cn } from '../lib/utils'

const MEDICINE_REQUIREMENTS = [
  { key: 'personal_letter', label: 'Letter Request' },
  { key: 'medical_cert', label: 'Medical Certificate' },
  { key: 'prescription', label: 'Prescription' },
  { key: 'indigency', label: 'Certificate of Indigency' },
  { key: 'id_copy', label: 'Photocopy of ID' },
  { key: 'cho_cert', label: 'Certificate of No Available Medicine as Prescribed' },
]

const BURIAL_REQUIREMENTS = [
  { key: 'death_cert', label: 'Certified True Copy of Death Certificate' },
  { key: 'billing_stmt', label: 'Billing Statement/Statement of Account' },
  { key: 'indigency', label: 'Certificate of Indigency' },
  { key: 'id_copy', label: 'Photocopy of ID' },
]

const HOSPITAL_REQUIREMENTS = [
  { key: 'clinical_abstract', label: 'Clinical Abstract' },
  { key: 'final_bill', label: 'Final Bill' },
  { key: 'promissory_note', label: 'Promissory Note' },
  { key: 'indigency', label: 'Certificate of Indigency' },
  { key: 'id_copy', label: 'Photocopy of ID' },
]

const MEDICAL_REQUIREMENTS = [
  { key: 'med_request', label: 'Request Form' },
  { key: 'medical_cert', label: 'Medical Certificate' },
  { key: 'price_quotation', label: 'Price Quotation' },
  { key: 'indigency', label: 'Certificate of Indigency' },
  { key: 'id_copy', label: 'Photocopy of ID' },
]

const EYEGLASS_REQUIREMENTS = [
  { key: 'prescription', label: 'Prescription' },
  { key: 'indigency', label: 'Certificate of Indigency' },
  { key: 'id_copy', label: 'Photocopy of ID' },
]

const PLAIN_REQUIREMENTS = [
  { key: 'indigency', label: 'Certificate of Indigency' },
  { key: 'id_copy', label: 'Photocopy of ID' },
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

const CGV_REQUIREMENT_ROWS = [
  { no: 1, medicine: { key: 'personal_letter', label: 'Letter Request' }, medical: { key: 'med_request', label: 'Request Form' }, hospital: { key: 'clinical_abstract', label: 'Clinical Abstract' }, burial: { key: 'death_cert', label: 'Certified True Copy of Death Certificate' }, eyeglass: null },
  { no: 2, medicine: { key: 'medical_cert', label: 'Medical Certificate' }, medical: { key: 'medical_cert', label: 'Medical Certificate' }, hospital: { key: 'final_bill', label: 'Final Bill' }, burial: { key: 'billing_stmt', label: 'Billing Statement/Statement of Account' }, eyeglass: null },
  { no: 3, medicine: { key: 'prescription', label: 'Prescription' }, medical: { key: 'price_quotation', label: 'Price Quotation' }, hospital: { key: 'promissory_note', label: 'Promissory Note' }, burial: { key: 'indigency', label: 'Certificate of Indigency' }, eyeglass: { key: 'prescription', label: 'Prescription' } },
  { no: 4, medicine: { key: 'indigency', label: 'Certificate of Indigency' }, medical: { key: 'indigency', label: 'Certificate of Indigency' }, hospital: { key: 'indigency', label: 'Certificate of Indigency' }, burial: { key: 'id_copy', label: 'Photocopy of ID' }, eyeglass: { key: 'indigency', label: 'Certificate of Indigency' } },
  { no: 5, medicine: { key: 'id_copy', label: 'Photocopy of ID' }, medical: { key: 'id_copy', label: 'Photocopy of ID' }, hospital: { key: 'id_copy', label: 'Photocopy of ID' }, burial: null, eyeglass: { key: 'id_copy', label: 'Photocopy of ID' } },
  { no: 6, medicine: { key: 'cho_cert', label: 'Certificate of No Available Medicine as Prescribed' }, medical: null, burial: null, hospital: null, eyeglass: null },
]

const CGV_TYPES = [
  { key: 'medicine', label: 'Medicine' },
  { key: 'medical', label: 'Medical' },
  { key: 'hospital', label: 'Hospital' },
  { key: 'burial', label: 'Burial' },
  { key: 'eyeglass', label: 'Eyeglass' },
]

export default function RequirementsChecklist({ assistanceType, requirements = {}, onChange, readOnly = false, variant = 'list' }) {
  const items = REQUIREMENTS_BY_TYPE[assistanceType] ?? MEDICINE_REQUIREMENTS

  const handleToggle = (key) => {
    if (readOnly) return
    onChange({ ...requirements, [key]: !requirements[key] })
  }

  const allComplete = items.every((r) => requirements[r.key])
  const completedCount = items.filter((r) => requirements[r.key]).length

  if (variant === 'cgvTable') {
    const activeTypes = assistanceType === 'plain'
      ? new Set(CGV_TYPES.map((type) => type.key))
      : new Set([assistanceType])
    const activeKeys = [...new Set(CGV_REQUIREMENT_ROWS.map((row) => (
      CGV_TYPES.filter((type) => activeTypes.has(type.key)).map((type) => row[type.key]).filter(Boolean)
    )).flat().map((item) => item.key))]
    const completedCgvCount = activeKeys.filter((key) => requirements[key]).length

    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            {completedCgvCount}/{activeKeys.length} CGV document checks marked
          </p>
          <span className="badge badge-slate">Manual reviewer checklist</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[1120px] w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-800">
                <th className="w-10 border border-slate-300 px-2 py-3" />
                {CGV_TYPES.map((type) => (
                  <th key={type.key} colSpan="2" className={cn(
                    'border border-slate-300 px-3 py-3 text-center font-bold uppercase',
                    activeTypes.has(type.key) && 'bg-emerald-50 text-emerald-800'
                  )}>
                    {type.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CGV_REQUIREMENT_ROWS.map((row) => (
                <tr key={row.no} className="bg-sky-700/70 text-slate-950">
                  <td className="border border-slate-800 px-2 py-3 text-center font-semibold">{row.no}</td>
                  {CGV_TYPES.map((type) => {
                    const item = row[type.key]
                    const active = activeTypes.has(type.key)
                    const checked = item ? !!requirements[item.key] : false
                    return (
                      <Fragment key={type.key}>
                        <td className={cn(
                          'border border-slate-800 px-3 py-3 text-center align-middle font-medium',
                          !item && 'bg-sky-700/40',
                          active && item && 'bg-sky-600/80'
                        )}>
                          {item?.label || ''}
                        </td>
                        <td className={cn(
                          'w-12 border border-slate-800 px-2 py-3 text-center align-middle',
                          active && item && 'bg-sky-600/80'
                        )}>
                          {item && (
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={readOnly || !active}
                              onChange={() => handleToggle(item.key)}
                              className="h-4 w-4 accent-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              title={active ? item.label : `Not applicable to ${assistanceType} assistance`}
                            />
                          )}
                        </td>
                      </Fragment>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

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
                  'w-full flex items-center gap-3 rounded-lg border px-4 py-3 min-h-[44px] text-left transition-all duration-200',
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
          <span className="text-amber-600 mt-0.5">⚠️</span>
          <p className="text-xs text-amber-700">
            All documents must be received before proceeding to case study encoding.
          </p>
        </div>
      )}
    </div>
  )
}



