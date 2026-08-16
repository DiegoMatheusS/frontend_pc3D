import { productGroups, productsMock } from '../data/productsMock'
import { apiFirst, extractList } from './dataSource'
import { apiRequest } from './httpClient'
import { normalizeProduct } from './normalizers'

export function getProductGroups() {
  return Promise.resolve(structuredClone(productGroups))
}

export function getProducts() {
  return apiFirst({
    key: 'catalogo',
    path: '/api/produtos?pagina=1&limite=100',
    fallback: () => structuredClone(productsMock),
    transform: async (payload) => {
      const firstPage = extractList(payload, ['produtos'])
      const totalPages = Math.max(1, Number(payload?.totalPaginas) || 1)

      if (totalPages === 1) return firstPage.map(normalizeProduct)

      const remainingPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) => index + 2).map((pagina) =>
          apiRequest(`/api/produtos?pagina=${pagina}&limite=100`),
        ),
      )

      const allProducts = [
        ...firstPage,
        ...remainingPages.flatMap((page) => extractList(page, ['produtos'])),
      ]

      // Evita contagem duplicada caso uma atualização do catálogo mova um item
      // entre páginas durante o carregamento.
      const uniqueProducts = [...new Map(allProducts.map((item) => [String(item.id), item])).values()]
      return uniqueProducts.map(normalizeProduct)
    },
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
