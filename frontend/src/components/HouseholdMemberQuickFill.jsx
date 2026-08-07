/** Lets a case maker pick an already-entered household member instead of retyping their name/relationship. */
export default function HouseholdMemberQuickFill({ members = [], onSelect, className = '' }) {
  const named = members.filter((m) => String(m?.name || '').trim())
  if (!named.length) return null

  return (
    <select
      defaultValue=""
      onChange={(e) => {
        const idx = e.target.value
        if (idx === '') return
        const member = named[Number(idx)]
        if (member) onSelect(member)
        e.target.value = ''
      }}
      className={`portal-input mt-1 text-xs text-slate-500 ${className}`}
    >
      <option value="">Fill from household member...</option>
      {named.map((m, idx) => (
        <option key={idx} value={idx}>{m.name}{m.relationship ? ` (${m.relationship})` : ''}</option>
      ))}
    </select>
  )
}
