const baseLegado = (import.meta.env.VITE_LEGACY_BASE_URL || '/legacy-builder/').replace(/\/?$/, '/')

export function rotaLegada(caminho = '') {
  return `${baseLegado}${String(caminho).replace(/^\/+/, '')}`
}
