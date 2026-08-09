import { apiFirst, apiWriteFirst, extractList } from './dataSource'

const STORAGE_KEY = 'pcBuilderAvaliacoesLocais:v1'

const entityConfig = {
  produto: {
    list: (id) => `/api/produtos/${encodeURIComponent(id)}/avaliacoes`,
    submit: (id) => `/api/produtos/${encodeURIComponent(id)}/avaliacoes`,
  },
  hardware: {
    list: (id) => `/api/hardwares/${encodeURIComponent(id)}/avaliacoes`,
    submit: (id) => `/api/hardwares/${encodeURIComponent(id)}/avaliacoes`,
  },
  notebook: {
    list: (id) => `/api/notebooks/${encodeURIComponent(id)}/avaliacoes`,
    submit: (id) => `/api/notebooks/${encodeURIComponent(id)}/avaliacoes`,
  },
  montado: {
    list: (id) => `/api/builds/${encodeURIComponent(id)}/avaliacoes`,
    submit: (id) => `/api/builds/${encodeURIComponent(id)}/avaliacoes`,
  },
  build: {
    list: null,
    submit: (id) => `/api/comunidade/builds/${encodeURIComponent(id)}/avaliacao`,
  },
}

function safeParse(value, fallback) {
  try { return JSON.parse(value) } catch { return fallback }
}

function readStorage() {
  if (typeof localStorage === 'undefined') return {}
  const value = safeParse(localStorage.getItem(STORAGE_KEY) || '{}', {})
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function writeStorage(value) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

function storageId(type, id) {
  return `${type}:${id}`
}

function normalizeReview(item) {
  const author = item.usuario?.nome || item.autor?.nome || item.nomeUsuario || item.author || 'Usuário'
  return {
    id: item.id ?? `review-${Date.now()}`,
    author,
    rating: Number(item.nota ?? item.rating ?? 0) || 0,
    title: item.titulo || item.title || '',
    comment: item.comentario || item.texto || item.comment || '',
    createdAt: item.criadoEm || item.createdAt || new Date().toISOString(),
    own: Boolean(item.propria || item.own),
  }
}

function summaryFromPayload(payload) {
  const count = Number(
    payload?.quantidadeAvaliacoes
    ?? payload?.avaliacao?.quantidade
    ?? payload?.quantidade
    ?? payload?.count
    ?? 0,
  ) || 0
  const rating = Number(
    payload?.mediaAvaliacoes
    ?? payload?.avaliacao?.media
    ?? payload?.media
    ?? payload?.rating
    ?? 0,
  ) || 0
  return count ? { rating, count } : null
}

function getLocalReviews(type, id) {
  const items = readStorage()[storageId(type, id)]
  return Array.isArray(items) ? items.map(normalizeReview) : []
}

function saveLocalReview(type, id, input) {
  const store = readStorage()
  const key = storageId(type, id)
  const items = Array.isArray(store[key]) ? store[key] : []
  const identity = String(input.userId || input.email || input.author || 'local')
  const index = items.findIndex((item) => String(item.identity) === identity)
  const value = {
    id: index >= 0 ? items[index].id : `local-${Date.now()}`,
    identity,
    author: input.author || 'Usuário',
    rating: Number(input.rating),
    title: input.title || '',
    comment: input.comment || '',
    createdAt: index >= 0 ? items[index].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    own: true,
  }

  if (index >= 0) items[index] = value
  else items.unshift(value)
  store[key] = items
  writeStorage(store)
  return normalizeReview(value)
}

function endpoints(type) {
  const config = entityConfig[type]
  if (!config) throw new Error(`Tipo de avaliação não suportado: ${type}`)
  return config
}

export async function listReviews(type, id) {
  const config = endpoints(type)
  // BuildComunidade expõe a média/quantidade no próprio detalhe e ainda não
  // possui rota pública para listar avaliações individuais.
  if (type === 'build') {
    return { items: getLocalReviews(type, id), summary: null }
  }
  return apiFirst({
    key: `avaliacoes-${type}`,
    path: config.list(id),
    fallback: () => ({ items: getLocalReviews(type, id), summary: null }),
    transform: (payload) => {
      const items = extractList(payload, ['avaliacoes', 'reviews']).map(normalizeReview)
      const explicitSummary = summaryFromPayload(payload)
      const listRating = items.length ? items.reduce((total, item) => total + item.rating, 0) / items.length : 0
      return {
        items,
        summary: explicitSummary || (items.length ? { rating: listRating, count: items.length } : null),
      }
    },
  })
}

export async function submitReview(type, id, input) {
  const config = endpoints(type)
  return apiWriteFirst({
    key: `avaliacoes-${type}-escrita`,
    path: config.submit(id),
    options: {
      method: 'POST',
      body: type === 'build'
        ? { nota: Number(input.rating) }
        : {
            nota: Number(input.rating),
            titulo: input.title || undefined,
            comentario: input.comment || undefined,
          },
    },
    fallback: () => saveLocalReview(type, id, input),
    transform: (payload) => ({
      ...normalizeReview(payload?.avaliacao || payload?.review || payload),
      _summary: summaryFromPayload(payload),
    }),
  })
}
