import RichTextEditor from './RichTextEditor'

export default function NarrativePresetField({ label, value, onChange, options = [], readOnly = false, placeholder = '', minHeightClass, fieldName }) {
  const choosePreset = (event) => {
    const option = options.find((item) => item.id === event.target.value)
    if (option) onChange(option.content)
    event.target.value = ''
  }

  return (
    <div data-field-name={fieldName}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <label className="portal-label">{label}</label>
        {!readOnly && options.length > 0 && (
          <select className="portal-input w-auto max-w-[18rem] py-1.5 text-xs" defaultValue="" onChange={choosePreset} aria-label={`Choose ${label} preset`}>
            <option value="">Choose saved option...</option>
            {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        )}
      </div>
      <RichTextEditor value={value} onChange={onChange} readOnly={readOnly} minHeightClass={minHeightClass} placeholder={placeholder} fieldName={fieldName} />
    </div>
  )
}
