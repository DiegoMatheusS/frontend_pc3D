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

