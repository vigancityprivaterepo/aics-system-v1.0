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
  const { caseData, onUpdate, readOnlyAccess, goToTab } = useOutletContext()
  const DetailForm = DETAIL_FORMS[caseData.assistanceType] ?? null

  if (readOnlyAccess) {
    const lockedForReview = ['for_review', 'recommending_approval', 'for_approval'].includes(caseData.status)
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        {lockedForReview
          ? 'Case maker edit locked. Wait for reviewer action or return to encoding.'
          : "You can view this case report, but cannot edit details for another case maker's case."}
      </div>
    )
  }

  return DetailForm ? <DetailForm caseData={caseData} onUpdate={onUpdate} onNext={() => goToTab('reports')} /> : null
}
