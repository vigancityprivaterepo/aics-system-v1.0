export default function DraftRecoveryBanner({ savedAt, onRestore, onDiscard }) {
  const savedLabel = savedAt ? new Date(savedAt).toLocaleString() : null
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm text-amber-800">
        Unsaved changes were found from {savedLabel ? `your last session (${savedLabel})` : 'a previous session'}.
        Restore them, or discard to start from what's saved.
      </p>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={onDiscard} className="portal-button-secondary text-xs">Discard</button>
        <button type="button" onClick={onRestore} className="portal-button-primary text-xs">Restore</button>
      </div>
    </div>
  )
}
