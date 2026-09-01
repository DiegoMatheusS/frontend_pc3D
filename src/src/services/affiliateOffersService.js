import { apiRequest } from './httpClient'

function cleanScope({ busca, tag, descontoMinimo, ordenar } = {}) {
  const params = new URLSearchParams()
  const search = String(busca || '').trim()
  const selectedTag = String(tag || '').trim()
  const selectedSort = String(ordenar || '').trim()

  if (search) params.set('busca', search)
  if (selectedTag && selectedTag !== 'TODOS') params.set('tag', selectedTag)
  if (Number(descontoMinimo) > 0) params.set('descontoMinimo', String(Number(descontoMinimo)))
  if (selectedSort) params.set('ordenar', selectedSort)

  const query = params.toString()
  return query ? `?${query}` : ''
}

export function listarBuscaOfertas(scope = {}) {
  return apiRequest(`/api/admin/busca-ofertas${cleanScope(scope)}`)
}

export function atualizarBuscaOfertas(scope = {}) {
  return apiRequest(`/api/admin/busca-ofertas/atualizar${cleanScope(scope)}`, {
    method: 'POST',
  })
}


export function statusVerificacaoPrecos() {
  return apiRequest('/api/admin/ofertas/verificacao-precos/status')
}

export function verificarPrecosOfertas(limite = 50) {
  return apiRequest('/api/admin/ofertas/verificar-precos', {
    method: 'POST',
    body: { limite: Number(limite) || 50 },
  })
}
