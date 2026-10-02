export function emptyOfferRow() {
  return {
    id: null,
    parceiroId: '',
    preco: '',
    precoAnterior: '',
    frete: '',
    validoAte: '',
    vendedorNome: '',
    vendedorIdentificador: '',
    urlOriginal: '',
    urlAfiliada: '',
    status: 'ATIVA',
    _removed: false,
  }
}

function localDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function normalizeOfferRow(item = {}) {
  return {
    ...emptyOfferRow(),
    id: item.id ?? null,
    parceiroId: item.parceiroId ?? item.parceiro?.id ?? '',
    preco: item.preco ?? item.precoAtual ?? '',
    precoAnterior: item.precoAnterior ?? '',
    frete: item.frete ?? '',
    validoAte: localDateTime(item.validoAte),
    vendedorNome: String(item.vendedorNome ?? item.vendedor ?? ''),
    vendedorIdentificador: String(item.vendedorIdentificador ?? ''),
    urlOriginal: String(item.urlOriginal ?? item.url ?? ''),
    urlAfiliada: String(item.urlAfiliada ?? item.urlAfiliado ?? ''),
    status: String(item.status ?? 'ATIVA'),
  }
}

export function aiImportOfferRow(offer = {}, partners = []) {
  const token = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const partnerName = token(offer.parceiroNome)
  let originalHost = ''
  try { originalHost = new URL(offer.urlOriginal).hostname.toLowerCase() } catch { /* URL ausente */ }
  const matched = partners.find((partner) => {
    if (partner.ativo === false) return false
    if (offer.parceiroId) return Number(partner.id) === Number(offer.parceiroId)
    if (partnerName && [partner.nome, partner.slug].some((value) => token(value) === partnerName)) return true
    const domain = String(partner.dominio || '').trim().toLowerCase().replace(/^www\./, '')
    return Boolean(domain && (originalHost === domain || originalHost.endsWith(`.${domain}`)))
  })
  return {
    ...normalizeOfferRow(offer),
    id: null,
    parceiroId: String(offer.parceiroId || matched?.id || ''),
  }
}
