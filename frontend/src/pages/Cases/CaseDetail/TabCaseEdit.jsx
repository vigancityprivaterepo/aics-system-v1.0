import { useOutletContext } from 'react-router-dom'
import StepBurialDetails from './StepBurialDetails'
import StepHospitalDetails from './StepHospitalDetails'
import StepMedicalDetails from './StepMedicalDetails'
import StepEyeglassDetails from './StepEyeglassDetails'
import StepMedicineEncode from './StepMedicineEncode'
import StepPlainDetails from './StepPlainDetails'

const DETAIL_FORMS = {
  burial: StepBurialDetails,
  hospital: StepHospitalDetails,
  medical: StepMedicalDetails,
  eyeglass: StepEyeglassDetails,
  medicine: StepMedicineEncode,
  plain: StepPlainDetails,
}

export default function TabCaseEdit() {
  const { caseData, onUpdate } = useOutletContext()
  const DetailForm = DETAIL_FORMS[caseData.assistanceType] ?? null

  return DetailForm ? <DetailForm caseData={caseData} onUpdate={onUpdate} /> : null
}
