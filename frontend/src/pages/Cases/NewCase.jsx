import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import ClientSearchBar from '../../components/ClientSearchBar'
import {
  PillIcon, CrossIcon, ArrowRightIcon, PlusIcon, ChevronLeftIcon,
  HospitalIcon, GlassesIcon, HeadstonIcon, FileTextIcon,
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
  const presetType = searchParams.get('type') ?? ''

  // steps: 'type' | 'client'
  const [step, setStep] = useState(presetType ? 'client' : 'type')
  const [assistanceType, setAssistanceType] = useState(presetType || null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSelectType = (type) => {
    setAssistanceType(type)
    setStep('client')
  }

  const handleClientSelect = (client) => setSelectedClient(client)

  const handleCreateCase = async () => {
    if (!selectedClient || !assistanceType) return

    setLoading(true)
    try {
      const res = await api.post('/cases', {
        clientId: selectedClient.id,
        assistanceType,
      })

      try {
        await api.patch(`/cases/${res.data.id}/status`, {
          status: 'encoding',
          notes: 'Client selected, proceed to case study encoding',
        })
      } catch {
        // Best-effort transition; still proceed to case detail.
      }

      toast.success('Case saved. Proceed to case study encoding.')
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
    <div className="animate-fade-in mx-auto max-w-2xl">
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
            {CASE_TYPES.map((caseType) => (
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
          <div className="card">
            <div className="form-section-title mb-4">Search Client Profile</div>
            <ClientSearchBar onSelect={handleClientSelect} />

            {!selectedClient && (
              <>
                <div className="mt-3 flex items-center justify-center">
                  <span className="text-slate-400 text-xs">- or -</span>
                </div>
                <button
                  onClick={() => navigate('/clients/new')}
                  className="portal-button-secondary w-full mt-2 justify-center"
                >
                  <PlusIcon className="h-4 w-4" />
                  Create New Client Profile
                </button>
              </>
            )}

            {selectedClient && (
              <div className="mt-4 rounded-xl border border-brand-green/30 bg-emerald-50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-brand-dark">
                      {selectedClient.lastName}, {selectedClient.firstName} {selectedClient.middleName || ''}
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
            <div className="flex justify-end">
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
