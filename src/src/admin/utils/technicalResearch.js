export function mergeResearchGaps(current = {}, found = {}) {
  const next = { ...current }
  for (const [key, value] of Object.entries(found)) {
    const absent = next[key] === null || next[key] === undefined || next[key] === ''
      || (Array.isArray(next[key]) && next[key].length === 0)
    if (absent && value !== null && value !== undefined && value !== '') next[key] = value
  }
  return next
}

export function technicalResearchFromPreview(preview) {
  return preview?.pesquisaTecnica || preview?.iaTecnicaAutomatica
    || preview?.resultadoProdutoIa?.iaTecnicaAutomatica || preview
}

export function researchEvidenceRows(research) {
  const origins = research?.origemPorCampo || {}
  return Object.entries(origins).flatMap(([field, item]) => {
    if (!item || !item.trecho || !item.evidenciaCampoConfirmada) return []
    try {
      const url = new URL(item.url)
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return []
      return [{ field, ...item, url: url.href }]
    } catch { return [] }
  })
}

export function openHardwareResearchDraft(component, openWindow = (...args) => window.open(...args)) {
  const payload = component?.cadastroHardwareSugerido
  if (!payload) return false
  const popup = openWindow('about:blank', '_blank')
  if (!popup) return false
  try {
    popup.opener = null
    popup.sessionStorage.setItem('criabyteAdminIaImportPreview', JSON.stringify({
      destinoSugerido: 'HARDWARE', categoriaSugerida: component.categoria,
      cadastroSugerido: { payload }, pesquisaTecnica: component.pesquisaTecnica,
    }))
    popup.location.replace('/admin/hardwares/novo?origem=ia-importacao')
    return true
  } catch {
    popup.close()
    return false
  }
}
