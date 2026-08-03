import { useEffect, useState } from 'react'
import { OTHER_OPTION_VALUE, resolvePresetSelection } from '../constants/caseFormOptions'

export default function PresetSelectField({
  value,
  onChange,
  options,
  placeholder = 'Select option',
  otherPlaceholder = 'Specify value',
  disabled = false,
}) {
  const [selection, setSelection] = useState(() => resolvePresetSelection(value, options))

  useEffect(() => {
    setSelection(resolvePresetSelection(value, options))
  }, [value, options])

  return (
    <>
      <select
        value={selection}
        onChange={(e) => {
          const nextSelection = e.target.value
          setSelection(nextSelection)
          onChange(nextSelection === OTHER_OPTION_VALUE ? '' : nextSelection)
        }}
        className="portal-input"
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
        <option value={OTHER_OPTION_VALUE}>Others (specify)</option>
      </select>

      {selection === OTHER_OPTION_VALUE && (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="portal-input mt-2"
          placeholder={otherPlaceholder}
          disabled={disabled}
        />
      )}
    </>
  )
}
