import { useOutletContext } from 'react-router-dom'
import StepClientProfile from './StepClientProfile'

export default function TabClientProfile() {
  const { caseData, onUpdate } = useOutletContext()
  return <StepClientProfile client={caseData.client} caseData={caseData} onUpdate={onUpdate} />
}
