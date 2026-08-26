import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { formatClientName, calculateAge } from '../../lib/utils'
import ClientSearchBar from '../../components/ClientSearchBar'
import { useAuthStore } from '../../store/authStore'
import { allowedCaseTypesForUser } from '../../utils/accessRules'
import {
  PillIcon, CrossIcon, ArrowRightIcon, PlusIcon, ChevronLeftIcon,
  HospitalIcon, GlassesIcon, HeadstonIcon, FileTextIcon, UsersIcon,
} from '../../components/ui/Icons'

const CASE_TYPES = [
  { type: 'medicine', Icon: PillIcon,     label: 'Medicine', desc: 'Prescription medicine provision',           iconColor: 'text-[#059669]', iconBg: 'bg-[#ecfdf5]', available: true  },
  { type: 'medical',  Icon: CrossIcon,    label: 'Medical',  desc: 'Medical consultation support',              iconColor: 'text-[#3b82f6]', iconBg: 'bg-[#eff6ff]', available: true  },
  { type: 'hospital', Icon: HospitalIcon, label: 'Hospital', desc: 'Hospital bill financial assistance',        iconColor: 'text-[#8b5cf6]', iconBg: 'bg-[#f5f3ff]', available: true  },
  { type: 'burial',   Icon: HeadstonIcon, label: 'Burial',   desc: 'Funeral and burial cost coverage',          iconColor: 'text-slate-600', iconBg: 'bg-slate-100', available: true  },
  { type: 'eyeglass', Icon: GlassesIcon,  label: 'Eyeglass', desc: 'Optical assistance for corrective eyewear', iconColor: 'text-[#f59e0b]', iconBg: 'bg-[#fffbeb]', available: true  },
  { type: 'plain',    Icon: FileTextIcon, label: 'Plain AICS', desc: 'General financial assistance intake',     iconColor: 'text-[#0d9488]', iconBg: 'bg-[#f0fdfa]', available: true  },
]

function StepPill({ number, label, active }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-[13px] py-[7px] text-[12.5px] font-semibold ${
      active ? 'bg-[#0f2d52] text-white' : 'bg-slate-100 text-slate-400'
    }`}>
      <span className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10.5px] font-bold ${
        active ? 'bg-white/20' : 'bg-[#0f2d52]/10'
      }`}>
        {number}
      </span>
      {label}
    </span>
  )
}

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
      const computedAge = match.dateOfBirth ? calculateAge(match.dateOfBirth) : null
      setBeneficiaryOverride({
        name: match.name,
        age: computedAge ?? match.age ?? '',
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
      <div className="mb-5 border-b border-slate-200 pb-4">
        <p className="portal-kicker">AICS — Step {stepNum} of {totalSteps}</p>
        <h1 className="portal-page-title">
          {step === 'type' && 'Select Assistance Type'}
          {step === 'client' && `${assistanceType ? TYPE_LABEL[assistanceType] + ' Assistance' : 'New Case'} — Select Client`}
        </h1>
        <p className="portal-page-subtitle">
          {step === 'type' && 'Choose the type of assistance for this case'}
          {step === 'client' && 'Select a client and proceed directly to case study encoding'}
        </p>
      </div>

      {/* Stepper pills (V.1.2 design) */}
      {totalSteps > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-2.5">
          <StepPill number={1} label="Assistance Type" active={step === 'type' || step === 'client'} />
          <span className="h-px w-7 shrink-0 bg-slate-300" aria-hidden="true" />
          <StepPill number={2} label="Select Client" active={step === 'client'} />
        </div>
      )}

      {step === 'type' && (
        <div className="card">
          <h2 className="border-b-2 border-slate-100 pb-3.5 font-display text-base font-bold text-[#0f2d52]">Select Assistance Type</h2>
          <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {visibleCaseTypes.map((caseType) => (
              <button
                key={caseType.type}
                onClick={() => caseType.available && handleSelectType(caseType.type)}
                disabled={!caseType.available}
                title={!caseType.available ? 'Coming soon' : undefined}
                className={`relative flex flex-col items-start gap-3 rounded-[14px] border p-5 text-left
                  transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
                  ${!caseType.available
                    ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                    : 'border-slate-200 bg-white hover:border-[#10b981] hover:shadow-[0_6px_18px_rgba(15,45,82,0.08)] cursor-pointer'
                  }`}
              >
                {!caseType.available && (
                  <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">Soon</span>
                )}
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${caseType.iconBg}`}>
                  <caseType.Icon className={`h-[21px] w-[21px] ${caseType.iconColor}`} />
                </span>
                <div>
                  <p className="font-display text-[15px] font-bold text-[#0f2d52]">{caseType.label}</p>
                  <p className="mt-0.5 text-[12.5px] leading-normal text-gray-500">{caseType.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'client' && (
        <div className="space-y-5">
          <div className="card mx-auto w-full max-w-6xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-100 pb-3.5">
              <h2 className="font-display text-base font-bold text-[#0f2d52]">Search Client Profile</h2>
              {!presetType && (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <ChevronLeftIcon className="h-3.5 w-3.5" />
                  Change type
                </button>
              )}
            </div>
            <div className="mt-[18px]">
              <ClientSearchBar onSelect={handleClientSelect} onFamilyMatchSelect={handleFamilyMatchSelect} includeFamilyMatches returnTo={{ assistanceType }} />
            </div>

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
              <div className="mt-4 rounded-xl bg-[#ecfdf5] p-4">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="font-semibold text-[#065f46]">
                      {formatClientName(selectedClient)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {selectedClient.caseNumber} — {selectedClient.barangay}, {selectedClient.municipality}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedClient.is4ps && <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">4Ps</span>}
                      {selectedClient.isPwd && <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">PWD</span>}
                      {selectedClient.isSenior && <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">Senior Citizen</span>}
                    </div>
                  </div>
                  <span className="text-xl text-[#047857]">✓</span>
                </div>
              </div>
            )}
          </div>

          {!selectedClient && (
            <div className="card mx-auto w-full max-w-6xl">
              <h2 className="font-display text-[15px] font-bold text-[#0f2d52]">No profile yet?</h2>
              <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-gray-500 [text-wrap:pretty]">
                Register the beneficiary first — the new profile carries over into this {assistanceType ? TYPE_LABEL[assistanceType] : 'AICS'} case automatically.
              </p>
              <button
                onClick={() => navigate('/clients/new', { state: { returnTo: { assistanceType } } })}
                className="mt-3.5 inline-flex h-10 items-center gap-[7px] rounded-[10px] border border-[#0f2d52] bg-[#0f2d52] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#164070]"
              >
                <PlusIcon className="h-[15px] w-[15px]" />
                Register new client
              </button>
            </div>
          )}

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
