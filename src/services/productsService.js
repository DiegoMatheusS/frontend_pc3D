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

      const remainingPages = totalPages > 1
        ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) => index + 2).map((pagina) =>
            apiRequest(`/api/produtos?pagina=${pagina}&limite=100`),
          ),
        )
        : []

      const allProducts = [
        ...firstPage,
        ...remainingPages.flatMap((page) => extractList(page, ['produtos'])),
      ]

      // Evita contagem duplicada caso uma atualização do catálogo mova um item
      // entre páginas durante o carregamento.
      const uniqueProducts = [...new Map(allProducts.map((item) => [String(item.id), item])).values()]
      const normalized = uniqueProducts.map(normalizeProduct)

      // Algumas listagens públicas retornam um card enxuto e omitem `descricao`,
      // principalmente em periféricos e itens de setup. Busca o detalhe somente
      // dos produtos que realmente vieram sem descrição, em lotes pequenos.
      const missingIndexes = normalized
        .map((product, index) => (!String(product.description || '').trim() ? index : -1))
        .filter((index) => index >= 0)

      for (let start = 0; start < missingIndexes.length; start += 6) {
        const batch = missingIndexes.slice(start, start + 6)
        const details = await Promise.allSettled(batch.map((index) => {
          const raw = uniqueProducts[index]
          const ref = raw?.id ?? normalized[index]?.id
          return ref === undefined || ref === null
            ? Promise.resolve(null)
            : apiRequest(`/api/produtos/${encodeURIComponent(ref)}`)
        }))

        details.forEach((result, offset) => {
          if (result.status !== 'fulfilled' || !result.value) return
          const index = batch[offset]
          const detail = normalizeProduct(result.value?.produto || result.value)
          if (detail?.description) normalized[index] = { ...normalized[index], ...detail }
        })
      }

      return normalized
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
