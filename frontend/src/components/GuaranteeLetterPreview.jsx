import { formatCurrency, numberToWords } from '../lib/utils'
import dayjs from 'dayjs'

export default function GuaranteeLetterPreview({ caseData, clientData, burialData }) {
  const today = dayjs().format('MMMM D, YYYY')
  const amount = parseFloat(burialData?.amount || caseData?.amount || 0)
  const amountInWords = numberToWords(amount)
  const dateOfDeath = burialData?.dateOfDeath ? dayjs(burialData.dateOfDeath).format('MMMM D, YYYY') : ''

  return (
    <div className="bg-white p-8 text-sm font-body" style={{ fontFamily: 'Times New Roman, serif', lineHeight: '1.6' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[#0c2340] pb-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full border-2 border-[#0c2340] flex items-center justify-center text-[#0c2340] text-xs font-bold text-center leading-tight">
            DSWD<br/>SEAL
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Republic of the Philippines</p>
            <p className="text-base font-bold text-[#0c2340] uppercase tracking-wide">
              Department of Social Welfare and Development
            </p>
            <p className="text-xs text-slate-600">Field Office — AICS Program</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Date:</p>
          <p className="font-semibold">{today}</p>
          <p className="text-xs text-slate-500 mt-1">Case No:</p>
          <p className="font-mono text-xs font-bold">{clientData?.caseNumber || 'AICS-0000-00-000000'}</p>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <p className="text-lg font-bold uppercase tracking-widest text-[#0c2340] underline">
          Guarantee Letter
        </p>
      </div>

      {/* Recipient */}
      <div className="mb-4">
        <p>TO WHOM IT MAY CONCERN,</p>
      </div>

      {/* Body */}
      <div className="space-y-4 text-justify">
        <p>
          This is to certify that <strong>{clientData?.firstName} {clientData?.middleName} {clientData?.lastName}</strong>, 
          {' '}a resident of <strong>{clientData?.barangay}, {clientData?.municipality}, {clientData?.province}</strong>, 
          is a bona fide beneficiary of the <strong>Assistance to Individuals in Crisis Situation (AICS)</strong> 
          program under the Department of Social Welfare and Development (DSWD).
        </p>

        <p>
          This office hereby <strong>GUARANTEES</strong> payment to{' '}
          <strong>{burialData?.funeralHome || '___________________________'}</strong>{' '}
          ({burialData?.funeralHomeOwner || '___________________________'}){' '}
          of <strong>{burialData?.funeralOwnerAddress || '___________________________'}</strong>{' '}
          in the amount of <strong>{formatCurrency(amount)}</strong>{' '}
          (<em>{amountInWords}</em>) for the burial/funeral expenses of the late{' '}
          <strong>{burialData?.deceasedName || '___________________________'}</strong>, 
          who passed away on{' '}
          <strong>{dateOfDeath || '_______________'}</strong>{' '}
          due to <em>{burialData?.causeOfDeath || '___________________________'}</em>.
        </p>

        <p>
          This guarantee is issued in connection with the social case study prepared by the assigned 
          social worker and approved by this office.
        </p>
      </div>

      {/* Signatures */}
      <div className="mt-12 grid grid-cols-2 gap-8">
        <div>
          <div className="border-b border-[#0c2340] pb-1 mb-1 text-center">
            <p className="font-bold text-[#0c2340]">
              {caseData?.socialWorkerName || 'Social Worker Name'}
            </p>
          </div>
          <p className="text-center text-xs text-slate-500">Social Worker</p>
          <p className="text-center text-xs text-slate-400">Vigan AICS Program</p>
          <p className="text-center text-xs text-slate-400">Vigan AICS Program</p>
        </div>
        <div>
          <div className="border-b border-[#0c2340] pb-1 mb-1 text-center">
            <p className="font-bold text-[#0c2340]">Supervisor Name</p>
          </div>
          <p className="text-center text-xs text-slate-500">Supervising Social Welfare Officer</p>
          <p className="text-center text-xs text-slate-400">Approving Authority</p>
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-8 border-t border-slate-200 pt-3">
        <p className="text-xs text-slate-400 text-center italic">
          This guarantee letter is valid only for the amount and purpose stated above. 
          Any alterations render this document void.
        </p>
      </div>
    </div>
  )
}
