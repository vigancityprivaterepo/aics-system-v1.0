import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchIcon, PlusIcon, XIcon, UsersIcon } from './ui/Icons'
import api from '../lib/api'
import { formatDate } from '../lib/utils'
import { useDebounce } from '../hooks/useDebounce'
import RfidScanButton from './RfidScanButton'

export default function ClientSearchBar({ onSelect, onFamilyMatchSelect, placeholder = 'Search client by name, case number, or address...', showRfid = true, includeFamilyMatches = false, returnTo = null }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [familyMatches, setFamilyMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const debouncedSearch = useDebounce(async (q) => {
    if (!q || q.length < 2) { setResults([]); setFamilyMatches([]); return }
    setLoading(true)
    try {
      const familyFlag = includeFamilyMatches ? '&includeFamily=1' : ''
      const res = await api.get(`/clients?search=${encodeURIComponent(q)}&limit=8${familyFlag}`)
      setResults(res.data.clients || [])
      setFamilyMatches(res.data.familyMatches || [])
    } catch {
      setResults([])
      setFamilyMatches([])
    } finally {
      setLoading(false)
    }
  }, 350)

  const handleChange = (e) => {
    const v = e.target.value
    setQuery(v)
    setOpen(true)
    debouncedSearch(v)
  }

  const handleSelect = (client) => {
    setQuery(`${client.lastName}, ${client.firstName}`)
    setOpen(false)
    if (onSelect) onSelect(client)
    else navigate(`/clients/${client.id}`)
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setFamilyMatches([])
    setOpen(false)
  }

  // Called by RfidScanButton when a card is matched — a card enrolled to a family
  // member (rather than the household's own card) resolves to that member instead,
  // the same way a name-search family match does.
  const handleRfidFound = (client) => {
    const member = client.matchedFamilyMember
    if (member && onFamilyMatchSelect) {
      setOpen(false)
      setQuery(member.name)
      onFamilyMatchSelect({
        sourceClientId: client.id,
        sourceClientName: `${client.firstName} ${client.lastName}`.trim(),
        sourceCaseNumber: client.caseNumber,
        memberIndex: member.memberIndex,
        name: member.name,
        relationship: member.relationship,
        relationshipOther: member.relationshipOther,
        age: member.age,
        occupation: member.occupation,
      })
      return
    }
    handleSelect(client)
  }

  const handleFamilyMatchSelect = (match) => {
    setOpen(false)
    setQuery(match.name)
    onFamilyMatchSelect?.(match)
  }

  const hasAnyResults = results.length > 0 || familyMatches.length > 0

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Search row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="client-search"
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => query.length >= 2 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder}
            className="portal-input pl-10 pr-10"
            autoComplete="off"
          />
          {query && (
            <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {showRfid && (
          <RfidScanButton onClientFound={handleRfidFound} />
        )}
      </div>

      {/* Dropdown results */}
      <div className="relative">
        {open && (query.length >= 2) && (
          <div className="absolute z-50 top-0 left-0 w-full rounded-lg border border-slate-200 bg-white shadow-xl">
            {loading ? (
              <div className="px-4 py-3 text-sm text-slate-400">Searching...</div>
            ) : !hasAnyResults ? (
              <div className="px-4 py-3">
                <p className="text-sm text-slate-500">No client found for "{query}"</p>
                <button
                  onClick={() => navigate('/clients/new', returnTo ? { state: { returnTo } } : undefined)}
                  className="mt-2 portal-button-green w-full text-xs"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Create New Client Profile
                </button>
              </div>
            ) : (
              <ul className="max-h-96 overflow-y-auto py-1">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      onMouseDown={() => handleSelect(c)}
                      className="w-full px-4 py-3 text-left hover:bg-brand-bg transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-brand-primary">
                            {c.lastName}, {c.firstName} {c.middleName || ''}
                          </p>
                          <p className="text-xs text-slate-500">
                            {c.caseNumber} &bull; {c.barangay}, {c.municipality}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-slate-400">{formatDate(c.dateOfBirth)}</p>
                          {c.is4ps && <span className="badge badge-green text-[9px]">4Ps</span>}
                          {c.isPwd && <span className="badge badge-blue text-[9px] ml-1">PWD</span>}
                          {c.isSenior && <span className="badge badge-amber text-[9px] ml-1">SC</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
                {familyMatches.length > 0 && (
                  <>
                    <li className="border-t border-slate-100 bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Found in family records
                    </li>
                    {familyMatches.map((match) => (
                      <li key={`${match.sourceClientId}-${match.memberIndex}`}>
                        <button
                          onMouseDown={() => handleFamilyMatchSelect(match)}
                          className="w-full px-4 py-3 text-left hover:bg-brand-bg transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <UsersIcon className="h-4 w-4 shrink-0 text-slate-400" />
                            <div>
                              <p className="text-sm font-semibold text-brand-primary">{match.name}</p>
                              <p className="text-xs text-slate-500">
                                {match.relationship || 'Family member'} of {match.sourceClientName} ({match.sourceCaseNumber})
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </>
                )}
                <li className="border-t border-slate-100">
                  <button
                    onMouseDown={() => navigate('/clients/new', returnTo ? { state: { returnTo } } : undefined)}
                    className="w-full px-4 py-2.5 text-left text-xs text-brand-green font-medium hover:bg-brand-bg flex items-center gap-2"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Add new client profile
                  </button>
                </li>
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
