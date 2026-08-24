import { productGroups, productsMock } from '../data/productsMock'
import { apiFirst, extractList } from './dataSource'
import { normalizeProduct } from './normalizers'

export function getProductGroups() {
  return Promise.resolve(structuredClone(productGroups))
}

export function getProducts() {
  return apiFirst({
    key: 'catalogo',
    path: '/api/produtos?pagina=1&limite=100',
    fallback: () => structuredClone(productsMock),
    transform: (payload) => extractList(payload, ['produtos']).map(normalizeProduct),
  })
}

export function getProductById(id) {
  return apiFirst({
    key: 'produto',
    path: /^\d+$/.test(String(id)) ? `/api/produtos/${encodeURIComponent(id)}` : `/api/produtos/slug/${encodeURIComponent(id)}`,
    fallback: () => {
      const product = productsMock.find((item) => String(item.id) === String(id) || item.slug === String(id))
      return structuredClone(product ?? null)
    },
    transform: (payload) => normalizeProduct(payload?.produto || payload),
  })
}
