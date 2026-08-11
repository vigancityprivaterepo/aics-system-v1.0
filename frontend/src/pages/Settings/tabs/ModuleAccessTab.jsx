import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import {
  MODULE_ACCESS_DEFS,
  DEFAULT_MODULE_ACCESS_CONFIG,
  CITY_HEALTH_OFFICE_DEPARTMENT,
  DEPARTMENT_OPTIONS,
  officeAllowsEmployeeModule,
  roleLabel,
} from '../settingsConstants'

export default function ModuleAccessTab({ fmt, setFmt, mergeSettings, users, setUsers }) {
  const [moduleAccessSaving, setModuleAccessSaving] = useState(false)
  const [selectedModuleAccessUserId, setSelectedModuleAccessUserId] = useState('')
  const [employeeModuleAccessDraft, setEmployeeModuleAccessDraft] = useState({})
  const [employeeModuleAccessSaving, setEmployeeModuleAccessSaving] = useState(false)

  const departmentOptions = useMemo(() => [...new Set([
    ...DEPARTMENT_OPTIONS,
    ...users.map((u) => String(u.department ?? '').trim()).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b)), [users])

  const activeUsers = users.filter((u) => u.isActive)
  const moduleAccessEmployees = activeUsers.filter((u) => u.role !== 'admin')
  const selectedModuleAccessEmployee = moduleAccessEmployees.find((u) => u.id === selectedModuleAccessUserId) ?? null

  const saveModuleAccess = async () => {
    setModuleAccessSaving(true)
    try {
      const { data } = await api.patch('/settings/module-access', {
        moduleAccessConfig: fmt.moduleAccessConfig,
      })
      mergeSettings(data)
      toast.success('Module access settings saved.')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save module access settings.')
    } finally {
      setModuleAccessSaving(false)
    }
  }

  const selectModuleAccessEmployee = (userId) => {
    const selectedUser = users.find((user) => user.id === userId)
    setSelectedModuleAccessUserId(userId)
    setEmployeeModuleAccessDraft(selectedUser?.moduleAccessOverrides ?? {})
  }

  const saveEmployeeModuleAccess = async () => {
    if (!selectedModuleAccessUserId) return
    setEmployeeModuleAccessSaving(true)
    try {
      const { data } = await api.patch(`/settings/module-access/employees/${selectedModuleAccessUserId}`, {
        moduleAccessOverrides: employeeModuleAccessDraft,
      })
      setEmployeeModuleAccessDraft(data.moduleAccessOverrides ?? {})
      setUsers((prev) => prev.map((user) => user.id === data.userId
        ? {
            ...user,
            moduleAccessOverrides: data.moduleAccessOverrides ?? {},
            accessibleModules: data.accessibleModules ?? user.accessibleModules,
          }
        : user))
      toast.success('Employee module access saved.')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save employee module access.')
    } finally {
      setEmployeeModuleAccessSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="mb-4 border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-900">Module Access by Office</h2>
        <p className="text-sm text-slate-500">Control which modules employees can open based on their assigned office or department.</p>
      </div>
      <p className="text-xs text-slate-400">Admin accounts always keep full access. City Health Office also covers CHO-role accounts.</p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Module</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Unassigned Employee</th>
              {departmentOptions.map((department) => (
                <th key={department} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {department}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MODULE_ACCESS_DEFS.map((moduleDef) => {
              const rule = fmt.moduleAccessConfig?.[moduleDef.key] ?? DEFAULT_MODULE_ACCESS_CONFIG[moduleDef.key]
              return (
                <tr key={moduleDef.key}>
                  <td className="px-4 py-3 font-medium text-slate-800">{moduleDef.label}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                      checked={!!rule.allowUnassignedEmployees}
                      onChange={(e) => setFmt((prev) => ({
                        ...prev,
                        moduleAccessConfig: {
                          ...prev.moduleAccessConfig,
                          [moduleDef.key]: {
                            ...prev.moduleAccessConfig[moduleDef.key],
                            allowUnassignedEmployees: e.target.checked,
                          },
                        },
                      }))}
                    />
                  </td>
                  {departmentOptions.map((department) => {
                    const checked = (rule.employeeDepartments ?? []).includes(department)
                    return (
                      <td key={department} className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                          checked={checked}
                          onChange={(e) => setFmt((prev) => {
                            const current = prev.moduleAccessConfig[moduleDef.key]?.employeeDepartments ?? []
                            const nextDepartments = e.target.checked
                              ? [...new Set([...current, department])]
                              : current.filter((entry) => entry !== department)
                            const isCityHealthOffice = department.toLowerCase() === CITY_HEALTH_OFFICE_DEPARTMENT.toLowerCase()
                            return {
                              ...prev,
                              moduleAccessConfig: {
                                ...prev.moduleAccessConfig,
                                [moduleDef.key]: {
                                  ...prev.moduleAccessConfig[moduleDef.key],
                                  employeeDepartments: nextDepartments,
                                  ...(isCityHealthOffice ? { choAllowed: e.target.checked } : {}),
                                },
                              },
                            }
                          })}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" disabled={moduleAccessSaving} onClick={saveModuleAccess} className="portal-button-primary">
          {moduleAccessSaving ? 'Saving Module Access...' : 'Save Module Access'}
        </button>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Module Access by Employee</h3>
            <p className="mt-1 text-xs text-slate-400">Individual Allow or Block choices override the employee&apos;s office settings. Follow Office keeps the automatic office rule.</p>
          </div>
          <div className="w-full md:max-w-sm">
            <label className="portal-label">Employee</label>
            <select
              className="portal-input"
              value={selectedModuleAccessUserId}
              onChange={(e) => selectModuleAccessEmployee(e.target.value)}
            >
              <option value="">- Select employee -</option>
              {moduleAccessEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} - {employee.department || roleLabel(employee.role)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedModuleAccessEmployee ? (
          <>
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Module</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Office Rule</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Employee Override</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Effective Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MODULE_ACCESS_DEFS.map((moduleDef) => {
                    const officeAllowed = officeAllowsEmployeeModule(
                      selectedModuleAccessEmployee,
                      moduleDef.key,
                      fmt.moduleAccessConfig,
                    )
                    const override = employeeModuleAccessDraft[moduleDef.key]
                    const effectiveAllowed = typeof override === 'boolean' ? override : officeAllowed
                    const overrideValue = typeof override === 'boolean' ? (override ? 'allow' : 'block') : 'inherit'
                    return (
                      <tr key={moduleDef.key}>
                        <td className="px-4 py-3 font-medium text-slate-800">{moduleDef.label}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${officeAllowed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {officeAllowed ? 'Allowed' : 'Blocked'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select
                            className="portal-input mx-auto max-w-40 py-1.5 text-sm"
                            value={overrideValue}
                            onChange={(e) => setEmployeeModuleAccessDraft((prev) => {
                              const next = { ...prev }
                              if (e.target.value === 'inherit') delete next[moduleDef.key]
                              else next[moduleDef.key] = e.target.value === 'allow'
                              return next
                            })}
                          >
                            <option value="inherit">Follow Office</option>
                            <option value="allow">Allow</option>
                            <option value="block">Block</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${effectiveAllowed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
                            {effectiveAllowed ? 'Allowed' : 'Blocked'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={employeeModuleAccessSaving}
                onClick={saveEmployeeModuleAccess}
                className="portal-button-primary"
              >
                {employeeModuleAccessSaving ? 'Saving Employee Access...' : 'Save Employee Access'}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            Select an employee to configure individual module access.
          </div>
        )}
      </div>
    </div>
  )
}
