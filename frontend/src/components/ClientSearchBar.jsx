import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchIcon, PlusIcon, XIcon } from './ui/Icons'
import api from '../lib/api'
import { formatDate } from '../lib/utils'
import { useDebounce } from '../hooks/useDebounce'

export default function ClientSearchBar({ onSelect, placeholder = 'Search client by name, case number, or address...' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const debouncedSearch = useDebounce(async (q) => {
    if (!q || q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await api.get(`/clients?search=${encodeURIComponent(q)}&limit=8`)
      setResults(res.data.clients || [])
    } catch {
      setResults([])
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
    setOpen(false)
  }

  return (
    <div className="relative w-full">
      <div className="relative">
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

      {open && (query.length >= 2) && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-xl">
          {loading ? (
            <div className="px-4 py-3 text-sm text-slate-400">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3">
              <p className="text-sm text-slate-500">No client found for "{query}"</p>
              <button
                onClick={() => navigate('/clients/new')}
                className="mt-2 portal-button-green w-full text-xs"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Create New Client Profile
              </button>
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
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
              <li className="border-t border-slate-100">
                <button
                  onMouseDown={() => navigate('/clients/new')}
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
  )
}
