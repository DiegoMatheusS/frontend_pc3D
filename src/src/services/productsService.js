import { productGroups, productsMock } from '../data/productsMock'
import { apiFirst, extractList } from './dataSource'
import { normalizeProduct } from './normalizers'

export function getProductGroups() {
  return Promise.resolve(structuredClone(productGroups))
}

async function getProductPage(page) {
  return apiFirst({
    key: `catalogo-${page}`,
    path: `/api/produtos?pagina=${page}&limite=100`,
    fallback: () => ({
      products: page === 1 ? structuredClone(productsMock) : [],
      totalPages: 1,
    }),
    transform: (payload) => ({
      products: extractList(payload, ['produtos']).map(normalizeProduct),
      totalPages: Math.max(1, Number(payload?.totalPaginas ?? payload?.totalPages ?? 1) || 1),
    }),
  })
}

export async function getProducts() {
  const first = await getProductPage(1)
  const pageCount = Math.min(first.totalPages, 50)
  const remaining = pageCount > 1
    ? await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => getProductPage(index + 2)))
    : []
  return [
    ...first.products,
    ...remaining.flatMap((page) => page.products),
  ]
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
