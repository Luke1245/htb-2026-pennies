export const DISPLAY_NAME_LIMIT = 80

export function firstNameError(value) {
  const name = value.trim()
  if (!name) return 'Enter your first name.'
  if (name.length > DISPLAY_NAME_LIMIT) return 'A first name must be 80 characters or fewer.'
  return ''
}
