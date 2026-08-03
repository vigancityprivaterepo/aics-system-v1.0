import { useId } from 'react'

export default function SearchablePresetInput({
  value,
  onChange,
  options,
  placeholder = '',
  disabled = false,
  className = 'portal-input',
  listId,
}) {
  const generatedId = useId()
  const resolvedListId = listId || `preset-list-${generatedId}`

  return (
    <>
      <input
        type="text"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        list={resolvedListId}
        className={className}
        placeholder={placeholder}
        disabled={disabled}
      />
      <datalist id={resolvedListId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  )
}
