export function asText(value, fallback = '—') {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') return value.trim() || fallback
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    const candidate = value.nome ?? value.name ?? value.label ?? value.titulo ?? value.title ?? value.codigo ?? value.slug
    if (candidate !== undefined && candidate !== null) return asText(candidate, fallback)
  }
  return fallback
}

export function asNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function formatCurrency(value, fallback = 'Preço indisponível') {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(numeric)
}

export function formatRating(value) {
  return asNumber(value, 0).toFixed(1)
}

export function safeInitials(value, fallback = 'PC') {
  const text = asText(value, '').trim()
  if (!text) return fallback
  return text.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
