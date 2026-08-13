import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import StepCaseStudy from './StepCaseStudy'
import StepRequirements from './StepRequirements'

const EDITABLE_STATUSES = ['encoding', 'for_review', 'recommending_approval', 'for_approval']
const LOCKED_STATUSES = ['intake']

export default function TabCaseStudy() {
  const { caseData, onUpdate, goToTab } = useOutletContext()
  const { status } = caseData
  // Owned here (not inside StepRequirements) purely so it survives that component
  // re-rendering; the actual selection UI and its auto-save live in StepRequirements,
  // right next to the checklist it drives.
  const [assistanceKinds, setAssistanceKinds] = useState(caseData.plainDetails?.assistanceKinds || [])

  if (LOCKED_STATUSES.includes(status)) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        The case study form is not yet available. Complete the intake stage first.
      </div>
    )
  }

  const readOnly = !EDITABLE_STATUSES.includes(status)

  return (
    <div className="space-y-4">
      <StepRequirements
        caseData={caseData}
        onUpdate={onUpdate}
        locked={readOnly}
        plainAssistanceKinds={assistanceKinds}
        onPlainAssistanceKindsChange={setAssistanceKinds}
      />
      <StepCaseStudy caseData={caseData} onUpdate={onUpdate} readOnly={readOnly} onNext={() => goToTab('case-edit')} />
    </div>
  )
}
