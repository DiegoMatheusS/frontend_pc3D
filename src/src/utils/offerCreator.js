function cleanName(value) {
  if (typeof value === 'string') return value.trim() || null
  if (!value || typeof value !== 'object') return null
  const candidate = value.nome ?? value.name ?? value.apelido ?? value.username ?? value.email
  return typeof candidate === 'string' ? candidate.trim() || null : null
}

export function getOfferCreatorName(offer) {
  if (!offer || typeof offer !== 'object') return null

  const candidates = [
    offer.usuarioOrigem,
    offer.criadoPorUsuario,
    offer.cadastradoPorUsuario,
    offer.usuario,
    offer.cadastradoPor,
    offer.criadoPor,
    offer.sugestaoOrigem?.usuario,
    offer.sugestao?.usuario,
    offer.origem?.usuario,
    offer.usuarioOrigemNome,
    offer.criadoPorNome,
    offer.cadastradoPorNome,
    offer.usuarioNome,
    offer.sugestaoOrigem?.usuarioNome,
  ]

  for (const candidate of candidates) {
    const name = cleanName(candidate)
    if (name) return name
  }

  return null
}

export function getOfferCreatorId(offer) {
  if (!offer || typeof offer !== 'object') return null
  const raw = offer.usuarioOrigemId
    ?? offer.criadoPorUsuarioId
    ?? offer.cadastradoPorUsuarioId
    ?? offer.usuarioId
    ?? offer.sugestaoOrigem?.usuarioId
    ?? offer.sugestaoOrigem?.usuario?.id
    ?? offer.sugestao?.usuario?.id
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function getCommunityOfferCreatorName(offer) {
  if (!offer || typeof offer !== 'object') return null

  const hasCommunityOrigin = Boolean(
    offer.cadastradoPor
    || offer.usuarioOrigem
    || offer.usuarioOrigemId
    || offer.sugestaoOrigem
    || offer.sugestao
    || offer.sugestaoOferta
    || offer.sugestaoOrigemId
    || offer.sugestaoOfertaId
    || offer.origemSugestaoId
    || String(offer.origem || offer.fonte || '').toUpperCase().includes('COMUNIDADE')
  )
  if (!hasCommunityOrigin) return null

  const candidates = [
    offer.cadastradoPor,
    offer.sugestaoOrigem?.usuario,
    offer.sugestao?.usuario,
    offer.sugestaoOferta?.usuario,
    offer.usuarioOrigem,
    offer.sugestaoOrigem?.usuarioNome,
    offer.sugestao?.usuarioNome,
    offer.usuarioOrigemNome,
  ]

  for (const candidate of candidates) {
    const name = cleanName(candidate)
    if (name) return name
  }
  return null
}
