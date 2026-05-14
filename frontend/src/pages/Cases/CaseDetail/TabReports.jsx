import StepReports from './StepReports'
import { useOutletContext } from 'react-router-dom'

export default function TabReports() {
  const { caseData } = useOutletContext()
  return <StepReports caseData={caseData} />
}
