import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../lib/api'
import { SearchIcon } from './ui/Icons'

export default function HospitalFacilityPicker({ value, onChange, onSelect, placeholder = 'Search hospital or facility...' }) {
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await api.get(`/hospitals?search=${encodeURIComponent(q)}&limit=10`)
      setResults(res.data.facilities || [])
      setOpen(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e) => {
    const v = e.target.value
    onChange(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 300)
  }

  const handleSelect = (facility) => {
    setOpen(false)
    setResults([])
    onChange(facility.facilityName)
    onSelect(facility)
  }

  // Close dropdown when clicking outside
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
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
          {results.map((f) => (
            <li
              key={f.id}
              onMouseDown={() => handleSelect(f)}
              className="cursor-pointer px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0"
            >
              <p className="text-sm font-semibold text-slate-800">{f.facilityName}</p>
              <p className="text-xs text-slate-400">{[f.municipality, f.province].filter(Boolean).join(', ')} · <span className="text-slate-500">{f.facilityType}</span></p>
              {f.fullAddress && <p className="text-xs text-slate-400 truncate">{f.fullAddress}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
