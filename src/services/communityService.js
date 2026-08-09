import { buildsMock } from '../data/buildsMock'
import { ApiError, apiRequest } from './httpClient'
import { apiFirst, apiWriteFirst, dataMode, extractList, reportDataSource } from './dataSource'
import { normalizeCommunityBuild } from './normalizers'

const LOCAL_BUILDS_KEY = 'pcBuilderCommunityBuilds:v1'
const LOCAL_COMMENTS_KEY = 'pcBuilderCommunityComments:v1'


const COMMUNITY_PRICE_CACHE_MS = 2 * 60 * 1000
let communityPriceCache = {
  expiresAt: 0,
  byHardware: new Map(),
}

function componentHardwareId(component) {
  const value = component?.hardwareId ?? component?.hardware?.id
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null
}

function componentQuantity(component) {
  return Math.max(1, Number(component?.quantidade) || 1)
}

function priceFromProduct(product) {
  const value = product?.melhorOferta?.preco
    ?? product?.melhorOferta?.precoAtual
    ?? product?.melhorPreco?.preco
    ?? product?.melhorPreco
    ?? product?.precoAtual
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

async function carregarPrecosHardware(idsNecessarios = []) {
  const wanted = new Set(idsNecessarios.map(Number).filter((id) => Number.isInteger(id) && id > 0))
  if (!wanted.size) return new Map()

  const now = Date.now()
  if (communityPriceCache.expiresAt > now) {
    const cached = new Map()
    wanted.forEach((id) => {
      if (communityPriceCache.byHardware.has(id)) cached.set(id, communityPriceCache.byHardware.get(id))
    })
    if (cached.size === wanted.size) return cached
  }

  const byHardware = communityPriceCache.expiresAt > now
    ? new Map(communityPriceCache.byHardware)
    : new Map()

  let page = 1
  let totalPages = 1
  const maxPages = 20

  while (page <= totalPages && page <= maxPages) {
    const payload = await apiRequest(`/api/produtos?grupo=COMPONENTES&comOferta=true&pagina=${page}&limite=100`)
    const products = extractList(payload, ['produtos'])

    products.forEach((product) => {
      const hardwareId = Number(product?.hardware?.id)
      const price = priceFromProduct(product)
      if (Number.isInteger(hardwareId) && hardwareId > 0 && price > 0) {
        byHardware.set(hardwareId, {
          price,
          productId: product.id ?? null,
          productSlug: product.slug ?? null,
          offer: product.melhorOferta ?? null,
        })
      }
    })

    totalPages = Math.max(1, Number(payload?.totalPaginas) || 1)
    const allFound = [...wanted].every((id) => byHardware.has(id))
    if (allFound) break
    page += 1
  }

  communityPriceCache = {
    expiresAt: now + COMMUNITY_PRICE_CACHE_MS,
    byHardware,
  }

  const result = new Map()
  wanted.forEach((id) => {
    if (byHardware.has(id)) result.set(id, byHardware.get(id))
  })
  return result
}

function aplicarPrecoAtual(build, pricesByHardware) {
  const components = Array.isArray(build?.components) ? build.components : []
  if (!components.length) return build

  let totalUnits = 0
  let pricedUnits = 0
  let currentPrice = 0

  components.forEach((component) => {
    const quantity = componentQuantity(component)
    totalUnits += quantity
    const hardwareId = componentHardwareId(component)
    const priceInfo = hardwareId ? pricesByHardware.get(hardwareId) : null
    if (!priceInfo?.price) return
    currentPrice += priceInfo.price * quantity
    pricedUnits += quantity
  })

  return {
    ...build,
    currentPrice,
    currentPriceComplete: totalUnits > 0 && pricedUnits === totalUnits,
    currentPriceCoverage: {
      priced: pricedUnits,
      total: totalUnits,
    },
  }
}

async function enriquecerBuildsComPrecoAtual(builds = []) {
  const list = Array.isArray(builds) ? builds : []
  const ids = [...new Set(list.flatMap((build) => (
    (build?.components || []).map(componentHardwareId).filter(Boolean)
  )))]
  if (!ids.length) return list

  try {
    const prices = await carregarPrecosHardware(ids)
    return list.map((build) => aplicarPrecoAtual(build, prices))
  } catch {
    // O preço atual é complementar. Falha de Ofertas não pode impedir a Comunidade.
    return list
  }
}

const CATEGORY_API = {
  gabinete: 'GABINETE',
  processador: 'PROCESSADOR',
  placamae: 'PLACA_MAE',
  cooler: 'COOLER',
  memoria: 'MEMORIA_RAM',
  placavideo: 'PLACA_VIDEO',
  armazenamento: 'ARMAZENAMENTO',
  fonte: 'FONTE',
  ventoinhas: 'VENTOINHA',
}

const CATEGORY_ALIASES = {
  GABINETE: 'GABINETE',
  PROCESSADOR: 'PROCESSADOR',
  CPU: 'PROCESSADOR',
  'PLACA MAE': 'PLACA_MAE',
  PLACA_MAE: 'PLACA_MAE',
  COOLER: 'COOLER',
  'MEMORIA RAM': 'MEMORIA_RAM',
  MEMORIA_RAM: 'MEMORIA_RAM',
  RAM: 'MEMORIA_RAM',
  'PLACA DE VIDEO': 'PLACA_VIDEO',
  PLACA_VIDEO: 'PLACA_VIDEO',
  GPU: 'PLACA_VIDEO',
  ARMAZENAMENTO: 'ARMAZENAMENTO',
  SSD: 'ARMAZENAMENTO',
  FONTE: 'FONTE',
  VENTOINHA: 'VENTOINHA',
  VENTOINHAS: 'VENTOINHA',
  FANS: 'VENTOINHA',
}

function safeParse(value, fallback) {
  try { return JSON.parse(value) } catch { return fallback }
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function readObject(key) {
  if (typeof localStorage === 'undefined') return {}
  const value = safeParse(localStorage.getItem(key) || '{}', {})
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function writeObject(key, value) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value))
}

