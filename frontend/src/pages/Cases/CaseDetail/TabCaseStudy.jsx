import { useOutletContext } from 'react-router-dom'
import StepCaseStudy from './StepCaseStudy'
import StepRequirements from './StepRequirements'

const EDITABLE_STATUSES = ['encoding', 'for_review', 'recommending_approval', 'for_approval']
const LOCKED_STATUSES = ['intake']

export default function TabCaseStudy() {
  const { caseData, onUpdate, goToTab } = useOutletContext()
  const { status } = caseData

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
        locked={['approved', 'released', 'rejected'].includes(status)}
      />
      <StepCaseStudy caseData={caseData} onUpdate={onUpdate} readOnly={readOnly} onNext={() => goToTab('case-edit')} />
    </div>
  )
}
