export function isApplicantProfileComplete(applicant) {
  if (!applicant) return false

  return Boolean(
    applicant.firstName?.trim()
    && applicant.lastName?.trim()
    && applicant.mobileNumber?.trim()
    && applicant.dateOfBirth
    && applicant.sex?.trim()
    && applicant.civilStatus?.trim()
    && applicant.barangay?.trim()
    && applicant.municipality?.trim()
    && applicant.province?.trim()
    && applicant.region?.trim()
    && applicant.occupation?.trim()
    && applicant.religion?.trim()
  )
}
