import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { formatAuditTime, formatFileSize } from '../settingsConstants'

export default function BackupTab() {
  const [backups, setBackups] = useState([])
  const [backupsLoading, setBackupsLoading] = useState(true)
  const [backupCreating, setBackupCreating] = useState(false)
  const [restoringBackupName, setRestoringBackupName] = useState('')

  const loadBackups = async ({ silent = false } = {}) => {
    if (!silent) setBackupsLoading(true)
    try {
      const { data } = await api.get('/settings/backups')
      setBackups(data.backups || [])
    } catch {
      toast.error('Failed to load backups')
    } finally {
      if (!silent) setBackupsLoading(false)
    }
  }

  useEffect(() => {
    loadBackups()
  }, [])

  const createSystemBackup = async () => {
    setBackupCreating(true)
    try {
      const { data } = await api.post('/settings/backups')
      setBackups((prev) => [data, ...prev.filter((item) => item.filename !== data.filename)])
      toast.success('Backup created successfully.')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to create backup.')
    } finally {
      setBackupCreating(false)
    }
  }

  const downloadBackup = (filename) => {
    api.get(`/settings/backups/${encodeURIComponent(filename)}/download`, {
      responseType: 'blob',
    }).then((response) => {
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'application/gzip' })
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    }).catch((err) => {
      toast.error(err.response?.data?.message ?? 'Failed to download backup.')
    })
  }

  const restoreSystemBackup = async (filename) => {
    const confirmed = window.confirm(
      `Restore backup "${filename}"?\n\nThis will replace the current database and uploaded files.`,
    )
    if (!confirmed) return

    setRestoringBackupName(filename)
    try {
      await api.post(`/settings/backups/${encodeURIComponent(filename)}/restore`)
      toast.success('Backup restored. Refreshing backup list.')
      await loadBackups({ silent: true })
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to restore backup.')
    } finally {
      setRestoringBackupName('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">System Backup & Restore</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create a full snapshot of the PostgreSQL data and uploaded files, then restore from saved backups when needed.
            </p>
          </div>
          <button
            type="button"
            onClick={createSystemBackup}
            disabled={backupCreating || restoringBackupName !== ''}
            className="portal-button-primary"
          >
            {backupCreating ? 'Creating Backup...' : 'Create Backup Now'}
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Restoring a backup replaces the current database and uploaded files. Download a fresh backup before restoring if you need a rollback point.
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Saved Backups</h3>
          <p className="mt-1 text-xs text-slate-500">Backups are stored on the server as downloadable `.json.gz` snapshot files.</p>
        </div>

        {backupsLoading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">Loading backups...</div>
        ) : backups.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">No backups available yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Filename</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Created</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Size</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.map((backup) => {
                const isRestoring = restoringBackupName === backup.filename
                return (
                  <tr key={backup.filename} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs text-slate-700">{backup.filename}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{formatAuditTime(backup.updatedAt)}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{formatFileSize(backup.sizeBytes)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => downloadBackup(backup.filename)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => restoreSystemBackup(backup.filename)}
                          disabled={backupCreating || restoringBackupName !== ''}
                          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                        >
                          {isRestoring ? 'Restoring...' : 'Restore'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
