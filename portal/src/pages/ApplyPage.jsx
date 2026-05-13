import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024
const ACCEPTED_UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

const assistanceOptions = [
  { value: '', label: 'Select assistance type' },
  { value: 'medicine', label: 'Medicine Assistance' },
  { value: 'medical', label: 'Medical Assistance' },
  { value: 'hospital', label: 'Hospital Assistance' },
  { value: 'burial', label: 'Burial Assistance' },
  { value: 'eyeglass', label: 'Eyeglass Assistance' },
  { value: 'plain', label: 'Plain AICS Assistance' },
]

const requirementMap = {
  medicine: ['Valid government ID', 'Medical prescription', 'Barangay indigency certification'],
  medical: ['Valid government ID', 'Medical certificate', 'Hospital bill or statement of account', 'Barangay indigency certification'],
  hospital: ['Valid government ID', 'Hospital admission papers', 'Statement of account', 'Social case notes if available'],
  burial: ['Valid government ID', 'Death certificate', 'Funeral contract or statement of account', 'Barangay indigency certification'],
  eyeglass: ['Valid government ID', 'Eye examination result', 'Prescription for eyeglasses', 'Barangay indigency certification'],
  plain: ['Valid government ID', 'Letter of request or explanation', 'Supporting crisis document', 'Barangay indigency certification'],
}

const steps = [
  { id: 1, title: 'Request Details', description: 'Select the assistance type and explain the request.' },
  { id: 2, title: 'Household Profile', description: 'Add family and dependent information.' },
  { id: 3, title: 'Requirements', description: 'Review required files and upload documents.' },
  { id: 4, title: 'Review', description: 'Check the application summary before submission.' },
]

const relationshipOptions = [
  { value: '', label: 'Select relationship' },
  { value: 'Self', label: 'Self' },
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Mother', label: 'Mother' },
  { value: 'Father', label: 'Father' },
  { value: 'Son', label: 'Son' },
  { value: 'Daughter', label: 'Daughter' },
  { value: 'Brother', label: 'Brother' },
  { value: 'Sister', label: 'Sister' },
  { value: 'Grandmother', label: 'Grandmother' },
  { value: 'Grandfather', label: 'Grandfather' },
  { value: 'Grandchild', label: 'Grandchild' },
  { value: 'Aunt', label: 'Aunt' },
  { value: 'Uncle', label: 'Uncle' },
  { value: 'Niece', label: 'Niece' },
  { value: 'Nephew', label: 'Nephew' },
  { value: 'Cousin', label: 'Cousin' },
  { value: 'Guardian', label: 'Guardian' },
  { value: 'Other Relative', label: 'Other Relative' },
  { value: 'Non-Relative', label: 'Non-Relative' },
]

const deceasedAddressOptions = [
  'Ayusan Norte',
  'Ayusan Sur',
  'Barangay I (Poblacion)',
  'Barangay II (Poblacion)',
  'Barangay III (Poblacion)',
  'Barangay IV (Poblacion)',
  'Barangay V (Poblacion)',
  'Barangay VI (Poblacion)',
  'Barangay VII (Poblacion)',
  'Barangay VIII (Poblacion)',
  'Barangay IX (Poblacion)',
  'Barraca',
  'Beddeng Daya',
  'Beddeng Laud',
  'Bongtolan',
  'Bulala',
  'Cabalangegan',
  'Cabaroan Daya',
  'Cabaroan Laud',
  'Camangaan',
  'Capangpangan',
  'Mindoro',
  'Nagsangalan',
  'Pantay Daya',
  'Pantay Fatima',
  'Pantay Laud',
  'Paoa',
  'Paratong',
  'Pong-ol',
  'Purok-a-bassit',
  'Purok-a-dackel',
  'Raois',
  'Rugsuanan',
  'Salindeg',
  'San Jose',
  'San Julian Norte',
  'San Julian Sur',
  'San Pedro',
  'Tamag',
]

const civilStatusOptions = [
  '',
  'Single',
  'Married',
  'Widowed',
  'Separated',
  'Live-in',
]

const sexOptions = [
  '',
  'Male',
  'Female',
]

const intermentPlaceOptions = [
  'Vigan Public Cemetery',
  'Jardin De Caridad Memorial Park',
  'Vigan Catholic Cemetery',
  'Ayusan Catholic Cemetery',
  'Loyola Cemetery',
]

const initialForm = {
  assistanceType: '',
  contactNumber: '',
  hospitalFacilityId: '',
  medicineItemIds: [],
  funeralHomeId: '',
  deceasedName: '',
  deceasedAddress: '',
  deceasedAge: '',
  deceasedOccupation: '',
  deceasedCivilStatus: '',
  deceasedSex: '',
  typeOfBill: '',
  intermentDate: '',
  intermentPlace: '',
  conformeName: '',
  conformeRelationship: '',
  doctorName: '',
  doctorPosition: '',
  clinicName: '',
  clinicAddress: '',
  medicalRequestedAssistance: '',
  reason: '',
  householdMembers: [{ name: '', relationship: '', age: '', occupation: '' }],
}

