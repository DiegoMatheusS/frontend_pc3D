import { apiRequest } from '../../services/httpClient'

export function productImageIdentity(product = {}) {
  return Object.fromEntries(['nome', 'marca', 'modelo', 'mpn', 'gtin'].map((key) => [
    key, String(product[key] || '').trim(),
  ]))
}

export function canSearchProductImage(product) {
  const identity = productImageIdentity(product)
  return identity.nome.length >= 2 && Boolean(identity.modelo || identity.mpn || identity.gtin)
}

export const productImageService = {
  search: (product, options = {}) => apiRequest('/api/admin/produtos/buscar-imagem', {
    ...options,
    method: 'POST',
    body: productImageIdentity(product),
  }),
  searchAndSave: (id) => apiRequest(`/api/admin/produtos/${Number(id)}/imagem`, {
    method: 'POST',
  }),
}
