import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { formatClientName } from '../../lib/utils'
import ClientSearchBar from '../../components/ClientSearchBar'
import { useAuthStore } from '../../store/authStore'
import { allowedCaseTypesForUser } from '../../utils/accessRules'
import {
  PillIcon, CrossIcon, ArrowRightIcon, PlusIcon, ChevronLeftIcon,
  HospitalIcon, GlassesIcon, HeadstonIcon, FileTextIcon, UsersIcon,
} from '../../components/ui/Icons'

const CASE_TYPES = [
  { type: 'medicine', Icon: PillIcon,     label: 'Medicine', desc: 'Prescription medicine provision',           iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50', available: true  },
  { type: 'medical',  Icon: CrossIcon,    label: 'Medical',  desc: 'Medical consultation support',              iconColor: 'text-blue-500',    iconBg: 'bg-blue-50',    available: true  },
  { type: 'hospital', Icon: HospitalIcon, label: 'Hospital', desc: 'Hospital bill financial assistance',        iconColor: 'text-violet-500',  iconBg: 'bg-violet-50',  available: true  },
  { type: 'burial',   Icon: HeadstonIcon, label: 'Burial',   desc: 'Funeral and burial cost coverage',          iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',  available: true  },
  { type: 'eyeglass', Icon: GlassesIcon,  label: 'Eyeglass', desc: 'Optical assistance for corrective eyewear', iconColor: 'text-amber-500',   iconBg: 'bg-amber-50',   available: true  },
  { type: 'plain',    Icon: FileTextIcon, label: 'Plain AICS', desc: 'General financial assistance intake',     iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-50',    available: true  },
]

const TYPE_LABEL = { medicine: 'Medicine', burial: 'Burial', hospital: 'Hospital', medical: 'Medical', eyeglass: 'Eyeglass', plain: 'Plain AICS' }

export default function NewCase() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedPresetType = searchParams.get('type') ?? ''
  const user = useAuthStore((state) => state.user)
  const allowedCaseTypes = allowedCaseTypesForUser(user, CASE_TYPES.map((caseType) => caseType.type))
  const presetType = allowedCaseTypes.includes(requestedPresetType) ? requestedPresetType : ''
  const visibleCaseTypes = CASE_TYPES.filter((caseType) => allowedCaseTypes.includes(caseType.type))

  // steps: 'type' | 'client'
  const [step, setStep] = useState(presetType ? 'client' : 'type')
  const [assistanceType, setAssistanceType] = useState(presetType || null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [beneficiaryOverride, setBeneficiaryOverride] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSelectType = (type) => {
    setAssistanceType(type)
    setStep('client')
  }

  const handleClientSelect = (client) => {
    setSelectedClient(client)
    setBeneficiaryOverride(null)
  }

  // A family match has no client record of its own — the case is created under the
  // source client's existing profile, with the matched person's details carried as a
  // beneficiary override so the case (and its report) reflect them, not the source client.
  // Who is actually filing on the beneficiary's behalf is NOT assumed here (the source
  // client isn't necessarily "Self" or even the requestor) - that's left blank for the
  // case maker to fill in during case study encoding.
  const handleFamilyMatchSelect = async (match) => {
    try {
      const { data: sourceClient } = await api.get(`/clients/${match.sourceClientId}`)
      const otherMembers = (sourceClient.familyComposition || []).filter((_, idx) => idx !== match.memberIndex)
      const familyComposition = [
        { name: formatClientName(sourceClient), age: '', relationship: '', relationshipOther: '', occupation: sourceClient.occupation || '' },
        ...otherMembers,
      ]
      setSelectedClient(sourceClient)
      setBeneficiaryOverride({
        name: match.name,
        age: match.age || '',
        sex: match.sex || '',
        occupation: match.occupation || '',
        relationshipOnRecord: match.relationship || '',
        familyComposition,
      })
    } catch {
      toast.error('Failed to load that family member\'s record.')
    }
  }

  const handleCreateCase = async () => {
    if (!selectedClient || !assistanceType) return

    setLoading(true)
    try {
      const res = await api.post('/cases', {
        clientId: selectedClient.id,
        assistanceType,
        ...(beneficiaryOverride ? {
          beneficiaryName: beneficiaryOverride.name,
          beneficiaryAge: beneficiaryOverride.age || null,
          beneficiarySex: beneficiaryOverride.sex || null,
          beneficiaryOccupation: beneficiaryOverride.occupation || null,
          familyComposition: beneficiaryOverride.familyComposition,
        } : {}),
      })
      let movedToEncoding = false

      try {
        await api.patch(`/cases/${res.data.id}/status`, {
          status: 'encoding',
          notes: 'Client selected, proceed to case study encoding',
        })
        movedToEncoding = true
      } catch (statusErr) {
        toast.error(statusErr.response?.data?.message || 'Case created, but automatic move to encoding failed.')
      }

      toast.success(movedToEncoding ? 'Case saved. Proceed to case study encoding.' : 'Case created. Review the status before continuing.')
      navigate(`/cases/${res.data.id}`)
    } catch (err) {
      const issueMessage = err.response?.data?.issues?.[0]?.message
      toast.error(issueMessage ?? err.response?.data?.message ?? 'Failed to create case')
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    if (step === 'client' && !presetType) {
      setStep('type')
    }
  }

  const totalSteps = presetType ? 1 : 2
  const stepNum = step === 'type' ? 1 : (presetType ? 1 : 2)

  return (
    <div className="animate-fade-in mx-auto w-full max-w-[1440px] px-3 sm:px-5 lg:px-8">
      <div className="mb-6">
        {step !== 'type' && !presetType && (
          <button onClick={goBack} className="btn-ghost mb-3 text-sm">
            <ChevronLeftIcon className="h-4 w-4" /> Back
          </button>
        )}
        <p className="portal-kicker">AICS - Step {stepNum} of {totalSteps}</p>
        <h1 className="portal-page-title">
          {step === 'type' && 'Select Assistance Type'}
          {step === 'client' && `${assistanceType ? TYPE_LABEL[assistanceType] + ' Assistance' : 'New Case'} - Select Client`}
        </h1>
        <p className="portal-page-subtitle">
          {step === 'type' && 'Choose the type of assistance for this case'}
          {step === 'client' && 'Select a client and proceed directly to case study encoding'}
        </p>
      </div>

      {step === 'type' && (
        <div className="card">
          <div className="form-section-title mb-4">Select Assistance Type</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {visibleCaseTypes.map((caseType) => (
              <button
                key={caseType.type}
                onClick={() => caseType.available && handleSelectType(caseType.type)}
                disabled={!caseType.available}
                title={!caseType.available ? 'Coming soon' : undefined}
                className={`relative flex flex-col items-start gap-3 rounded-xl border-2 p-4 text-left
                  transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
                  ${!caseType.available
                    ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm cursor-pointer'
                  }`}
              >
                {!caseType.available && (
                  <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">Soon</span>
                )}
                <div className={`rounded-lg p-2 ${caseType.iconBg}`}>
                  <caseType.Icon className={`h-5 w-5 ${caseType.iconColor}`} />
                </div>
                <div>
                  <p className="font-display font-bold text-brand-primary text-sm">{caseType.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{caseType.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'client' && (
        <div className="space-y-4">
          <div className="card mx-auto w-full max-w-6xl">
            <div className="form-section-title mb-4">Search Client Profile</div>
            <ClientSearchBar onSelect={handleClientSelect} onFamilyMatchSelect={handleFamilyMatchSelect} includeFamilyMatches returnTo={{ assistanceType }} />

            {!selectedClient && (
              <>
                <div className="mt-3 flex items-center justify-center">
                  <span className="text-slate-400 text-xs">- or -</span>
                </div>
                <button
                  onClick={() => navigate('/clients/new', { state: { returnTo: { assistanceType } } })}
                  className="portal-button-secondary w-full mt-2 justify-center"
                >
                  <PlusIcon className="h-4 w-4" />
                  Create New Client Profile
                </button>
              </>
            )}

            {selectedClient && beneficiaryOverride && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <UsersIcon className="h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-900">
                      Creating a case for <strong>{beneficiaryOverride.name}</strong>
                      {beneficiaryOverride.relationshipOnRecord ? ` (${beneficiaryOverride.relationshipOnRecord})` : ''}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Filed under {formatClientName(selectedClient)}'s profile ({selectedClient.caseNumber}) — this new case will appear in their case history.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedClient && (
              <div className="mt-4 rounded-xl border border-brand-green/30 bg-emerald-50 p-4">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="font-semibold text-brand-dark">
                      {formatClientName(selectedClient)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedClient.caseNumber} - {selectedClient.barangay}, {selectedClient.municipality}
                    </p>
                    <div className="flex gap-1 mt-2">
                      {selectedClient.is4ps && <span className="badge badge-green">4Ps</span>}
                      {selectedClient.isPwd && <span className="badge badge-blue">PWD</span>}
                      {selectedClient.isSenior && <span className="badge badge-amber">Senior Citizen</span>}
                    </div>
                  </div>
                  <span className="text-emerald-600 text-xl">OK</span>
                </div>
              </div>
            )}
          </div>

          {selectedClient && (
            <div className="mx-auto flex w-full max-w-6xl justify-end">
              <button onClick={handleCreateCase} disabled={loading} className="portal-button-primary px-8 py-3 text-base">
                {loading ? 'Creating...' : 'Create Case & Continue'}
                {!loading && <ArrowRightIcon className="h-5 w-5" />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
