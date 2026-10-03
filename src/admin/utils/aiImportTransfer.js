const STORAGE_KEY = 'criabyteAdminIaImportPreview'

export function storeAiImportPreview(preview) {
  if (typeof window === 'undefined' || !preview) return false
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preview))
    return true
  } catch {
    return false
  }
}

export function readAiImportPreview(expectedDestination) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const destination = String(parsed?.destinoSugerido || '').toUpperCase()
    if (expectedDestination && destination && destination !== String(expectedDestination).toUpperCase()) return null
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    try { window.sessionStorage.removeItem(STORAGE_KEY) } catch { /* opcional */ }
    return null
  }
}

// A leitura durante o render precisa ser repetível: um render suspenso pode
// ser descartado pelo React antes que o formulário aplique seus dados.
export function clearAiImportPreview(preview) {
  if (typeof window === 'undefined' || !preview) return false
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw !== JSON.stringify(preview)) return false
    window.sessionStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function consumeAiImportPreview(expectedDestination) {
  const preview = readAiImportPreview(expectedDestination)
  if (preview) clearAiImportPreview(preview)
  return preview
}
