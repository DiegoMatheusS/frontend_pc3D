export function safeHttpUrl(value, { allowRelative = true } = {}) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (!allowRelative && !/^https?:\/\//i.test(raw)) return ''

  try {
    const target = new URL(raw, window.location.origin)
    if (!['http:', 'https:'].includes(target.protocol)) return ''
    if (target.username || target.password) return ''
    return target.toString()
  } catch {
    return ''
  }
}