function readLocalBuilds() {
  if (typeof localStorage === 'undefined') return []
  const value = safeParse(localStorage.getItem(LOCAL_BUILDS_KEY) || '[]', [])
  return Array.isArray(value) ? value : []
}

function writeLocalBuilds(items) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(LOCAL_BUILDS_KEY, JSON.stringify(items.slice(0, 80)))
}

function slugify(value) {
  return String(value || 'build')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'build'
}

function componentValue(configuration, key) {
  const value = configuration?.[key]
  const first = Array.isArray(value) ? value.find(Boolean) : value
  if (!first) return '—'
  if (typeof first === 'string' || typeof first === 'number') return String(first)
  return first.nome || first.name || first.modelo || String(first.id || '—')
}

function localBuildFromInput(input, user) {
  const now = new Date().toISOString()
  const base = slugify(input.titulo)
  const existing = readLocalBuilds()
  let slug = base
  let suffix = 2
  while (existing.some((item) => item.slug === slug)) slug = `${base}-${suffix++}`

  const saved = input.build
  const configuration = saved.configuracao || {}
  const tags = Array.isArray(input.tags) ? input.tags : []
  const value = {
    id: `local-${Date.now()}`,
    slug,
    titulo: input.titulo,
    descricao: input.descricao,
    finalidade: input.finalidade,
    resolucao: input.resolucao,
    visibilidade: input.visibilidade,
    status: 'PUBLICADA',
    autor: { id: user?.id, nome: user?.nome || 'Usuário' },
    precoNaPublicacao: Number(saved.precoTotal || 0),
    consumoNaPublicacao: Number(saved.consumoTotal || 0),
    mediaAvaliacoes: 0,
    quantidadeAvaliacoes: 0,
    quantidadeComentarios: 0,
    quantidadeCopias: 0,
    visualizacoes: 0,
    publicadoEm: now,
    criadoEm: now,
    tags,
    configuracao3D: configuration,
    processador: componentValue(configuration, 'processador'),
    placaVideo: componentValue(configuration, 'placavideo'),
    placaMae: componentValue(configuration, 'placamae'),
    memoria: componentValue(configuration, 'memoria'),
    armazenamento: componentValue(configuration, 'armazenamento'),
    fonte: componentValue(configuration, 'fonte'),
    comentarios: [],
  }
  writeLocalBuilds([value, ...existing])
  return normalizeCommunityBuild(value)
}

function localCommentsFor(buildId) {
  const store = readObject(LOCAL_COMMENTS_KEY)
  const value = store[String(buildId)]
  return Array.isArray(value) ? value : []
}

