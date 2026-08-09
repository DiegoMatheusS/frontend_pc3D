const baseLegado = (import.meta.env.VITE_LEGACY_BASE_URL || 'http://127.0.0.1:5500/').replace(/\/?$/, '/')

export function rotaLegada(caminho = '') {
  return `${baseLegado}${String(caminho).replace(/^\/+/, '')}`
}
