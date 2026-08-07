import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { PlusIcon, TrashIcon } from './ui/Icons'
import api from '../lib/api'

function rowAvailability(row) {
  return row?.isAvailable ?? row?.medicine?.isAvailable ?? true
}

// Rendered via a portal to <body>, positioned to track the search input, so the suggestion
// list isn't clipped by the medicine table's own scroll container (its overflow-x-auto
// forces overflow-y:auto too, per the CSS spec's "one visible, one not -> both auto" rule,
// which was cutting the dropdown off after the first row or two — case makers couldn't see
// or scroll to most of the search results).
function SuggestionDropdown({ anchorRef, children }) {
  const [rect, setRect] = useState(null)

  useLayoutEffect(() => {
    const updateRect = () => {
      const el = anchorRef.current
      if (!el) return
      const bounds = el.getBoundingClientRect()
      setRect({ top: bounds.bottom, left: bounds.left, width: bounds.width })
    }
    updateRect()
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [anchorRef])

  if (!rect) return null

  return createPortal(
    <ul
      style={{ position: 'fixed', top: rect.top + 4, left: rect.left, width: rect.width }}
      className="z-50 rounded-lg border border-slate-200 bg-white shadow-xl max-h-60 overflow-y-auto"
    >
      {children}
    </ul>,
    document.body,
  )
}

function SearchCell({ row, rowIndex, onSearch, onSelect, onManualEdit, suggestions, activeSuggestions, searching }) {
  const inputRef = useRef(null)
  const showDrop = activeSuggestions && (suggestions.length > 0 || searching || (row.medicineName && row.medicineName.trim().length > 0))

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={row.medicineName}
          onFocus={(e) => {
            if (e.target.value) onSearch(rowIndex, e.target.value)
          }}
          onChange={(e) => {
            onManualEdit(rowIndex, e.target.value)
            onSearch(rowIndex, e.target.value)
          }}
          onBlur={() => setTimeout(() => onSearch(rowIndex, null), 250)}
          placeholder="Type generic or brand name..."
          className="portal-input text-sm py-1.5 pr-8"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          {searching
            ? <span className="h-3.5 w-3.5 block rounded-full border-2 border-brand-green border-t-transparent animate-spin" />
            : row._fromDb
            ? <span className="text-emerald-500 text-xs font-bold">✓</span>
            : null
          }
        </span>
      </div>

      {showDrop && (
        <SuggestionDropdown anchorRef={inputRef}>
          {searching && suggestions.length === 0 ? (
            <li className="px-4 py-3 text-xs text-slate-400 text-center font-medium">Searching medicine database...</li>
          ) : suggestions.length === 0 && row.medicineName?.trim() ? (
            <li className="px-4 py-3 text-xs text-slate-400 text-center">No medicines found matching "{row.medicineName}"</li>
          ) : (
            suggestions.map((m) => {
              const isAvail = m.isAvailable !== false
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      onSelect(rowIndex, m)
                    }}
                    className="w-full px-3 py-2.5 text-left hover:bg-emerald-50 border-b border-slate-50 last:border-0 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{m.genericName}</p>
                        {m.brandName && <p className="text-xs text-slate-500">{m.brandName}</p>}
                        {m.unit && <p className="text-xs text-slate-400 font-mono">Form/Unit: {m.unit}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isAvail ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isAvail ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {isAvail ? 'Available' : 'Not Available'}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </SuggestionDropdown>
      )}
    </div>
  )
}

export default function MedicineTable({ items = [], onChange, readOnly = false }) {
  const [suggestions, setSuggestions] = useState([])
  const [activeRow, setActiveRow] = useState(null)
  const [searching, setSearching] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const debounceRef = useRef(null)

  const doSearch = useCallback(async (query) => {
    const q = String(query ?? '').trim()
    if (!q) {
      setSuggestions([])
      setSearching(false)
      return
    }
    setSearching(true)
    try {
      const res = await api.get(`/medicines?search=${encodeURIComponent(q)}&limit=10`)
      setSuggestions(res.data.medicines || [])
    } catch {
      setSuggestions([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSearch = (rowIndex, value) => {
    if (value === null) {
      clearTimeout(debounceRef.current)
      setActiveRow(null)
      setSuggestions([])
      setSearching(false)
      return
    }
    setActiveRow(rowIndex)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 200)
  }

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const handleManualEdit = (i, value) => {
    const updated = items.map((row, idx) => {
      if (idx !== i) return row
      // Typed free-text, not picked from CHO's known-available list -> treated as not
      // available until saved (the backend auto-adds it to the master list as unavailable).
      return { ...row, medicineName: value, _fromDb: false, medicineId: '', medicine: null, isAvailable: false }
    })
    onChange(updated)
  }

  const addRow = () => {
    onChange([...items, { medicineId: '', medicineName: '', quantity: 1, unit: '', isAvailable: false, _fromDb: false }])
  }

  // One line per medicine — quick way to seed a long prescription list, then each row
  // still needs the usual search-and-select to confirm availability against the CHO list.
  const addBulkRows = () => {
    const names = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (!names.length) return
    onChange([
      ...items,
      ...names.map((medicineName) => ({ medicineId: '', medicineName, quantity: 1, unit: '', isAvailable: false, _fromDb: false })),
    ])
    setBulkText('')
    setBulkOpen(false)
  }

  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i))

  const updateRow = (i, field, value) => {
    const updated = items.map((row, idx) => {
      if (idx !== i) return row
      return { ...row, [field]: value }
    })
    onChange(updated)
  }

  const selectSuggestion = (i, medicine) => {
    const updated = items.map((row, idx) => {
      if (idx !== i) return row
      const isAvail = medicine.isAvailable !== false
      return {
        ...row,
        medicineId: medicine.id,
        medicineName: medicine.genericName,
        unit: medicine.unit || row.unit || '',
        isAvailable: isAvail,
        medicine: {
          isAvailable: isAvail,
          updatedAt: medicine.updatedAt ?? null,
          availabilityUpdatedAt: medicine.availabilityUpdatedAt ?? null,
          availableUpdatedAt: medicine.availableUpdatedAt ?? null,
          unavailableUpdatedAt: medicine.unavailableUpdatedAt ?? null,
        },
        _fromDb: true,
      }
    })
    onChange(updated)
    setSuggestions([])
    setActiveRow(null)
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 min-h-[160px]">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 text-left">Medicine / Generic Name</th>
              <th className="px-4 py-3 text-left w-44">Unit / Form</th>
              <th className="px-4 py-3 text-center w-36">Availability</th>
              {!readOnly && <th className="px-4 py-3 w-12" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 3 : 4} className="px-4 py-10 text-center text-slate-400 text-sm">
                  No medicines added. Click "Add Medicine Row" to start.
                </td>
              </tr>
            ) : (
              items.map((row, i) => (
                <tr key={i} className={`border-t border-slate-100 ${row._fromDb ? 'bg-emerald-50/20' : ''} ${activeRow === i ? 'relative z-30' : ''}`}>
                  {/* Medicine name / search */}
                  <td className="px-4 py-2">
                    {readOnly ? (
                      <span className="font-medium text-slate-700">{row.medicineName}</span>
                    ) : (
                      <SearchCell
                        row={row}
                        rowIndex={i}
                        onSearch={handleSearch}
                        onSelect={selectSuggestion}
                        onManualEdit={handleManualEdit}
                        suggestions={suggestions}
                        activeSuggestions={activeRow === i}
                        searching={searching && activeRow === i}
                      />
                    )}
                  </td>

                  {/* Unit */}
                  <td className="px-4 py-2">
                    {readOnly ? <span>{row.unit || '-'}</span> : (
                      <input
                        type="text" value={row.unit || ''}
                        onChange={(e) => updateRow(i, 'unit', e.target.value)}
                        placeholder="tab/cap/ml"
                        className="portal-input py-1.5"
                      />
                    )}
                  </td>

                  {/* Status / Availability */}
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      rowAvailability(row) !== false
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${rowAvailability(row) !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {rowAvailability(row) !== false ? 'Available' : 'Not Available'}
                    </span>
                  </td>

                  {!readOnly && (
                    <td className="px-4 py-2 text-center">
                      <button type="button" onClick={() => removeRow(i)} className="text-slate-300 hover:text-red-500 transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <button type="button" onClick={addRow} className="portal-button-secondary text-sm">
            <PlusIcon className="h-4 w-4" />
            Add Medicine Row
          </button>
          <button type="button" onClick={() => setBulkOpen((open) => !open)} className="portal-button-secondary text-sm">
            <PlusIcon className="h-4 w-4" />
            Add Multiple
          </button>
        </div>
      )}

      {!readOnly && bulkOpen && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="portal-label">Paste one medicine per line</label>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={5}
            className="portal-input"
            placeholder={'Paracetamol 500mg\nAmoxicillin 500mg\nCetirizine 10mg'}
          />
          <p className="mt-1 text-xs text-slate-500">
            Each line becomes its own row. Confirm availability for each one afterward using its search field.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={addBulkRows} className="portal-button-primary text-xs">Add Rows</button>
            <button type="button" onClick={() => { setBulkOpen(false); setBulkText('') }} className="portal-button-secondary text-xs">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