function saveLocalComment(buildId, input, user) {
  const store = readObject(LOCAL_COMMENTS_KEY)
  const key = String(buildId)
  const items = Array.isArray(store[key]) ? store[key] : []
  const parentId = input.comentarioPaiId ?? null
  const comment = {
    id: `local-comment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    author: user?.nome || 'Usuário',
    text: input.texto,
    time: new Date().toISOString(),
    replies: [],
    own: true,
  }

  if (parentId) {
    const parent = items.find((item) => String(item.id) === String(parentId))
    if (parent) parent.replies = [...(parent.replies || []), comment]
    else items.push({ ...comment, parentId })
  } else {
    items.push(comment)
  }

  store[key] = items
  writeObject(LOCAL_COMMENTS_KEY, store)
  return comment
}

function mergeLocalComments(build) {
  const local = localCommentsFor(build.id)
  if (!local.length) return build
  const comments = (build.comments || []).map((item) => ({ ...item, replies: [...(item.replies || [])] }))
  let added = 0

  local.forEach((item) => {
    if (item.parentId) {
      const parent = comments.find((comment) => String(comment.id) === String(item.parentId))
      if (parent) parent.replies.push(item)
      else comments.push(item)
    } else {
      comments.push(item)
    }
    added += 1 + (item.replies?.length || 0)
  })

  return { ...build, comments, commentsCount: Number(build.commentsCount || 0) + added }
}

function categoryApi(value) {
  const normalized = normalizeText(value).replace(/ /g, '_')
  return CATEGORY_API[String(value || '').toLowerCase()] || CATEGORY_ALIASES[normalizeText(value)] || CATEGORY_ALIASES[normalized] || null
}

function applyLocalFilters(items, filtros = {}) {
  const busca = normalizeText(filtros.busca)
  const finalidade = normalizeText(filtros.finalidade)
  const resolucao = normalizeText(filtros.resolucao)
  const filtered = items.filter((item) => {
    const normalized = normalizeCommunityBuild(item)
    if (busca && ![normalized.title, normalized.description, normalized.author, normalized.cpu, normalized.gpu]
      .some((value) => normalizeText(value).includes(busca))) return false
    if (finalidade && !normalizeText(normalized.purpose).includes(finalidade)) return false
    if (resolucao && !normalizeText(normalized.resolution).includes(resolucao)) return false
    return true
  }).map(normalizeCommunityBuild).map(mergeLocalComments)

  if (filtros.ordenar === 'MAIS_COPIADAS') return filtered.sort((a, b) => b.copies - a.copies)
  return filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

function buildListPath(filtros = {}) {
  const params = new URLSearchParams()
  if (filtros.busca?.trim()) params.set('busca', filtros.busca.trim())
  if (filtros.finalidade?.trim()) params.set('finalidade', filtros.finalidade.trim())
  if (filtros.resolucao?.trim()) params.set('resolucao', filtros.resolucao.trim())
  if (filtros.processador) params.set('processador', String(filtros.processador))
  if (filtros.gpu) params.set('gpu', String(filtros.gpu))
  if (filtros.ordenar) params.set('ordenar', filtros.ordenar)
  params.set('pagina', String(filtros.pagina || 1))
  params.set('limite', String(Math.min(50, Math.max(1, Number(filtros.limite) || 50))))
  return `/api/comunidade/builds?${params.toString()}`
}

export function listarBuilds(filtros = {}) {
  return apiFirst({
    key: 'comunidade',
    path: buildListPath(filtros),
    fallback: () => applyLocalFilters([
      ...readLocalBuilds().filter((item) => item.visibilidade === 'PUBLICA'),
      ...structuredClone(buildsMock),
    ], filtros),
    transform: async (payload) => enriquecerBuildsComPrecoAtual(
      extractList(payload, ['builds'])
        .map(normalizeCommunityBuild)
        .map(mergeLocalComments),
    ),
  })
}

export function listarMinhasBuilds(user) {
  return apiFirst({
    key: 'comunidade-minhas',
    path: '/api/comunidade/builds/minhas',
    fallback: () => readLocalBuilds()
      .filter((item) => !user?.id || String(item.autor?.id || '') === String(user.id))
      .map(normalizeCommunityBuild)
      .map(mergeLocalComments),
    transform: async (payload) => enriquecerBuildsComPrecoAtual(
      extractList(payload, ['builds'])
        .map(normalizeCommunityBuild)
        .map(mergeLocalComments),
    ),
  })
}

function localBuildByReference(reference) {
  return readLocalBuilds().find((build) => String(build.id) === String(reference) || build.slug === reference)
    || structuredClone(buildsMock.find((build) => String(build.id) === String(reference) || build.slug === reference) ?? null)
}

export function buscarBuildPorSlug(reference) {
  const value = String(reference || '').trim()
  const numericId = /^\d+$/.test(value) ? Number(value) : null

  if (numericId) {
    return apiFirst({
      key: 'comunidade-build',
      path: `/api/comunidade/builds/${numericId}`,
      fallback: () => {
        const item = localBuildByReference(value)
        return item ? mergeLocalComments(normalizeCommunityBuild(item)) : null
      },
      transform: async (payload) => {
        const normalized = mergeLocalComments(normalizeCommunityBuild(payload?.build || payload))
        const [enriched] = await enriquecerBuildsComPrecoAtual([normalized])
        return enriched || normalized
      },
    })
  }

  return apiFirst({
    key: 'comunidade-build',
    path: buildListPath({ limite: 50 }),
    fallback: () => {
      const item = localBuildByReference(value)
      return item ? mergeLocalComments(normalizeCommunityBuild(item)) : null
    },
    transform: async (payload) => {
      const found = extractList(payload, ['builds']).find((item) => item.slug === value)
      if (!found) return null
      const normalized = mergeLocalComments(normalizeCommunityBuild(found))
      const [enriched] = await enriquecerBuildsComPrecoAtual([normalized])
      return enriched || normalized
    },
  })
}

function savedComponents(build = {}) {
  if (Array.isArray(build.componentes) && build.componentes.length) {
    return build.componentes.map((item, index) => ({
      nome: item.nome || item.name || item.modelo || '',
      marca: item.marca || item.brand || '',
      modelo: item.modelo || item.model || '',
      imagemUrl: item.imagemUrl || item.imagem || item.image || '',
      categoria: categoryApi(item.categoriaCodigo || item.categoria || item.category || item.slot),
      posicao: item.posicao || item.slot || undefined,
      quantidade: Math.max(1, Number(item.quantidade) || 1),
      origem: item.origem || item.origin || undefined,
      especificacoes: item.especificacoes || item.specs || undefined,
      fonteDadosUrl: item.fonteDadosUrl || item.sourceUrl || undefined,
      modelo3dUrl: item.modelo3dUrl || item.modelo3DUrl || item.model3dUrl || undefined,
      legacyId: item.hardwareId || item.id || null,
      index,
    })).filter((item) => item.categoria && item.nome)
  }

  return Object.entries(build.configuracao || {}).flatMap(([categoria, value]) => {
    const values = Array.isArray(value) ? value : [value]
    return values.filter(Boolean).map((item, index) => ({
      nome: typeof item === 'object' ? (item.nome || item.name || item.modelo || String(item.id || '')) : String(item || ''),
      marca: typeof item === 'object' ? (item.marca || item.brand || '') : '',
      modelo: typeof item === 'object' ? (item.modelo || item.model || '') : '',
      imagemUrl: typeof item === 'object' ? (item.imagemUrl || item.imagem || item.image || '') : '',
      categoria: CATEGORY_API[categoria] || categoryApi(categoria),
      posicao: Array.isArray(value) ? `${categoria} ${index + 1}` : undefined,
      quantidade: Math.max(1, Number(typeof item === 'object' ? item.quantidade : 1) || 1),
      origem: typeof item === 'object' ? (item.origem || item.origin || undefined) : undefined,
      especificacoes: typeof item === 'object' ? (item.especificacoes || item.specs || undefined) : undefined,
      fonteDadosUrl: typeof item === 'object' ? (item.fonteDadosUrl || item.sourceUrl || undefined) : undefined,
      modelo3dUrl: typeof item === 'object' ? (item.modelo3dUrl || item.modelo3DUrl || item.model3dUrl || undefined) : undefined,
      legacyId: typeof item === 'object' ? (item.hardwareId ?? item.id) : item,
      index,
    }))
  }).filter((item) => item.categoria && item.nome)
}

function matchHardware(component, hardwares) {
  const sameCategory = hardwares.filter((hardware) => String(hardware.categoria) === component.categoria)
  const numeric = Number(component.legacyId)
  if (Number.isInteger(numeric) && numeric > 0) {
    const exactId = sameCategory.find((hardware) => hardware.id === numeric)
    if (exactId) return exactId
  }

  const target = normalizeText(component.nome || component.legacyId)
  if (!target) return null

  const scored = sameCategory.map((hardware) => {
    const name = normalizeText(hardware.nome)
    const model = normalizeText(hardware.modelo)
    const brandModel = normalizeText(`${hardware.marca || ''} ${hardware.modelo || ''}`)
    const slug = normalizeText(hardware.slug)
    let score = 0
    if (target === name) score = 100
    else if (target === brandModel) score = 95
    else if (target === model) score = 90
    else if (target === slug) score = 88
    else if (target.length >= 5 && name.includes(target)) score = 75
    else if (target.length >= 5 && target.includes(name)) score = 70
    else if (model.length >= 4 && target.includes(model)) score = 65
    return { hardware, score }
  }).sort((a, b) => b.score - a.score)

  return scored[0]?.score >= 65 ? scored[0].hardware : null
}

async function prepararComponentesBackend(build) {
  const source = savedComponents(build)
  if (!source.length) throw new Error('A build não possui componentes suficientes para publicação.')

  let hardwares = []
  try {
    const hardwaresPayload = await apiRequest('/api/hardwares')
    hardwares = extractList(hardwaresPayload)
  } catch {
    // A associação ao catálogo é opcional. A publicação continua pelo snapshot.
    hardwares = []
  }

  return source.map((component) => {
    const hardware = matchHardware(component, hardwares)
    return {
      ...(hardware?.id ? { hardwareId: hardware.id } : {}),
      categoria: component.categoria,
      nome: component.nome.slice(0, 200),
      ...(component.marca ? { marca: component.marca.slice(0, 100) } : {}),
      ...(component.modelo ? { modelo: component.modelo.slice(0, 150) } : {}),
      ...(component.imagemUrl ? { imagemUrl: component.imagemUrl.slice(0, 500) } : {}),
      quantidade: component.quantidade,
      ...(component.posicao ? { posicao: String(component.posicao).slice(0, 100) } : {}),
      origem: hardware?.id ? 'CATALOGO' : (component.origem || 'EXTERNO'),
      ...(component.especificacoes && typeof component.especificacoes === 'object' ? { especificacoes: component.especificacoes } : {}),
      ...(component.fonteDadosUrl ? { fonteDadosUrl: String(component.fonteDadosUrl).slice(0, 500) } : {}),
      ...(component.modelo3dUrl ? { modelo3dUrl: String(component.modelo3dUrl).slice(0, 500) } : {}),
    }
  })
}

function normalizeComment(item, user) {
  return {
    id: item.id,
    author: item.usuario?.nome || item.autor?.nome || item.author || 'Usuário',
    text: item.removido ? 'Comentário removido.' : (item.texto || item.text || ''),
    time: item.criadoEm || item.createdAt || item.time || '',
    removed: Boolean(item.removido),
    own: Boolean(user?.id && Number(item.usuarioId ?? item.usuario?.id) === Number(user.id)),
    replies: (item.respostas || item.replies || []).map((reply) => normalizeComment(reply, user)),
  }
}

export function listarComentarios(buildId, user) {
  return apiFirst({
    key: 'comunidade-comentarios',
    path: `/api/comunidade/builds/${encodeURIComponent(buildId)}/comentarios`,
    fallback: () => localCommentsFor(buildId),
    transform: (payload) => (payload?.comentarios || payload?.comments || []).map((item) => normalizeComment(item, user)),
  })
}

export function copiarBuildComunidade(buildId) {
  return apiWriteFirst({
    key: 'comunidade-copiar',
    path: `/api/comunidade/builds/${encodeURIComponent(buildId)}/copiar`,
    options: { method: 'POST' },
    fallback: () => ({ id: buildId, local: true }),
    transform: (payload) => normalizeCommunityBuild(payload?.build || payload),
  })
}

export async function publicarBuild(input, user) {
  if (dataMode === 'mock') {
    reportDataSource('comunidade-publicar', 'mock')
    return localBuildFromInput(input, user)
  }

  try {
    const componentes = await prepararComponentesBackend(input.build)
    const draft = await apiRequest('/api/comunidade/builds', {
      method: 'POST',
      body: {
        titulo: input.titulo,
        descricao: input.descricao || undefined,
        finalidade: input.finalidade || undefined,
        resolucao: input.resolucao || undefined,
        visibilidade: input.visibilidade,
        componentes,
      },
    })

    let result = draft
    {
      try {
        result = await apiRequest(`/api/comunidade/builds/${draft.id}`, {
          method: 'PATCH',
          body: {
            status: 'PUBLICADA',
            visibilidade: input.visibilidade,
          },
        })
      } catch (error) {
        const message = error?.message || 'A publicação foi recusada pelo backend.'
        throw new Error(`O rascunho foi criado, mas não pôde ser publicado. ${message}`, { cause: error })
      }
    }

    reportDataSource('comunidade-publicar', 'api')
    return mergeLocalComments(normalizeCommunityBuild(result?.build || result))
  } catch (error) {
    const status = Number(error?.status || 0)
    const canFallback = error instanceof ApiError && [0, 404, 405, 501].includes(status)
    if (dataMode === 'auto' && canFallback) {
      reportDataSource('comunidade-publicar', 'mock', error)
      return localBuildFromInput(input, user)
    }
    reportDataSource('comunidade-publicar', 'api', error)
    throw error
  }
}

export function atualizarBuildComunidade(id, body) {
  return apiWriteFirst({
    key: 'comunidade-atualizar',
    path: `/api/comunidade/builds/${encodeURIComponent(id)}`,
    options: { method: 'PATCH', body },
    fallback: () => null,
    transform: (payload) => mergeLocalComments(normalizeCommunityBuild(payload?.build || payload)),
  })
}


export async function atualizarPublicacaoComunidade(id, input = {}) {
  const body = {
    ...(input.titulo !== undefined ? { titulo: input.titulo } : {}),
    ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
    ...(input.finalidade !== undefined ? { finalidade: input.finalidade } : {}),
    ...(input.resolucao !== undefined ? { resolucao: input.resolucao } : {}),
    ...(input.visibilidade !== undefined ? { visibilidade: input.visibilidade } : {}),
  }

  if (input.build) {
    body.componentes = await prepararComponentesBackend(input.build)
  }

  return atualizarBuildComunidade(id, body)
}

export function removerBuildComunidade(id) {
  return apiWriteFirst({
    key: 'comunidade-remover',
    path: `/api/comunidade/builds/${encodeURIComponent(id)}`,
    options: { method: 'DELETE' },
    fallback: () => ({ id, removida: true }),
  })
}


export function editarComentarioComunidade(commentId, texto, user) {
  return apiWriteFirst({
    key: 'comunidade-comentario-editar',
    path: `/api/comunidade/comentarios/${encodeURIComponent(commentId)}`,
    options: {
      method: 'PATCH',
      body: { texto },
    },
    fallback: () => ({
      id: commentId,
      texto,
      usuario: user ? { id: user.id, nome: user.nome } : undefined,
      criadoEm: new Date().toISOString(),
    }),
    transform: (payload) => normalizeComment(payload?.comentario || payload, user),
  })
}

export function removerComentarioComunidade(commentId) {
  return apiWriteFirst({
    key: 'comunidade-comentario-remover',
    path: `/api/comunidade/comentarios/${encodeURIComponent(commentId)}`,
    options: { method: 'DELETE' },
    fallback: () => ({ id: commentId, removido: true }),
  })
}

export function adicionarComentario(buildId, input, user) {
  const body = { texto: input.texto }
  if (input.comentarioPaiId !== undefined && input.comentarioPaiId !== null) {
    body.comentarioPaiId = Number(input.comentarioPaiId)
  }

  return apiWriteFirst({
    key: 'comunidade-comentarios-escrita',
    path: `/api/comunidade/builds/${encodeURIComponent(buildId)}/comentarios`,
    options: {
      method: 'POST',
      body,
    },
    fallback: () => saveLocalComment(buildId, input, user),
    transform: (payload) => {
      const item = payload?.comentario || payload
      return {
        id: item.id,
        author: item.usuario?.nome || item.autor?.nome || item.author || user?.nome || 'Usuário',
        text: item.texto || item.text || input.texto,
        time: item.criadoEm || item.createdAt || new Date().toISOString(),
        replies: [],
        own: true,
      }
    },
  })
}
