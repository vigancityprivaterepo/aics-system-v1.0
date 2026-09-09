// Wraps a react-hook-form register() call so the input's value is forced
// uppercase as the user types, matching the backend's own normalization.
export function registerUppercase(register, name, options) {
  const field = register(name, options)
  return {
    ...field,
    onChange: (event) => {
      event.target.value = event.target.value.toUpperCase()
      return field.onChange(event)
    },
  }
}

// Wraps a react-hook-form register() call for a peso amount field so that,
// once the encoder leaves the field, it always shows two decimal places
// (e.g. "3000" -> "3000.00"). Makes a mistyped extra digit easier to spot
// and keeps amounts consistent with the currency values shown elsewhere.
export function registerAmount(register, name, options) {
  const field = register(name, options)
  return {
    ...field,
    onBlur: (event) => {
      const raw = event.target.value
      if (raw !== '' && Number.isFinite(Number(raw))) {
        event.target.value = Number(raw).toFixed(2)
      }
      return field.onBlur(event)
    },
  }
}