export default function ApplyPage() {
  const applicant = useAuthStore((s) => s.applicant)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('draft')

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    ...initialForm,
    contactNumber: applicant?.mobileNumber || '',
  })
  const [applicationId, setApplicationId] = useState(draftId)
  const [documents, setDocuments] = useState([])
  const [docSubStep, setDocSubStep] = useState(0)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [hospitalFacilities, setHospitalFacilities] = useState([])
  const [medicineItems, setMedicineItems] = useState([])
  const [hospitalSearch, setHospitalSearch] = useState('')
  const [medicineSearch, setMedicineSearch] = useState('')
  const [showHospitalResults, setShowHospitalResults] = useState(false)
  const [showMedicineResults, setShowMedicineResults] = useState(false)
  const [openRelationshipIndex, setOpenRelationshipIndex] = useState(null)
  const [showBurialRelationshipOptions, setShowBurialRelationshipOptions] = useState(false)
  const [showPatientRelationshipOptions, setShowPatientRelationshipOptions] = useState(false)
  const [funeralHomes, setFuneralHomes] = useState([])
  const [funeralSearch, setFuneralSearch] = useState('')
  const [showFuneralResults, setShowFuneralResults] = useState(false)
  const [loading, setLoading] = useState(Boolean(draftId))
  const [saving, setSaving] = useState(false)
  const [uploadingKey, setUploadingKey] = useState(null)
  const [applicationStatus, setApplicationStatus] = useState(null)
  const [applicationAdminNotes, setApplicationAdminNotes] = useState(null)

  useEffect(() => {
    if (draftId) return

    let active = true

    const guardAgainstDuplicateActiveApplications = async () => {
      setLoading(true)
      try {
        const res = await api.get('/applications/mine')
        if (!active) return

        const activeApplication = (res.data.applications || []).find(
          (application) => !['disapproved', 'released'].includes(application.status),
        )

        if (!activeApplication) return

        const redirectTo = ['draft', 'resubmission_required'].includes(activeApplication.status)
          ? `/apply?draft=${activeApplication.id}`
          : `/applications/${activeApplication.id}`

        toast.error('You already have an active application. Please continue your existing application.')
        navigate(redirectTo, { replace: true })
      } catch (error) {
        if (active && error.response?.status !== 404) {
          toast.error(error.response?.data?.message || 'Failed to check existing applications')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void guardAgainstDuplicateActiveApplications()

    return () => {
      active = false
    }
  }, [draftId, navigate])

  const requirementList = requirementMap[form.assistanceType] || []
  const activeDocSubStep = Math.min(docSubStep, Math.max(requirementList.length - 1, 0))
  const documentsByType = requirementList.reduce((accumulator, requirement) => {
    accumulator[requirement] = documents.find((document) => document.documentType === requirement) || null
    return accumulator
  }, {})
  const currentRequirement = requirementList[activeDocSubStep] || null
  const selectedHospital = hospitalFacilities.find((facility) => facility.id === form.hospitalFacilityId) || null
  const selectedMedicines = medicineItems.filter((medicine) => form.medicineItemIds.includes(medicine.id))

  const formatHospitalOption = (facility) => `${facility.facilityName} - ${facility.municipality}, ${facility.province}`
  const formatMedicineOption = (medicine) => `${medicine.genericName}${medicine.brandName ? ` - ${medicine.brandName}` : ''}`
  const formatFuneralOption = (home) => `${home.name}${home.address ? ` - ${home.address}` : ''}`
  const selectedFuneralHome = funeralHomes.find((h) => h.id === form.funeralHomeId) || null
  const funeralResults = funeralHomes
    .filter((h) => {
      const haystack = `${h.name} ${h.ownerName || ''} ${h.address || ''}`.toLowerCase()
      return haystack.includes(funeralSearch.trim().toLowerCase())
    })
    .slice(0, 12)
  const hospitalResults = (() => {
    const query = hospitalSearch.trim().toLowerCase()
    return hospitalFacilities
      .map((facility) => {
        const facilityName = String(facility.facilityName || '').toLowerCase()
        const municipality = String(facility.municipality || '').toLowerCase()
        const province = String(facility.province || '').toLowerCase()
        const facilityType = String(facility.facilityType || '').toLowerCase()
        const fullAddress = String(facility.fullAddress || '').toLowerCase()
        const haystack = `${facilityName} ${municipality} ${province} ${facilityType} ${fullAddress}`.trim()

        if (!query || !haystack.includes(query)) return null

        let rank = 5
        if (facilityName === query) rank = 0
        else if (facilityName.startsWith(query)) rank = 1
        else if (municipality.startsWith(query) || province.startsWith(query)) rank = 2
        else if (facilityName.split(/\s+/).some((part) => part.startsWith(query))) rank = 3
        else if (
          municipality.split(/\s+/).some((part) => part.startsWith(query))
          || province.split(/\s+/).some((part) => part.startsWith(query))
        ) rank = 4

        return { facility, rank, label: formatHospitalOption(facility).toLowerCase() }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank
        return a.label.localeCompare(b.label)
      })
      .slice(0, 12)
      .map((entry) => entry.facility)
  })()
  const medicineResults = (() => {
    const query = medicineSearch.trim().toLowerCase()
    return medicineItems
      .map((medicine) => {
        const genericName = String(medicine.genericName || '').toLowerCase()
        const brandName = String(medicine.brandName || '').toLowerCase()
        const unit = String(medicine.unit || '').toLowerCase()
        const strength = String(medicine.strength || '').toLowerCase()
        const category = String(medicine.category || '').toLowerCase()
        const haystack = `${genericName} ${brandName} ${unit} ${strength} ${category}`.trim()

        if (!query || !haystack.includes(query)) return null

        let rank = 5
        if (genericName === query || brandName === query) rank = 0
        else if (genericName.startsWith(query)) rank = 1
        else if (brandName.startsWith(query)) rank = 2
        else if (genericName.split(/\s+/).some((part) => part.startsWith(query))) rank = 3
        else if (brandName.split(/\s+/).some((part) => part.startsWith(query))) rank = 4

        return { medicine, rank, label: formatMedicineOption(medicine).toLowerCase() }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank
        return a.label.localeCompare(b.label)
      })
      .slice(0, 12)
      .map((entry) => entry.medicine)
  })()

  useEffect(() => {
    const loadHospitalFacilities = async () => {
      try {
        const res = await api.get('/applications/hospital-facilities')
        setHospitalFacilities(res.data.facilities || [])
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load hospital facilities')
      }
    }

    loadHospitalFacilities()
  }, [])

  useEffect(() => {
    const loadMedicineItems = async () => {
      try {
        const res = await api.get('/applications/medicine-items')
        setMedicineItems(res.data.medicines || [])
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load medicine items')
      }
    }

    loadMedicineItems()
  }, [])

  useEffect(() => {
    const loadFuneralHomes = async () => {
      try {
        const res = await api.get('/applications/funeral-homes')
        setFuneralHomes(res.data.funeralHomes || [])
      } catch { /* silent - funeral home is optional */ }
    }
    loadFuneralHomes()
  }, [])

  useEffect(() => {
    if (!draftId) return

    const loadDraft = async () => {
      await Promise.resolve()
      setLoading(true)
      try {
        const res = await api.get(`/applications/${draftId}`)
        const application = res.data.application
        setApplicationId(application.id)
        setDocuments(application.documents || [])
        setForm({
          assistanceType: application.assistanceType,
          contactNumber: application.contactNumber || applicant?.mobileNumber || '',
          hospitalFacilityId: application.metadata?.hospitalFacilityId || '',
          medicineItemIds: Array.isArray(application.metadata?.medicineItemIds)
            ? application.metadata.medicineItemIds
            : application.metadata?.medicineItemId
              ? [application.metadata.medicineItemId]
              : [],
          funeralHomeId: application.metadata?.funeralHomeId || '',
          deceasedName: application.metadata?.deceasedName || '',
          deceasedAddress: application.metadata?.deceasedAddress || '',
          deceasedAge: application.metadata?.deceasedAge || '',
          deceasedOccupation: application.metadata?.deceasedOccupation || '',
          deceasedCivilStatus: application.metadata?.deceasedCivilStatus || '',
          deceasedSex: application.metadata?.deceasedSex || '',
          typeOfBill: application.metadata?.typeOfBill || '',
          intermentDate: application.metadata?.intermentDate || '',
          intermentPlace: application.metadata?.intermentPlace || '',
          conformeName: application.metadata?.conformeName || '',
          conformeRelationship: application.metadata?.conformeRelationship || '',
          doctorName: application.metadata?.doctorName || '',
          doctorPosition: application.metadata?.doctorPosition || '',
          clinicName: application.metadata?.clinicName || '',
          clinicAddress: application.metadata?.clinicAddress || '',
          medicalRequestedAssistance: application.metadata?.medicalRequestedAssistance || application.metadata?.medicalType || '',
          reason: application.reason || '',
          householdMembers: application.householdMembers?.length
            ? application.householdMembers.map((member) => ({
              name: member.name || '',
              relationship: member.relationship || '',
              age: member.age || '',
              occupation: member.occupation || '',
            }))
            : [{ name: '', relationship: '', age: '', occupation: '' }],
        })
        setHospitalSearch(application.metadata?.hospitalFacilityName ? `${application.metadata.hospitalFacilityName} - ${application.metadata.hospitalMunicipality || ''}${application.metadata.hospitalProvince ? `, ${application.metadata.hospitalProvince}` : ''}`.trim().replace(/\s+,/g, ',') : '')
        setMedicineSearch('')
        setFuneralSearch(application.metadata?.funeralHomeName ? `${application.metadata.funeralHomeName}${application.metadata.funeralHomeAddress ? ` - ${application.metadata.funeralHomeAddress}` : ''}` : '')
        setApplicationStatus(application.status)
        setApplicationAdminNotes(application.adminNotes || null)
        if (application.status === 'resubmission_required') {
          setStep(3)
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load application')
      } finally {
        setLoading(false)
      }
    }

    loadDraft()
  }, [applicant?.mobileNumber, draftId])

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
  }

  const updateHouseholdMember = (index, field, value) => {
    setForm((current) => ({
      ...current,
      householdMembers: current.householdMembers.map((member, memberIndex) => (
        memberIndex === index ? { ...member, [field]: value } : member
      )),
    }))
  }

  const addHouseholdMember = () => {
    setForm((current) => ({
      ...current,
      householdMembers: [...current.householdMembers, { name: '', relationship: '', age: '', occupation: '' }],
    }))
  }

  const removeHouseholdMember = (index) => {
    setForm((current) => ({
      ...current,
      householdMembers: current.householdMembers.length === 1
        ? current.householdMembers
        : current.householdMembers.filter((_, memberIndex) => memberIndex !== index),
    }))
  }

  const buildPayload = () => ({
    assistanceType: form.assistanceType,
    contactNumber: form.contactNumber.trim(),
    hospitalFacilityId: form.hospitalFacilityId || null,
    medicineItemIds: form.medicineItemIds,
    reason: form.reason.trim(),
    metadata: {
      conformeName: form.conformeName.trim() || null,
      conformeRelationship: form.conformeRelationship.trim() || null,
      ...(['hospital', 'medical'].includes(form.assistanceType)
        ? {
            doctorName: form.doctorName.trim() || null,
            doctorPosition: form.doctorPosition.trim() || null,
          }
        : {}),
      ...(form.assistanceType === 'eyeglass'
        ? {
            doctorName: form.doctorName.trim() || null,
            clinicName: form.clinicName.trim() || null,
            clinicAddress: form.clinicAddress.trim() || null,
          }
        : {}),
      ...(form.assistanceType === 'medical'
        ? {
            medicalRequestedAssistance: form.medicalRequestedAssistance.trim() || null,
            medicalType: form.medicalRequestedAssistance.trim() || null,
            operationType: form.medicalRequestedAssistance.trim() || null,
          }
        : {}),
      ...(form.assistanceType === 'burial'
        ? {
            deceasedName: form.deceasedName.trim(),
            deceasedAddress: form.deceasedAddress.trim(),
            deceasedAge: form.deceasedAge === '' ? null : Number(form.deceasedAge),
            deceasedOccupation: form.deceasedOccupation.trim() || null,
            deceasedCivilStatus: form.deceasedCivilStatus.trim() || null,
            deceasedSex: form.deceasedSex || null,
            typeOfBill: form.typeOfBill.trim() || null,
            intermentDate: form.intermentDate || null,
            intermentPlace: form.intermentPlace.trim() || null,
            funeralHomeId: form.funeralHomeId || null,
            funeralHomeName: selectedFuneralHome?.name || null,
            funeralHomeOwnerName: selectedFuneralHome?.ownerName || null,
            funeralHomeAddress: selectedFuneralHome?.address || null,
          }
        : {}),
    },
    householdMembers: form.householdMembers
      .map((member) => ({
        name: member.name.trim(),
        relationship: member.relationship.trim(),
        age: member.age === '' ? null : Number(member.age),
        occupation: member.occupation.trim() || null,
      })),
  })

  const validateDraftFields = () => {
    if (!form.assistanceType) {
      toast.error('Assistance type is required')
      setStep(1)
      return false
    }
    if (!form.contactNumber.trim()) {
      toast.error('Contact number is required')
      setStep(1)
      return false
    }
    if (!form.reason.trim()) {
      toast.error('Reason for assistance is required')
      setStep(1)
      return false
    }
    if ((form.assistanceType === 'medical' || form.assistanceType === 'hospital') && !form.hospitalFacilityId) {
      toast.error('Hospital selection is required for this assistance type')
      setStep(1)
      return false
    }
    if ((form.assistanceType === 'medical' || form.assistanceType === 'hospital') && !form.doctorName.trim()) {
      toast.error('Doctor / physician name is required for this assistance type')
      setStep(1)
      return false
    }
    if ((form.assistanceType === 'medical' || form.assistanceType === 'hospital') && !form.doctorPosition.trim()) {
      toast.error('Doctor position / title is required for this assistance type')
      setStep(1)
      return false
    }
    if (form.assistanceType === 'medical' && !form.medicalRequestedAssistance.trim()) {
      toast.error('Requested medical assistance is required for medical assistance')
      setStep(1)
      return false
    }
    if (form.assistanceType === 'medicine' && form.medicineItemIds.length === 0) {
      toast.error('At least one medicine selection is required for medicine assistance')
      setStep(1)
      return false
    }
    if (!form.householdMembers.length) {
      toast.error('At least one family dependent is required')
      setStep(2)
      return false
    }
    const incompleteMemberIndex = form.householdMembers.findIndex((member) => (
      !member.name.trim()
      || !member.relationship.trim()
      || member.age === ''
      || Number.isNaN(Number(member.age))
      || !member.occupation.trim()
    ))
    if (incompleteMemberIndex >= 0) {
      toast.error(`Complete all required fields for household member ${incompleteMemberIndex + 1}`)
      setStep(2)
      return false
    }
    return true
  }

  const validateSubmitFields = () => {
    if (!validateDraftFields()) return false
    if (form.assistanceType === 'burial' && !form.deceasedName.trim()) {
      toast.error('Name of the deceased is required for burial assistance')
      setStep(1)
      return false
    }
    if (form.assistanceType === 'burial' && !form.funeralHomeId) {
      toast.error('Funeral home selection is required for burial assistance')
      setStep(1)
      return false
    }
    if (form.assistanceType === 'burial' && !form.deceasedAddress.trim()) {
      toast.error('Deceased address is required for burial assistance')
      setStep(1)
      return false
    }
    if (form.assistanceType === 'burial' && (form.deceasedAge === '' || isNaN(Number(form.deceasedAge)))) {
      toast.error('Age of the deceased is required for burial assistance')
      setStep(1)
      return false
    }
    if (form.assistanceType === 'burial' && !form.deceasedOccupation.trim()) {
      toast.error('Occupation of the deceased is required for burial assistance')
      setStep(1)
      return false
    }
    if (form.assistanceType === 'burial' && !form.deceasedCivilStatus.trim()) {
      toast.error('Civil status of the deceased is required for burial assistance')
      setStep(1)
      return false
    }
    if (form.assistanceType === 'burial' && !form.deceasedSex) {
      toast.error('Sex of the deceased is required for burial assistance')
      setStep(1)
      return false
    }
    if (form.assistanceType === 'burial' && !form.conformeName.trim()) {
      toast.error('Conforme name is required for burial assistance')
      setStep(1)
      return false
    }
    if (form.assistanceType === 'burial' && !form.conformeRelationship.trim()) {
      toast.error('Relationship to deceased is required for burial assistance')
      setStep(1)
      return false
    }
    if (form.assistanceType === 'burial' && !form.intermentPlace.trim()) {
      toast.error('Place of interment is required for burial assistance')
      setStep(1)
      return false
    }
    if (form.assistanceType === 'burial' && !form.intermentDate) {
      toast.error('Date of interment is required for burial assistance')
      setStep(1)
      return false
    }
    return true
  }

  const saveApplication = async ({ silent = false, validationMode = 'draft' } = {}) => {
    if (validationMode === 'draft' && !validateDraftFields()) return null
    if (validationMode === 'submit' && !validateSubmitFields()) return null
    setSaving(true)
    try {
      const payload = buildPayload()
      const res = applicationId
        ? await api.put(`/applications/${applicationId}`, payload)
        : await api.post('/applications', payload)

      const application = res.data.application
      setApplicationId(application.id)
      setDocuments(application.documents || [])
      if (!silent) toast.success('Application saved')
      return application
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save application')
      return null
    } finally {
      setSaving(false)
    }
  }

  const validateDocuments = () => {
    const missing = requirementList.filter((requirement) => !documentsByType[requirement])
    if (missing.length > 0) {
      toast.error(`Upload all required documents before submitting (${missing.length} missing)`)
      setStep(3)
      return false
    }
    return true
  }

  const handleSubmitApplication = async () => {
    if (!validateSubmitFields()) return
    if (!validateDocuments()) return
    const application = await saveApplication({ silent: true, validationMode: 'submit' })
    if (!application) return

    setSaving(true)
    try {
      await api.post(`/applications/${application.id}/submit`)
      toast.success('Application submitted')
      navigate('/applications')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit application')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadDocument = async (documentType, file) => {
    if (!file) return
    if (!ACCEPTED_UPLOAD_TYPES.includes(file.type)) {
      toast.error('Only PDF, JPG, and PNG files are allowed')
      setFileInputKey((current) => current + 1)
      return
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error('File size must not exceed 5 MB')
      setFileInputKey((current) => current + 1)
      return
    }

    let appId = applicationId
    if (!appId) {
      const saved = await saveApplication({ silent: true, validationMode: 'draft' })
      if (!saved) return
      appId = saved.id
    }

    setUploadingKey(documentType)
    try {
      const existingDocument = documentsByType[documentType]
      if (existingDocument) {
        await api.delete(`/applications/documents/${existingDocument.id}`)
      }

      const formData = new FormData()
      formData.append('documentType', documentType)
      formData.append('file', file)
      const res = await api.post(`/applications/${appId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setDocuments((current) => {
        const withoutExisting = current.filter((document) => document.documentType !== documentType)
        return [...withoutExisting, res.data.document]
      })
      setFileInputKey((k) => k + 1)
      toast.success(existingDocument ? 'Document replaced' : 'Document uploaded')
    } catch (error) {
      setFileInputKey((k) => k + 1)
      toast.error(error.response?.data?.message || 'Failed to upload document')
    } finally {
      setUploadingKey(null)
    }
  }

  const handleDeleteDocument = async (documentId) => {
    try {
      await api.delete(`/applications/documents/${documentId}`)
      setDocuments((current) => current.filter((document) => document.id !== documentId))
      toast.success('Document removed')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove document')
    }
  }

  const renderRequestStep = () => (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="portal-label">Assistance Type *</label>
          <select
            value={form.assistanceType}
            onChange={(event) => {
              const nextType = event.target.value
              setDocSubStep(0)
              setForm((current) => ({
                ...current,
                assistanceType: nextType,
                hospitalFacilityId: nextType === 'medical' || nextType === 'hospital' ? current.hospitalFacilityId : '',
                medicineItemIds: nextType === 'medicine' ? current.medicineItemIds : [],
                funeralHomeId: nextType === 'burial' ? current.funeralHomeId : '',
                deceasedName: nextType === 'burial' ? current.deceasedName : '',
                deceasedAddress: nextType === 'burial' ? current.deceasedAddress : '',
                deceasedAge: nextType === 'burial' ? current.deceasedAge : '',
                deceasedOccupation: nextType === 'burial' ? current.deceasedOccupation : '',
                deceasedCivilStatus: nextType === 'burial' ? current.deceasedCivilStatus : '',
                deceasedSex: nextType === 'burial' ? current.deceasedSex : '',
                typeOfBill: nextType === 'burial' ? current.typeOfBill : '',
                intermentDate: nextType === 'burial' ? current.intermentDate : '',
                intermentPlace: nextType === 'burial' ? current.intermentPlace : '',
                conformeName: current.conformeName,
                conformeRelationship: current.conformeRelationship,
                doctorName: (nextType === 'hospital' || nextType === 'medical' || nextType === 'eyeglass') ? current.doctorName : '',
                doctorPosition: (nextType === 'hospital' || nextType === 'medical') ? current.doctorPosition : '',
                clinicName: nextType === 'eyeglass' ? current.clinicName : '',
                clinicAddress: nextType === 'eyeglass' ? current.clinicAddress : '',
                medicalRequestedAssistance: nextType === 'medical' ? current.medicalRequestedAssistance : '',
              }))
              if (nextType !== 'medical' && nextType !== 'hospital') {
                setHospitalSearch('')
                setShowHospitalResults(false)
              }
              if (nextType !== 'medicine') {
                setMedicineSearch('')
                setShowMedicineResults(false)
              }
              if (nextType !== 'burial') {
                setFuneralSearch('')
                setShowFuneralResults(false)
              }
            }}
            className="portal-input"
            required
          >
            {assistanceOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="portal-label">Contact Number *</label>
          <input
            type="text"
            value={form.contactNumber}
            onChange={(event) => updateField('contactNumber', event.target.value)}
            className="portal-input"
            placeholder="09XXXXXXXXX"
            required
          />
        </div>
      </div>

      {form.assistanceType === 'burial' && (
        <div className="space-y-4 portal-panel p-4">
          <div>
            <label className="portal-label">Name of the Deceased *</label>
            <input
              type="text"
              value={form.deceasedName}
              onChange={(event) => updateField('deceasedName', event.target.value)}
              className="portal-input"
              placeholder="Enter the full name of the deceased"
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              These burial details will auto-populate in the office case record once your application is approved.
            </p>
          </div>

          <div className="relative">
            <label className="portal-label">Funeral Home *</label>
            <input
              type="text"
              value={funeralSearch}
              onChange={(event) => {
                const value = event.target.value
                setFuneralSearch(value)
                updateField('funeralHomeId', '')
                setShowFuneralResults(true)
              }}
              onFocus={() => setShowFuneralResults(true)}
              onBlur={() => setTimeout(() => setShowFuneralResults(false), 150)}
              className="portal-input"
              placeholder="Search funeral home"
            />
            {showFuneralResults && funeralSearch.trim() && (
              <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                {funeralResults.length ? funeralResults.map((home) => (
                  <button
                    key={home.id}
                    type="button"
                    onMouseDown={() => {
                      updateField('funeralHomeId', home.id)
                      setFuneralSearch(formatFuneralOption(home))
                      setShowFuneralResults(false)
                    }}
                    className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-emerald-50"
                  >
                    <p className="text-sm font-semibold text-brand-primary">{home.name}</p>
                    {home.ownerName && <p className="mt-0.5 text-xs text-slate-600">Owner: {home.ownerName}</p>}
                    {home.address && <p className="mt-0.5 text-xs text-slate-500">{home.address}</p>}
                  </button>
                )) : (
                  <div className="px-4 py-3 text-sm text-slate-500">No matching funeral home found.</div>
                )}
              </div>
            )}
            {selectedFuneralHome?.address && (
              <p className="mt-2 text-xs text-slate-500">{selectedFuneralHome.address}</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="portal-label">Deceased Address *</label>
              <select
                value={form.deceasedAddress}
                onChange={(event) => updateField('deceasedAddress', event.target.value)}
                className="portal-input"
                required
              >
                <option value="">Select barangay</option>
                {deceasedAddressOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="portal-label">Age *</label>
              <input
                type="number"
                min="0"
                value={form.deceasedAge}
                onChange={(event) => updateField('deceasedAge', event.target.value)}
                className="portal-input"
                placeholder="Age"
              />
            </div>
            <div>
              <label className="portal-label">Occupation *</label>
              <input
                type="text"
                value={form.deceasedOccupation}
                onChange={(event) => updateField('deceasedOccupation', event.target.value)}
                className="portal-input"
                placeholder="Occupation"
              />
            </div>
            <div>
              <label className="portal-label">Civil Status *</label>
              <select
                value={form.deceasedCivilStatus}
                onChange={(event) => updateField('deceasedCivilStatus', event.target.value)}
                className="portal-input"
                required
              >
                <option value="">Select civil status</option>
                {civilStatusOptions
                  .filter((option) => option)
                  .map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                ))}
              </select>
            </div>
            <div>
              <label className="portal-label">Sex *</label>
              <select
                value={form.deceasedSex}
                onChange={(event) => updateField('deceasedSex', event.target.value)}
                className="portal-input"
                required
              >
                <option value="">Select sex</option>
                {sexOptions
                  .filter((option) => option)
                  .map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="portal-label">Type of Bill</label>
              <input
                type="text"
                value={form.typeOfBill}
                onChange={(event) => updateField('typeOfBill', event.target.value)}
                className="portal-input"
                placeholder="e.g. funeral bill, embalming fee"
              />
            </div>
            <div className="md:col-span-2">
              <label className="portal-label">Date of Interment *</label>
              <input
                type="date"
                value={form.intermentDate}
                onChange={(event) => updateField('intermentDate', event.target.value)}
                className="portal-input"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="portal-label">Place of Interment *</label>
              <select
                value={form.intermentPlace}
                onChange={(event) => updateField('intermentPlace', event.target.value)}
                className="portal-input"
                required
              >
                <option value="">Select cemetery...</option>
                {intermentPlaceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value="Others (specify)">Others (specify)</option>
              </select>
            </div>
            <div>
              <label className="portal-label">Conforme Name *</label>
              <input
                type="text"
                value={form.conformeName}
                onChange={(event) => updateField('conformeName', event.target.value)}
                className="portal-input"
                placeholder="Full name of representative / next of kin"
              />
            </div>
            <div>
              <label className="portal-label">Relationship to Deceased *</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBurialRelationshipOptions((current) => !current)}
                  onBlur={() => setTimeout(() => setShowBurialRelationshipOptions(false), 150)}
                  className="portal-input flex items-center justify-between text-left"
                  aria-haspopup="listbox"
                  aria-expanded={showBurialRelationshipOptions}
                >
                  <span className={form.conformeRelationship ? 'text-slate-800' : 'text-slate-400'}>
                    {form.conformeRelationship || 'Select relationship'}
                  </span>
                  <span className="text-slate-500">▼</span>
                </button>
                {showBurialRelationshipOptions && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {relationshipOptions.map((option) => (
                      <button
                        key={option.value || 'placeholder'}
                        type="button"
                        onMouseDown={() => {
                          updateField('conformeRelationship', option.value)
                          setShowBurialRelationshipOptions(false)
                        }}
                        className={`block w-full px-4 py-3 text-left text-sm hover:bg-emerald-50 ${
                          option.value === form.conformeRelationship ? 'bg-emerald-50 font-medium text-brand-primary' : 'text-slate-700'
                        }`}
                        role="option"
                        aria-selected={option.value === form.conformeRelationship}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {form.assistanceType === 'medical' && (
        <div className="space-y-3 portal-panel p-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Requested Medical Assistance</p>
            <p className="mt-1 text-xs text-slate-400">This will be mapped to the medical guarantee letter so the request does not render as a dash.</p>
          </div>
          <div>
            <label className="portal-label">Medical Assistance Requested *</label>
            <input
              type="text"
              value={form.medicalRequestedAssistance}
              onChange={(event) => updateField('medicalRequestedAssistance', event.target.value)}
              className="portal-input"
              placeholder="e.g. consultation fee, laboratory fees, CT scan, operation supplies"
              required
            />
          </div>
        </div>
      )}

      {(form.assistanceType === 'medical' || form.assistanceType === 'hospital') && (
        <div className="relative">
          <label className="portal-label">Hospital Facility *</label>
          <input
            type="text"
            value={hospitalSearch}
            onChange={(event) => {
              const value = event.target.value
              setHospitalSearch(value)
              updateField('hospitalFacilityId', '')
              setShowHospitalResults(true)
            }}
            onFocus={() => setShowHospitalResults(true)}
            className="portal-input"
            placeholder="Search hospital or facility"
            required
          />
          {showHospitalResults && hospitalSearch.trim() && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {hospitalResults.length ? hospitalResults.map((facility) => (
                <button
                  key={facility.id}
                  type="button"
                  onMouseDown={() => {
                    updateField('hospitalFacilityId', facility.id)
                    setHospitalSearch(formatHospitalOption(facility))
                    setShowHospitalResults(false)
                  }}
                  className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-emerald-50"
                >
                  <p className="text-sm font-semibold text-brand-primary">{facility.facilityName}</p>
                  <p className="mt-1 text-xs text-slate-500">{facility.municipality}, {facility.province}</p>
                </button>
              )) : (
                <div className="px-4 py-3 text-sm text-slate-500">No matching hospital facility found.</div>
              )}
            </div>
          )}
          {selectedHospital && (
            <p className="mt-2 text-xs text-slate-500">
              {selectedHospital.facilityType}{selectedHospital.fullAddress ? ` - ${selectedHospital.fullAddress}` : ''}
            </p>
          )}
        </div>
      )}

      {(form.assistanceType === 'hospital' || form.assistanceType === 'medical') && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="portal-label">Doctor / Physician Name *</label>
            <input
              type="text"
              value={form.doctorName}
              onChange={(event) => updateField('doctorName', event.target.value)}
              className="portal-input"
              placeholder="Full name of attending physician"
              required
            />
          </div>
          <div>
            <label className="portal-label">Doctor Position / Title *</label>
            <input
              type="text"
              value={form.doctorPosition}
              onChange={(event) => updateField('doctorPosition', event.target.value)}
              className="portal-input"
              placeholder="e.g. MD, Resident Physician, Specialist"
              required
            />
          </div>
        </div>
      )}

      {form.assistanceType === 'medicine' && (
        <div className="relative">
          <label className="portal-label">Medicine Items *</label>
          <input
            type="text"
            value={medicineSearch}
            onChange={(event) => {
              setMedicineSearch(event.target.value)
              setShowMedicineResults(true)
            }}
            onFocus={() => setShowMedicineResults(true)}
            className="portal-input"
            placeholder="Search medicine and add to your list"
            required
          />
          {showMedicineResults && medicineSearch.trim() && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {medicineResults.length ? medicineResults.map((medicine) => (
                <button
                  key={medicine.id}
                  type="button"
                  onMouseDown={() => {
                    if (!form.medicineItemIds.includes(medicine.id)) {
                      updateField('medicineItemIds', [...form.medicineItemIds, medicine.id])
                    }
                    setMedicineSearch('')
                    setShowMedicineResults(false)
                  }}
                  className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-emerald-50"
                >
                  <p className="text-sm font-semibold text-brand-primary">{medicine.genericName}{medicine.brandName ? ` - ${medicine.brandName}` : ''}</p>
                  <p className="mt-1 text-xs text-slate-500">{[medicine.unit, medicine.strength, medicine.category].filter(Boolean).join(' - ')}</p>
                </button>
              )) : (
                <div className="px-4 py-3 text-sm text-slate-500">No matching medicine found.</div>
              )}
            </div>
          )}
          {selectedMedicines.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedMedicines.map((medicine) => (
                <span key={medicine.id} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  <span>{formatMedicineOption(medicine)}</span>
                  <button
                    type="button"
                    onClick={() => updateField('medicineItemIds', form.medicineItemIds.filter((id) => id !== medicine.id))}
                    className="text-emerald-700 hover:text-emerald-900"
                    aria-label={`Remove ${formatMedicineOption(medicine)}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {form.assistanceType === 'eyeglass' && (
        <div className="space-y-3 portal-panel p-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Optometrist / Clinic Details</p>
            <p className="mt-1 text-xs text-slate-400">These will be used to generate the Guarantee Letter and Endorsement documents.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="portal-label">Doctor / Optometrist Name</label>
              <input
                type="text"
                value={form.doctorName}
                onChange={(event) => updateField('doctorName', event.target.value)}
                className="portal-input"
                placeholder="Full name of the optometrist or doctor"
              />
            </div>
            <div>
              <label className="portal-label">Clinic / Optical Shop Name</label>
              <input
                type="text"
                value={form.clinicName}
                onChange={(event) => updateField('clinicName', event.target.value)}
                className="portal-input"
                placeholder="Name of the clinic or optical shop"
              />
            </div>
            <div className="md:col-span-2">
              <label className="portal-label">Clinic / Optical Shop Address</label>
              <input
                type="text"
                value={form.clinicAddress}
                onChange={(event) => updateField('clinicAddress', event.target.value)}
                className="portal-input"
                placeholder="City / Municipality, Province"
              />
            </div>
          </div>
        </div>
      )}

      {['hospital', 'medical'].includes(form.assistanceType) && (
        <div className="space-y-3 portal-panel p-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Representative / Conforme</p>
            <p className="mt-1 text-xs text-slate-400">Optional - fill this in if someone else is applying on behalf of the patient.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="portal-label">Conforme Name</label>
              <input
                type="text"
                value={form.conformeName}
                onChange={(event) => updateField('conformeName', event.target.value)}
                className="portal-input"
                placeholder="Full name of representative"
              />
            </div>
            <div>
              <label className="portal-label">Relationship to Patient</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPatientRelationshipOptions((current) => !current)}
                  onBlur={() => setTimeout(() => setShowPatientRelationshipOptions(false), 150)}
                  className="portal-input flex items-center justify-between text-left"
                  aria-haspopup="listbox"
                  aria-expanded={showPatientRelationshipOptions}
                >
                  <span className={form.conformeRelationship ? 'text-slate-800' : 'text-slate-400'}>
                    {form.conformeRelationship || 'Select relationship'}
                  </span>
                  <span className="text-slate-500">▼</span>
                </button>
                {showPatientRelationshipOptions && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {relationshipOptions.map((option) => (
                      <button
                        key={option.value || 'placeholder'}
                        type="button"
                        onMouseDown={() => {
                          updateField('conformeRelationship', option.value)
                          setShowPatientRelationshipOptions(false)
                        }}
                        className={`block w-full px-4 py-3 text-left text-sm hover:bg-emerald-50 ${
                          option.value === form.conformeRelationship ? 'bg-emerald-50 font-medium text-brand-primary' : 'text-slate-700'
                        }`}
                        role="option"
                        aria-selected={option.value === form.conformeRelationship}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="portal-panel p-4">
        <p className="text-xs font-medium text-slate-500">Assistance Summary</p>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Selected assistance: <span className="font-medium capitalize text-slate-800">{form.assistanceType}</span>.
          Prepare the listed requirements before final submission.
        </p>
      </div>

      <div>
        <label className="portal-label">Reason for Assistance *</label>
        <textarea
          rows="7"
          value={form.reason}
          onChange={(event) => updateField('reason', event.target.value)}
          className="portal-input"
          placeholder="Tagalog and ilocano will do"
          required
        />
      </div>
    </div>
  )

  const renderHouseholdStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="portal-page-title">Family and Dependents</h2>
          <p className="portal-page-subtitle">Household Information</p>
        </div>
        <button type="button" onClick={addHouseholdMember} className="portal-button-secondary text-sm">
          Add Member
        </button>
      </div>

      <div className="space-y-4">
        {form.householdMembers.map((member, index) => (
          <div key={`member-${index}`} className="portal-panel p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-slate-800">Household Member {index + 1}</p>
              {form.householdMembers.length > 1 && (
                <button type="button" onClick={() => removeHouseholdMember(index)} className="text-xs font-medium text-rose-600">
                  Remove
                </button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="portal-label">Full Name *</label>
                <input
                  type="text"
                  value={member.name}
                  onChange={(event) => updateHouseholdMember(index, 'name', event.target.value)}
                  className="portal-input"
                  placeholder="Full name"
                  required
                />
              </div>
              <div>
                <label className="portal-label">Relationship *</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenRelationshipIndex((current) => current === index ? null : index)}
                    onBlur={() => setTimeout(() => setOpenRelationshipIndex((current) => current === index ? null : current), 150)}
                    className="portal-input flex items-center justify-between text-left"
                    aria-haspopup="listbox"
                    aria-expanded={openRelationshipIndex === index}
                  >
                    <span className={member.relationship ? 'text-slate-800' : 'text-slate-400'}>
                      {member.relationship || 'Select relationship'}
                    </span>
                    <span className="text-slate-500">▾</span>
                  </button>
                  {openRelationshipIndex === index && (
                    <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                      {relationshipOptions.map((option) => (
                        <button
                          key={option.value || 'placeholder'}
                          type="button"
                          onMouseDown={() => {
                            updateHouseholdMember(index, 'relationship', option.value)
                            setOpenRelationshipIndex(null)
                          }}
                          className={`block w-full px-4 py-3 text-left text-sm hover:bg-emerald-50 ${
                            option.value === member.relationship ? 'bg-emerald-50 font-medium text-brand-primary' : 'text-slate-700'
                          }`}
                          role="option"
                          aria-selected={option.value === member.relationship}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="portal-label">Age *</label>
                <input
                  type="number"
                  min="0"
                  value={member.age}
                  onChange={(event) => updateHouseholdMember(index, 'age', event.target.value)}
                  className="portal-input"
                  placeholder="Age"
                  required
                />
              </div>
              <div>
                <label className="portal-label">Occupation *</label>
                <input
                  type="text"
                  value={member.occupation}
                  onChange={(event) => updateHouseholdMember(index, 'occupation', event.target.value)}
                  className="portal-input"
                  placeholder="Occupation"
                  required
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderRequirementsStep = () => (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="portal-page-title">One Requirement at a Time</h2>
        <p className="portal-page-subtitle">Upload Requirements</p>
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          {requirementList.map((requirement, index) => {
            const completed = Boolean(documentsByType[requirement])
            const active = index === activeDocSubStep
            return (
              <button
                key={requirement}
                type="button"
                onClick={() => {
                  if (index <= activeDocSubStep || (index > 0 && documentsByType[requirementList[index - 1]])) {
                    setDocSubStep(index)
                  }
                }}
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  completed
                    ? 'bg-emerald-600'
                    : active
                      ? 'bg-[#0c2340] ring-2 ring-[#0c2340] ring-offset-1'
                      : 'bg-slate-300'
                }`}
                aria-label={`Requirement ${index + 1}`}
              />
            )
          })}
          <span className="ml-2 text-xs text-slate-500">
            Document {Math.min(activeDocSubStep + 1, requirementList.length)} of {requirementList.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${(requirementList.filter((requirement) => documentsByType[requirement]).length / Math.max(requirementList.length, 1)) * 100}%` }}
          />
        </div>
      </div>

      {currentRequirement && (
        <>
          <div className="portal-panel p-5">
            <p className="text-sm font-medium text-slate-500">Document {activeDocSubStep + 1} of {requirementList.length}</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-800">{currentRequirement}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Choose a file - it will upload automatically.
            </p>
          </div>

          <div className="rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
              {uploadingKey === currentRequirement ? (
                <>
                  <div className="h-7 w-7 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
                  <p className="text-sm text-slate-500">Uploading...</p>
                </>
              ) : (
                <>
                  <input
                    key={`${currentRequirement}-${fileInputKey}`}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) handleUploadDocument(currentRequirement, file)
                    }}
                    className="portal-input w-full"
                  />
                  <p className="text-xs text-slate-500">PDF, JPG, PNG - Max 5MB. Uploads automatically on file selection.</p>
                </>
              )}
            </div>
          </div>

          {documentsByType[currentRequirement] && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Uploaded File</p>
                  <p className="mt-1 text-sm text-slate-600">{documentsByType[currentRequirement].originalName}</p>
                  <p className="mt-1 text-xs text-slate-500">Applicants cannot open uploaded documents here. Admin and employee accounts can review them in the office system.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleDeleteDocument(documentsByType[currentRequirement].id)} className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  )

  const renderReviewStep = () => (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="portal-page-title">Application Summary</h2>
        <p className="portal-page-subtitle">Review your request details, household profile, and uploaded requirements before final submission.</p>
      </div>

      <div className="portal-panel divide-y divide-slate-200 overflow-hidden">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Request Details</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Assistance Type</p>
              <p className="mt-1 text-sm font-semibold capitalize text-brand-primary">{form.assistanceType}</p>
            </div>
            {form.assistanceType === 'burial' && (
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500">Name of the Deceased</p>
                <p className="mt-1 text-sm font-semibold text-brand-primary">{form.deceasedName || 'Not provided'}</p>
              </div>
            )}
            {form.assistanceType === 'burial' && (
              <div>
                <p className="text-xs text-slate-500">Sex</p>
                <p className="mt-1 text-sm font-semibold text-brand-primary">{form.deceasedSex || 'Not provided'}</p>
              </div>
            )}
            {form.assistanceType === 'burial' && (
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500">Date of Interment</p>
                <p className="mt-1 text-sm font-semibold text-brand-primary">{form.intermentDate || 'Not provided'}</p>
              </div>
            )}
            {form.assistanceType === 'burial' && (
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500">Place of Interment</p>
                <p className="mt-1 text-sm font-semibold text-brand-primary">{form.intermentPlace || 'Not provided'}</p>
              </div>
            )}
            {form.assistanceType === 'burial' && form.funeralHomeId && (
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500">Funeral Home</p>
                <p className="mt-1 text-sm font-semibold text-brand-primary">
                  {selectedFuneralHome ? formatFuneralOption(selectedFuneralHome) : funeralSearch}
                </p>
              </div>
            )}
            {form.assistanceType === 'burial' && (
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500">Type of Bill</p>
                <p className="mt-1 text-sm font-semibold text-brand-primary">{form.typeOfBill || 'Not provided'}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500">Contact Number</p>
              <p className="mt-1 text-sm font-semibold text-brand-primary">{form.contactNumber}</p>
            </div>
            {(form.assistanceType === 'medical' || form.assistanceType === 'hospital') && (
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500">Hospital Facility</p>
                <p className="mt-1 text-sm font-semibold text-brand-primary">
                  {selectedHospital ? `${selectedHospital.facilityName} - ${selectedHospital.municipality}, ${selectedHospital.province}` : 'Not selected'}
                </p>
              </div>
            )}
            {form.assistanceType === 'medical' && (
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500">Requested Medical Assistance</p>
                <p className="mt-1 text-sm font-semibold text-brand-primary">{form.medicalRequestedAssistance || 'Not provided'}</p>
              </div>
            )}
            {form.assistanceType === 'medicine' && (
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500">Medicine Items</p>
                {selectedMedicines.length ? (
                  <div className="mt-1 space-y-1">
                    {selectedMedicines.map((medicine) => (
                      <p key={medicine.id} className="text-sm font-semibold text-brand-primary">
                        {medicine.genericName}{medicine.brandName ? ` - ${medicine.brandName}` : ''}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-brand-primary">Not selected</p>
                )}
              </div>
            )}
          </div>
          <div className="mt-4">
            <p className="text-xs text-slate-500">Reason for Assistance</p>
            <p className="mt-1 text-sm leading-7 text-slate-700">{form.reason}</p>
          </div>
        </div>

        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Household Profile</p>
          {form.householdMembers.some((member) => member.name.trim() || member.relationship.trim()) ? (
            <div className="mt-4 space-y-3">
              {form.householdMembers
                .filter((member) => member.name.trim() || member.relationship.trim())
                .map((member, index) => (
                  <div key={`${member.name}-${index}`} className="rounded-md border border-slate-200 bg-white px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">{member.name || 'Unnamed member'}</p>
                    <p className="mt-1 text-sm text-slate-600">{member.relationship || 'Relationship not set'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {member.age ? `Age ${member.age}` : 'Age not set'} {member.occupation ? `- ${member.occupation}` : ''}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No household members entered.</p>
          )}
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Requirements</p>
          <div className="mt-4 space-y-3">
            {requirementList.map((requirement) => {
              const document = documentsByType[requirement]
              return (
                <div key={requirement} className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-4 py-3">
                  <span className={`mt-0.5 text-sm font-bold ${document ? 'text-emerald-700' : 'text-rose-500'}`}>
                    {document ? 'OK' : 'NO'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{requirement}</p>
                    <p className="mt-1 text-xs text-slate-500">{document ? document.originalName : 'Not uploaded yet'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="portal-panel p-5 text-sm leading-7 text-slate-600">
        <p className="font-semibold text-brand-primary">Applicant Confirmation</p>
        <p className="mt-2">By submitting this request, you confirm that the information and uploaded files are accurate and may be used by the City Government of Vigan for AICS assessment and verification.</p>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="portal-surface flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <section className="portal-surface p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="portal-page-subtitle">Online Application</p>
            <h1 className="portal-page-title">
              {applicationId
                ? applicationStatus === 'resubmission_required'
                  ? 'Continue Resubmission'
                  : applicationStatus === 'draft'
                    ? 'Continue Draft'
                  : 'Continue Application'
                : 'Apply for Assistance'}
            </h1>
          </div>
          <Link to="/applications" className="portal-button-secondary text-sm">
            View My Applications
          </Link>
        </div>
      </section>

      <section className="portal-surface overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            {steps.map((item) => {
              const isActive = step === item.id
              const isDone = step > item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id < step) setStep(item.id)
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#0c2340] text-white'
                      : isDone
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-white text-slate-500'
                  }`}
                >
                  {item.id}. {item.title}
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">{steps[step - 1].title}</p>
              <p className="text-sm text-slate-500">{steps[step - 1].description}</p>
            </div>
            <p className="text-sm text-slate-500">
              {applicationStatus === 'resubmission_required' ? 'Resubmission in progress' : 'In progress'} | {documents.length} uploaded documents
            </p>
          </div>
        </div>

        <form className="p-6" onSubmit={(event) => event.preventDefault()}>
          {applicationStatus === 'resubmission_required' && (
            <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-xs font-semibold text-amber-800">Resubmission Required</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                The office has requested additional or corrected documents. Go to the <strong>Requirements</strong> step, upload the missing files, then submit your application again.
              </p>
              {applicationAdminNotes && (
                <div className="mt-3 rounded-md border border-amber-300 bg-white px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Staff Notes</p>
                  <p className="mt-1 text-sm leading-7 text-slate-700">{applicationAdminNotes}</p>
                </div>
              )}
            </div>
          )}

          {step === 1 && renderRequestStep()}
          {step === 2 && renderHouseholdStep()}
          {step === 3 && renderRequirementsStep()}
          {step === 4 && renderReviewStep()}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (step === 3 && docSubStep > 0) {
                    setDocSubStep((current) => Math.max(0, current - 1))
                    return
                  }
                  setStep((current) => Math.max(1, current - 1))
                }}
                disabled={step === 1}
                className="portal-button-secondary text-sm disabled:opacity-50"
              >
                Previous
              </button>
              {step < steps.length && (
                <button
                  type="button"
                  onClick={async () => {
                    if (step === 1 && !validateSubmitFields()) return
                    if (step === 2) {
                      const saved = await saveApplication({ silent: true, validationMode: 'draft' })
                      if (!saved) return
                    }
                    if (step === 3) {
                      if (!documentsByType[currentRequirement]) {
                        toast.error('Upload this document before continuing')
                        return
                      }
                      if (docSubStep < requirementList.length - 1) {
                        setDocSubStep((current) => Math.min(requirementList.length - 1, current + 1))
                        return
                      }
                      if (!validateDocuments()) return
                    }
                    setStep((current) => Math.min(steps.length, current + 1))
                  }}
                  disabled={saving}
                  className="portal-button-secondary text-sm disabled:opacity-50"
                >
                  Next
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => saveApplication({ validationMode: 'draft' })}
                disabled={saving}
                className="portal-button-secondary text-sm disabled:opacity-50"
              >
                Save Draft
              </button>
              {step === steps.length && (
                <button type="button" onClick={handleSubmitApplication} disabled={saving} className="portal-button-primary text-sm disabled:opacity-50">
                  Submit Application
                </button>
              )}
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
