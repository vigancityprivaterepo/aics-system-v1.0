import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import ProtectedImage from '../../../components/shared/ProtectedImage'
import { CASE_NUMBER_SERIES } from '../settingsConstants'

export default function CaseFormatTab({ fmt, setFmt, mergeSettings, users }) {
  const [selectedCaseSeries, setSelectedCaseSeries] = useState('medicine')
  const [globalSettingsSaving, setGlobalSettingsSaving] = useState(false)
  const [caseSeriesSaving, setCaseSeriesSaving] = useState(false)

  const activeUsers = users.filter((u) => u.isActive)
  const activeApprovalUsers = activeUsers.filter((u) => u.role !== 'city_health_office')
  const reviewerUsers    = activeApprovalUsers.filter((u) => (Array.isArray(u.approvalLevel) ? u.approvalLevel : []).includes('reviewer'))
  const recommenderUsers = activeApprovalUsers.filter((u) => (Array.isArray(u.approvalLevel) ? u.approvalLevel : []).includes('recommender'))
  const approverUsers    = activeApprovalUsers.filter((u) => (Array.isArray(u.approvalLevel) ? u.approvalLevel : []).includes('approver'))

  const saveFmt = async (e) => {
    e.preventDefault()
    setGlobalSettingsSaving(true)
    try {
      const current = await api.get('/settings')
      const currentSettings = { ...current.data }
      delete currentSettings.moduleAccessConfig
      const { data } = await api.put('/settings', {
        ...currentSettings,
        locationCode: fmt.locationCode,
        agencyCode: fmt.agencyCode,
        sequenceDigits: Number(fmt.sequenceDigits),
        reviewedByUserId: fmt.reviewedByUserId || null,
        recommendingUserId: fmt.recommendingUserId || null,
        approvedByUserId: fmt.approvedByUserId || null,
      })
      mergeSettings(data)
      toast.success('Global format and approval settings saved.')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save global settings.')
    } finally {
      setGlobalSettingsSaving(false)
    }
  }

  const selectedSeries = CASE_NUMBER_SERIES.find((series) => series.key === selectedCaseSeries) ?? CASE_NUMBER_SERIES[0]

  const saveSelectedCaseSeries = async (e) => {
    e.preventDefault()
    setCaseSeriesSaving(true)
    try {
      const { data } = await api.patch(`/settings/case-number-series/${selectedSeries.key}`, {
        prefix: String(fmt[selectedSeries.prefixField] || '').toUpperCase(),
        startSequence: Number(fmt[selectedSeries.sequenceField]),
      })
      mergeSettings(data)
      toast.success(`${selectedSeries.label} case number series saved.`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save case number series.')
    } finally {
      setCaseSeriesSaving(false)
    }
  }

  const formatSeq = (value) => String(Number(value) || 1).padStart(Number(fmt.sequenceDigits) || 3, '0')
  const previews = Object.fromEntries(CASE_NUMBER_SERIES.map((series) => {
    const seq = formatSeq(fmt[series.sequenceField])
    const preview = series.key === 'client'
      ? `${fmt.clientPrefix}-${fmt.locationCode}-${seq}`
      : `${fmt[series.prefixField]}-${fmt.agencyCode}-${fmt.locationCode}-${seq}`
    return [series.key, preview]
  }))
  const selectedPreview = previews[selectedSeries.key]

  return (
    <div className="card">
      <div className="mb-4 border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-900">Case Number Format</h2>
        <p className="text-sm text-slate-500">Configure the ID and case number codes generated for new records. Changes apply to new records only.</p>
      </div>
      <div className="space-y-5">
        {/* Global format settings */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <label className="portal-label">Agency Code</label>
            <input className="portal-input font-mono" value={fmt.agencyCode} maxLength={10}
              onChange={(e) => setFmt((f) => ({ ...f, agencyCode: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <label className="portal-label">Location Code</label>
            <input className="portal-input font-mono" value={fmt.locationCode} maxLength={10}
              onChange={(e) => setFmt((f) => ({ ...f, locationCode: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <label className="portal-label">Sequence Digits</label>
            <select className="portal-input" value={fmt.sequenceDigits}
              onChange={(e) => setFmt((f) => ({ ...f, sequenceDigits: Number(e.target.value) }))}>
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} digits</option>)}
            </select>
          </div>
        </div>

        <form onSubmit={saveSelectedCaseSeries} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label className="portal-label">Series</label>
              <select
                className="portal-input"
                value={selectedCaseSeries}
                onChange={(e) => setSelectedCaseSeries(e.target.value)}
              >
                {CASE_NUMBER_SERIES.map((series) => (
                  <option key={series.key} value={series.key}>{series.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="portal-label">{selectedSeries.prefixLabel}</label>
              <input
                className="portal-input font-mono"
                value={fmt[selectedSeries.prefixField]}
                maxLength={10}
                onChange={(e) => setFmt((f) => ({ ...f, [selectedSeries.prefixField]: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <label className="portal-label">Next Number</label>
              <input
                className="portal-input font-mono"
                type="number"
                min="1"
                max="999999"
                value={fmt[selectedSeries.sequenceField]}
                onChange={(e) => setFmt((f) => ({ ...f, [selectedSeries.sequenceField]: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-2">
            <span className="mr-2 text-xs font-medium text-slate-400">Preview</span>
            <span className="font-mono text-sm font-bold text-brand-primary">{selectedPreview}</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Only the selected series is saved. Existing higher numbers are still skipped automatically.</p>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={caseSeriesSaving} className="portal-button-primary">
              {caseSeriesSaving ? 'Saving Series...' : `Save ${selectedSeries.label} Series`}
            </button>
          </div>
        </form>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approval Hierarchy Assignment</p>
          <p className="mt-1 text-xs text-slate-400">Only employees with the matching approval level are shown. Missing e-signatures will not block approval, but documents will omit that signature image.</p>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { label: 'Reviewed By', field: 'reviewedByUserId', pool: reviewerUsers, role: 'reviewer' },
              { label: 'Recommending Approval', field: 'recommendingUserId', pool: recommenderUsers, role: 'recommender' },
              { label: 'Final Approval', field: 'approvedByUserId', pool: approverUsers, role: 'approver' },
            ].map(({ label, field, pool, role }) => {
              const selectedId = fmt[field]
              const selectedUser = activeUsers.find((u) => u.id === selectedId)
              const isOrphaned = selectedId && !pool.find((u) => u.id === selectedId)
              return (
                <div key={field}>
                  <label className="portal-label">{label}</label>
                  <select
                    className="portal-input"
                    value={selectedId || ''}
                    onChange={(e) => setFmt((f) => ({ ...f, [field]: e.target.value || null }))}
                  >
                    <option value="">- Unassigned -</option>
                    {pool.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                    {isOrphaned && (
                      <option value={selectedId}>{selectedUser?.name ?? 'Unknown'} (no {role} level)</option>
                    )}
                  </select>
                  {pool.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">No employees have the &ldquo;{role}&rdquo; approval level set.</p>
                  )}
                  {selectedUser ? (
                    <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                      {selectedUser.eSignatureUrl ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <ProtectedImage
                            src={selectedUser.eSignatureUrl}
                            alt={selectedUser.name}
                            className="h-8 w-20 rounded border border-slate-100 object-contain"
                            fallback={<div className="h-8 w-20 rounded border border-dashed border-slate-200 bg-slate-50" />}
                          />
                          <span className="text-xs text-slate-500 truncate">{selectedUser.name}</span>
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          <span className="text-lg">Signature</span>
                          <span className="text-xs text-amber-600">{selectedUser.name} - no e-signature uploaded; workflow can still proceed</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 h-10 rounded-md border border-dashed border-slate-200 bg-white" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" disabled={globalSettingsSaving} onClick={saveFmt} className="portal-button-primary">
            {globalSettingsSaving ? 'Saving Format & Approvals...' : 'Save Format & Approvals'}
          </button>
        </div>
      </div>
    </div>
  )
}
