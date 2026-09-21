import { productGroups, productsMock } from '../data/productsMock'
import { apiFirst, apiWriteFirst, extractList } from './dataSource'
import { normalizeProduct } from './normalizers'

function normalizeLike(item = {}) {
  return {
    produtoId: Number(item.produtoId),
    likesCount: Number(item.likesCount) || 0,
    likedByUser: item.likedByUser === true,
  }
}

export function getProductGroups() {
  return Promise.resolve(structuredClone(productGroups))
}

export function getProductLikeSummary(ids = []) {
  const productIds = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100)
  if (!productIds.length) return Promise.resolve([])

  return apiFirst({
    key: 'produto-likes',
    path: `/api/produto-likes/resumo?ids=${productIds.join(',')}`,
    fallback: () => [],
    transform: (payload) => extractList(payload, ['itens']).map(normalizeLike),
  })
}

export async function likeProduct(id) {
  return apiWriteFirst({
    key: 'produto-like',
    path: `/api/produto-likes/${encodeURIComponent(id)}`,
    options: { method: 'POST' },
    fallback: () => ({ produtoId: Number(id), likesCount: 0, likedByUser: true }),
    transform: normalizeLike,
  })
}

export async function unlikeProduct(id) {
  return apiWriteFirst({
    key: 'produto-like',
    path: `/api/produto-likes/${encodeURIComponent(id)}`,
    options: { method: 'DELETE' },
    fallback: () => ({ produtoId: Number(id), likesCount: 0, likedByUser: false }),
    transform: normalizeLike,
  })
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
  const products = [
    ...first.products,
    ...remaining.flatMap((page) => page.products),
  ]

  const ids = products.map((product) => product.id)
  const likeBatches = []
  for (let index = 0; index < ids.length; index += 100) {
    likeBatches.push(getProductLikeSummary(ids.slice(index, index + 100)).catch(() => []))
  }
  const likes = (await Promise.all(likeBatches)).flat()
  if (!likes.length) return products

  const likesByProduct = new Map(likes.map((item) => [String(item.produtoId), item]))
  return products.map((product) => {
    const like = likesByProduct.get(String(product.id))
    return like ? { ...product, ...like } : product
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
