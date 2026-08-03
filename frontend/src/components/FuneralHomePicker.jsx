import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../lib/api'
import { SearchIcon } from './ui/Icons'

export default function FuneralHomePicker({ value, onChange, onSelect, placeholder = 'Search funeral home or provider...' }) {
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  const search = useCallback(async (q) => {
    if (!q.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await api.get(`/funeral-homes?search=${encodeURIComponent(q)}&limit=10`)
      setResults(res.data.funeralHomes || [])
      setOpen(true)
    } catch {
      setResults([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e) => {
    const nextValue = e.target.value
    onChange(nextValue)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(nextValue), 300)
  }

  const handleSelect = (home) => {
    setOpen(false)
    setResults([])
    onChange(home.name || '')
    onSelect(home)
  }

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={value || ''}
          onChange={handleChange}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          className="portal-input pl-9"
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((home) => (
            <li
              key={home.id}
              onMouseDown={() => handleSelect(home)}
              className="cursor-pointer border-b border-slate-100 px-4 py-2.5 hover:bg-slate-50 last:border-0"
            >
              <p className="text-sm font-semibold text-slate-800">{home.name}</p>
              <p className="text-xs text-slate-500">
                {home.ownerName || 'Owner not set'}
              </p>
              {home.address ? <p className="truncate text-xs text-slate-400">{home.address}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
