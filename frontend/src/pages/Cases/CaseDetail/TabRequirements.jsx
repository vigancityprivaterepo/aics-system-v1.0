import { useOutletContext } from 'react-router-dom'
import StepRequirements from './StepRequirements'

export default function TabRequirements() {
  const { caseData, onUpdate } = useOutletContext()

  if (caseData.portalApplicationContext?.applicationId) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-700">
        This case came from the portal. Verify the physical requirements submitted at the office before proceeding to case study encoding.
      </div>
    )
  }

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
      locked={caseData.status !== 'requirements'}
    />
  )
}
