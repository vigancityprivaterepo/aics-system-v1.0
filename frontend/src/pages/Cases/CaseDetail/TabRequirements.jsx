import { useOutletContext } from 'react-router-dom'
import StepRequirements from './StepRequirements'

export default function TabRequirements() {
  const { caseData, onUpdate } = useOutletContext()

  if (caseData.status === 'intake') {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        Requirements will be available after completing the intake stage.
      </div>
    )
  }

  return (
    <StepRequirements
      caseData={caseData}
      onUpdate={onUpdate}
      locked={['approved', 'released', 'rejected'].includes(caseData.status)}
    />
  )
}
