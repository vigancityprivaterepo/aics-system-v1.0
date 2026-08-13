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
