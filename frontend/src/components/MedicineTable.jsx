import { useState, useRef, useEffect, useCallback } from 'react'
import { PlusIcon, TrashIcon } from './ui/Icons'
import { formatCurrency } from '../lib/utils'
import api from '../lib/api'

function SearchCell({ row, rowIndex, onSearch, onSelect, onManualEdit, suggestions, activeSuggestions, searching }) {
  const inputRef = useRef(null)
  const showDrop = activeSuggestions && suggestions.length > 0

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={row.medicineName}
          onChange={(e) => {
            onManualEdit(rowIndex, e.target.value)
            onSearch(rowIndex, e.target.value)
          }}
          onBlur={() => setTimeout(() => onSearch(rowIndex, null), 200)}
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
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-xl max-h-52 overflow-y-auto">
          {suggestions.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={() => onSelect(rowIndex, m)}
                className="w-full px-3 py-2.5 text-left hover:bg-emerald-50 border-b border-slate-50 last:border-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{m.genericName}</p>
                    {m.brandName && <p className="text-xs text-slate-400">{m.brandName}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-brand-primary">{formatCurrency(m.unitPrice)}</p>
                    {m.unit && <p className="text-xs text-slate-400">per {m.unit}</p>}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function MedicineTable({ items = [], onChange, readOnly = false }) {
  const [suggestions, setSuggestions] = useState([])
  const [activeRow, setActiveRow] = useState(null)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  const grandTotal = items.reduce((sum, i) => sum + (parseFloat(i.totalPrice) || 0), 0)

  const doSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([])
      setSearching(false)
      return
    }
    setSearching(true)
    try {
      const res = await api.get(`/medicines?search=${encodeURIComponent(query)}&limit=8`)
      setSuggestions(res.data.medicines || [])
    } catch {
      setSuggestions([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSearch = (rowIndex, value) => {
    if (value === null) {
      // blur — close dropdown
      clearTimeout(debounceRef.current)
      setActiveRow(null)
      setSuggestions([])
      setSearching(false)
      return
    }
    setActiveRow(rowIndex)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 280)
  }

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const handleManualEdit = (i, value) => {
    const updated = items.map((row, idx) => {
      if (idx !== i) return row
      return { ...row, medicineName: value, _fromDb: false, medicineId: '' }
    })
    onChange(updated)
  }

  const addRow = () => {
    onChange([...items, { medicineId: '', medicineName: '', quantity: 1, unit: '', unitPrice: 0, totalPrice: 0, _fromDb: false }])
  }

  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i))

  const updateRow = (i, field, value) => {
    const updated = items.map((row, idx) => {
      if (idx !== i) return row
      const newRow = { ...row, [field]: value }
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = parseFloat(field === 'quantity' ? value : newRow.quantity) || 0
        const price = parseFloat(field === 'unitPrice' ? value : newRow.unitPrice) || 0
        newRow.totalPrice = qty * price
      }
      return newRow
    })
    onChange(updated)
  }

  const selectSuggestion = (i, medicine) => {
    const updated = items.map((row, idx) => {
      if (idx !== i) return row
      const qty = parseFloat(row.quantity) || 1
      const unitPrice = parseFloat(medicine.unitPrice) || 0
      return {
        ...row,
        medicineId: medicine.id,
        medicineName: medicine.genericName,
        unit: medicine.unit || row.unit || '',
        unitPrice,
        totalPrice: qty * unitPrice,
        _fromDb: true,
      }
    })
    onChange(updated)
    setSuggestions([])
    setActiveRow(null)
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 text-left">Medicine / Generic Name</th>
              <th className="px-4 py-3 text-center w-24">Qty</th>
              <th className="px-4 py-3 text-left w-28">Unit</th>
              <th className="px-4 py-3 text-right w-36">Unit Price</th>
              <th className="px-4 py-3 text-right w-36">Total</th>
              {!readOnly && <th className="px-4 py-3 w-12" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 5 : 6} className="px-4 py-10 text-center text-slate-400 text-sm">
                  No medicines added. Click "Add Medicine Row" to start.
                </td>
              </tr>
            ) : (
              items.map((row, i) => (
                <tr key={i} className={`border-t border-slate-100 ${row._fromDb ? 'bg-emerald-50/30' : ''}`}>
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

                  {/* Quantity */}
                  <td className="px-4 py-2">
                    {readOnly ? (
                      <span className="text-center block">{row.quantity}</span>
                    ) : (
                      <input
                        type="number" min="0" step="0.5"
                        value={row.quantity}
                        onChange={(e) => updateRow(i, 'quantity', e.target.value)}
                        className="portal-input text-center py-1.5 w-20"
                      />
                    )}
                  </td>

                  {/* Unit */}
                  <td className="px-4 py-2">
                    {readOnly ? <span>{row.unit}</span> : (
                      <input
                        type="text" value={row.unit}
                        onChange={(e) => updateRow(i, 'unit', e.target.value)}
                        placeholder="tab/cap/ml"
                        className="portal-input py-1.5"
                      />
                    )}
                  </td>

                  {/* Unit Price */}
                  <td className="px-4 py-2">
                    {readOnly ? (
                      <span className="block text-right">{formatCurrency(row.unitPrice)}</span>
                    ) : (
                      <div className="relative">
                        <input
                          type="number" min="0" step="0.01"
                          value={row.unitPrice}
                          onChange={(e) => {
                            updateRow(i, 'unitPrice', e.target.value)
                            // clear fromDb flag if manually overriding price
                            if (row._fromDb) {
                              const updated = items.map((r, idx) => idx === i ? { ...r, _fromDb: false } : r)
                              onChange(updated)
                            }
                          }}
                          className={`portal-input text-right py-1.5 ${row._fromDb ? 'bg-emerald-50 text-emerald-800 font-semibold' : ''}`}
                        />
                        {row._fromDb && (
                          <span className="absolute -top-1.5 right-1 text-[9px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-100 px-1 rounded">DB</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Total */}
                  <td className="px-4 py-2 text-right font-semibold text-brand-primary">
                    {formatCurrency(parseFloat(row.totalPrice) || 0)}
                  </td>

                  {!readOnly && (
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => removeRow(i)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-brand-bg">
              <td colSpan={readOnly ? 4 : 5} className="px-4 py-3 text-right text-sm font-bold text-brand-primary">
                Grand Total:
              </td>
              <td className="px-4 py-3 text-right text-base font-bold text-brand-primary">
                {formatCurrency(grandTotal)}
              </td>
              {!readOnly && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {!readOnly && (
        <button type="button" onClick={addRow} className="mt-3 portal-button-secondary text-sm">
          <PlusIcon className="h-4 w-4" />
          Add Medicine Row
        </button>
      )}
    </div>
  )
}
