import { apiRequest } from '../../services/httpClient'
import { normalizeAiResponse } from '../utils/aiImportContract'

const META_AI_WHATSAPP_PROXY_PATH = String(
  import.meta.env.VITE_META_AI_WHATSAPP_PROXY_PATH
  || '/api/admin/hardwares/descobrir/meta-ai-whatsapp/enriquecer',
).trim()

const IA_TECNICA_PROXY_PATH = String(
  import.meta.env.VITE_IA_TECNICA_PROXY_PATH
  || '/api/admin/hardwares/descobrir/ia-tecnica/enriquecer',
).trim()

const IA_TECNICA_PROVIDER = 'OPENAI'

function unwrapList(data) {
  if (Array.isArray(data)) return data
  const candidates = [
    data?.itens,
    data?.items,
    data?.dados,
    data?.resultados,
    data?.produtos,
    data?.hardwares,
    data?.ofertas,
    data?.parceiros,
    data?.usuarios,
    data?.notebooks,
    data?.builds,
    data?.modelos,
    data?.logs,
  ]
  return candidates.find(Array.isArray) || []
}

function unwrapOne(data) {
  if (!data || typeof data !== 'object') return data
  if (
    data.status !== undefined
    || data.tokenConfirmacao !== undefined
    || data.cadastroSugerido !== undefined
    || data.resultadoProdutoIa !== undefined
    || data.reconciliacao !== undefined
    || data.confirmacaoSugerida !== undefined
    || data.analise !== undefined
    || data.acoesPrevistas !== undefined
  ) return data
  if (data.id !== undefined && data.id !== null) return data
  return data?.item || data?.dados || data?.produto || data?.hardware || data?.oferta || data?.parceiro || data?.usuario || data?.notebook || data?.build || data
}

async function list(path) {
  return unwrapList(await apiRequest(path))
}

async function one(path) {
  return unwrapOne(await apiRequest(path))
}

function normalizeNotebook(item) {
  if (!item || typeof item !== 'object') return item
  const produto = item.produto && typeof item.produto === 'object' ? item.produto : {}
  return {
    ...item,
    produto,
    produtoId: item.produtoId ?? produto.id,
    nome: produto.nome ?? item.nome ?? '',
    marca: produto.marca ?? item.marca ?? '',
    modelo: produto.modelo ?? item.modelo ?? '',
    descricao: produto.descricao ?? item.descricao ?? '',
    mpn: produto.mpn ?? item.mpn ?? '',
    gtin: produto.gtin ?? item.gtin ?? '',
    imagemUrl: produto.imagemUrl ?? item.imagemUrl ?? '',
    imagemHoverUrl: produto.imagemHoverUrl ?? item.imagemHoverUrl ?? '',
    publicado: item.publicado !== false && produto.publicado !== false,
    ativo: item.ativo !== false && produto.ativo !== false,
    slug: produto.slug ?? item.slug,
  }
}

function normalizeBuild(item) {
  if (!item || typeof item !== 'object') return item
  const produto = item.produto && typeof item.produto === 'object' ? item.produto : {}
  return {
    ...item,
    produto,
    produtoId: item.produtoId ?? produto.id,
    nome: produto.nome ?? item.nome ?? '',
    marca: produto.marca ?? item.marca ?? '',
    modelo: produto.modelo ?? item.modelo ?? '',
    descricao: produto.descricao ?? item.descricao ?? '',
    imagemUrl: produto.imagemUrl ?? item.imagemUrl ?? '',
    imagemHoverUrl: produto.imagemHoverUrl ?? item.imagemHoverUrl ?? '',
    publicado: item.publicado !== false && produto.publicado !== false,
    ativo: item.ativo !== false && produto.ativo !== false,
    slug: produto.slug ?? item.slug,
  }
}

export const adminService = {
  dashboard: {
    async load({ includeUsers = false } = {}) {
      const requests = [
        ['Produtos', list('/api/admin/produtos')],
        ['Hardwares', list('/api/admin/hardwares')],
        ['Ofertas', list('/api/admin/ofertas')],
        ['Parceiros', list('/api/admin/ofertas/parceiros')],
        ['Notebooks', list('/api/admin/notebooks')],
        ['PCs Montados', list('/api/admin/builds')],
      ]
      if (includeUsers) requests.push(['Usuários', list('/api/usuarios')])

      const entries = await Promise.allSettled(requests.map(([, promise]) => promise))
      const value = (index) => entries[index]?.status === 'fulfilled' ? entries[index].value : []
      return {
        produtos: value(0),
        hardwares: value(1),
        ofertas: value(2),
        parceiros: value(3),
        notebooks: value(4).map(normalizeNotebook),
        builds: value(5).map(normalizeBuild),
        usuarios: includeUsers ? value(6) : [],
        sources: entries.map((entry, index) => ({
          name: requests[index][0],
          ok: entry.status === 'fulfilled',
          message: entry.status === 'rejected' ? String(entry.reason?.message || entry.reason || 'Indisponível') : '',
        })),
      }
    },
  },

  products: {
    list: () => list('/api/admin/produtos'),
    categories: () => list('/api/admin/categorias-produto'),
    get: (id) => one(`/api/admin/produtos/${id}`),
    create: (body) => oneRequest('/api/admin/produtos', 'POST', body),
    createFromHardware: (hardwareId, body) => oneRequest(`/api/admin/produtos/de-hardware/${hardwareId}`, 'POST', body),
    availableHardwares: (search = '') => {
      const query = String(search || '').trim()
      return list(`/api/admin/produtos/hardwares/disponiveis${query ? `?busca=${encodeURIComponent(query)}` : ''}`)
    },
    update: (id, body) => oneRequest(`/api/admin/produtos/${id}`, 'PATCH', body),
    remove: (id) => apiRequest(`/api/admin/produtos/${id}`, { method: 'DELETE' }),
    import: (urlOriginal) => oneRequest('/api/admin/produtos/importar', 'POST', { urlOriginal }),
    findAndRegisterIdenticalOffers: (id) => oneRequest(`/api/admin/busca-ofertas/produto/${id}/encontrar-e-cadastrar`, 'POST'),
  },

  hardwares: {
    list: () => list('/api/admin/hardwares'),
    listForBuild: async () => {
      try {
        const adminItems = await list('/api/admin/hardwares')
        if (adminItems.length) return adminItems
      } catch { /* fallback público abaixo */ }
      return list('/api/hardwares')
    },
    get: (id) => one(`/api/admin/hardwares/${id}`),
    create: (body) => oneRequest('/api/hardwares', 'POST', body),
    update: (id, body) => oneRequest(`/api/admin/hardwares/${id}`, 'PATCH', body),
    remove: (id) => apiRequest(`/api/admin/hardwares/${id}`, { method: 'DELETE' }),
    import: (urlOriginal) => oneRequest('/api/admin/hardwares/importar', 'POST', { urlOriginal }),
    discover: (body) => oneRequest('/api/admin/hardwares/descobrir', 'POST', body),
    createDiscovered: (body) => oneRequest('/api/admin/hardwares/descobrir/cadastrar', 'POST', body),
    createDiscoveredBatch: (itens) => oneRequest('/api/admin/hardwares/descobrir/cadastrar-lote', 'POST', { itens }),
    enrichDiscoveredWithMetaAi: (body) => oneRequestWithTimeout(META_AI_WHATSAPP_PROXY_PATH, 'POST', body, { timeoutMs: 150000 }),
    enrichDiscoveredWithAi: (body) => oneRequestWithTimeout(
      IA_TECNICA_PROXY_PATH,
      'POST',
      { ...(body || {}), provedor: IA_TECNICA_PROVIDER },
      { timeoutMs: 150000 },
    ),
    models: (hardwareId) => list(`/api/admin/hardwares/${hardwareId}/modelos-3d`),
    createModel: (hardwareId, body) => oneRequest(`/api/admin/hardwares/${hardwareId}/modelos-3d`, 'POST', body),
    setHomeModel: (modelId, mostrarNoHome) => oneRequest(`/api/admin/hardwares/modelos-3d/${modelId}/mostrar-no-home`, 'PATCH', { mostrarNoHome }),
    updateModel: (modelId, body) => oneRequest(`/api/admin/hardwares/modelos-3d/${modelId}`, 'PATCH', body),
    removeModel: (modelId) => apiRequest(`/api/admin/hardwares/modelos-3d/${modelId}`, { method: 'DELETE' }),
    approveModel: (modelId) => oneRequest(`/api/admin/hardwares/modelos-3d/${modelId}/aprovar`, 'PATCH'),
    setModelStatus: (modelId, ativo) => oneRequest(`/api/admin/hardwares/modelos-3d/${modelId}/status`, 'PATCH', { ativo }),
    cpuMotherboardCompatibilities: () => list('/api/admin/hardwares/compatibilidades/cpu-placa-mae'),
    ramMotherboardCompatibilities: () => list('/api/admin/hardwares/compatibilidades/memoria-placa-mae'),
    createCpuMotherboardCompatibility: (body) => oneRequest('/api/admin/hardwares/compatibilidades/cpu-placa-mae', 'POST', body),
    createRamMotherboardCompatibility: (body) => oneRequest('/api/admin/hardwares/compatibilidades/memoria-placa-mae', 'POST', body),
    mountPoints: (hardwarePaiId) => apiRequest(`/api/admin/hardwares/${hardwarePaiId}/pontos-encaixe`),
    createMountPoint: (hardwarePaiId, body) => oneRequest(`/api/admin/hardwares/${hardwarePaiId}/pontos-encaixe`, 'POST', body),
    updateMountPoint: (pontoEncaixeId, body) => oneRequest(`/api/admin/hardwares/pontos-encaixe/${pontoEncaixeId}`, 'PATCH', body),
    createMountAdjustment: (pontoEncaixeId, body) => oneRequest(`/api/admin/hardwares/pontos-encaixe/${pontoEncaixeId}/ajustes`, 'POST', body),
    updateMountAdjustment: (ajusteId, body) => oneRequest(`/api/admin/hardwares/ajustes-encaixe/${ajusteId}`, 'PATCH', body),
  },

  offerSuggestions: {
    fields: () => apiRequest('/api/ofertas/sugestoes/campos'),
    list: ({ status = '', category = '', search = '' } = {}) => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (category) params.set('categoria', category)
      if (search) params.set('busca', search)
      const query = params.toString()
      return apiRequest(`/api/admin/ofertas/sugestoes${query ? `?${query}` : ''}`)
    },
    get: (id) => apiRequest(`/api/admin/ofertas/sugestoes/${id}`),
    approve: (id, body) => apiRequest(`/api/admin/ofertas/sugestoes/${id}/aprovar`, { method: 'PATCH', body }),
    acceptExisting: (id, body) => apiRequest(`/api/admin/ofertas/sugestoes/${id}/aceitar-existente`, { method: 'PATCH', body }),
    reject: (id, motivo) => apiRequest(`/api/admin/ofertas/sugestoes/${id}/rejeitar`, { method: 'PATCH', body: { motivo } }),
  },

  offers: {
    list: () => list('/api/admin/ofertas'),
    get: (id) => one(`/api/admin/ofertas/${id}`),
    create: (body) => oneRequest('/api/admin/ofertas', 'POST', body),
    update: (id, body) => oneRequest(`/api/admin/ofertas/${id}`, 'PATCH', body),
    remove: (id) => apiRequest(`/api/admin/ofertas/${id}`, { method: 'DELETE' }),
    setStatus: (id, status) => oneRequest(`/api/admin/ofertas/${id}`, 'PATCH', { status }),
    history: (id) => list(`/api/admin/ofertas/${id}/historico`),
    partners: () => list('/api/admin/ofertas/parceiros'),
    partner: (id) => one(`/api/admin/ofertas/parceiros/${id}`),
    createPartner: (body) => oneRequest('/api/admin/ofertas/parceiros', 'POST', body),
    updatePartner: (id, body) => oneRequest(`/api/admin/ofertas/parceiros/${id}`, 'PATCH', body),
    removePartner: (id) => apiRequest(`/api/admin/ofertas/parceiros/${id}`, { method: 'DELETE' }),
    priceCheckStatus: () => apiRequest('/api/admin/ofertas/verificacao-precos/status'),
    verifyPrices: (limite = 50, excluirIds = []) => apiRequest('/api/admin/ofertas/verificar-precos', {
      method: 'POST',
      body: { limite: Number(limite) || 50, ...(excluirIds.length ? { excluirIds } : {}) },
    }),
    verifyPrice: (id) => apiRequest(`/api/admin/ofertas/${id}/verificar-preco`, { method: 'POST' }),
  },

  users: {
    list: () => list('/api/usuarios'),
    get: (id) => one(`/api/usuarios/${id}`),
    create: (body) => oneRequest('/api/usuarios', 'POST', body),
    update: (id, body) => oneRequest(`/api/usuarios/${id}`, 'PATCH', body),
    resetPassword: (id, novaSenha) => oneRequest(`/api/usuarios/${id}/senha`, 'PATCH', { novaSenha }),
  },

  notebooks: {
    list: async () => (await list('/api/admin/notebooks')).map(normalizeNotebook),
    get: async (id) => normalizeNotebook(await one(`/api/admin/notebooks/${id}`)),
    create: async (body) => normalizeNotebook(await oneRequest('/api/admin/notebooks', 'POST', body)),
    update: async (id, body) => normalizeNotebook(await oneRequest(`/api/admin/notebooks/${id}`, 'PATCH', body)),
    remove: (id) => apiRequest(`/api/admin/notebooks/${id}`, { method: 'DELETE' }),
  },

  builds: {
    list: async () => (await list('/api/admin/builds')).map(normalizeBuild),
    get: async (id) => normalizeBuild(await one(`/api/admin/builds/${id}`)),
    create: async (body) => normalizeBuild(await oneRequest('/api/admin/builds', 'POST', body)),
    update: async (id, body) => normalizeBuild(await oneRequest(`/api/admin/builds/${id}`, 'PATCH', body)),
    remove: (id) => apiRequest(`/api/admin/builds/${id}`, { method: 'DELETE' }),
  },

  reviews: {
    list: () => list('/api/admin/avaliacoes'),
    update: (id, body) => oneRequest(`/api/admin/avaliacoes/${id}`, 'PATCH', body),
    remove: (id) => apiRequest(`/api/admin/avaliacoes/${id}`, { method: 'DELETE' }),
  },

  audit: {
    list: ({ acao = '', entidade = '', entidadeId = '', usuarioId = '', pagina = 1, porPagina = 200 } = {}) => {
      const params = new URLSearchParams()
      if (acao) params.set('acao', acao)
      if (entidade) params.set('entidade', entidade)
      if (entidadeId) params.set('entidadeId', entidadeId)
      if (usuarioId) params.set('usuarioId', String(usuarioId))
      if (pagina) params.set('pagina', String(pagina))
      if (porPagina) params.set('porPagina', String(porPagina))
      const query = params.toString()
      return list(`/api/admin/auditoria${query ? `?${query}` : ''}`)
    },
  },

  chatbot: {
    analyzeRegistration: (body) => oneRequestWithNetworkRetry('/api/admin/chatbot/analisar-cadastro', 'POST', body),
    confirmRegistration: (body) => oneRequest('/api/admin/chatbot/confirmar-cadastro', 'POST', body),
    cancelRegistration: (body) => oneRequest('/api/admin/chatbot/cancelar-cadastro', 'POST', body),
  },

  ai: {
    chat: (body) => oneRequest('/api/admin/ia/chat', 'POST', body),
    importLink: async (url, categoriaEsperada, options = {}) => normalizeAiResponse(await oneRequestWithTimeout(
      '/api/admin/ia/importar-link',
      'POST',
      { url, ...(categoriaEsperada ? { categoria: categoriaEsperada } : {}) },
      { ...options, timeoutMs: options.timeoutMs ?? 90000 },
    )),
    analyzeProduct: (produtoId) => oneRequest('/api/admin/ia/analisar-produto', 'POST', { produtoId: Number(produtoId) }),
    generateProductDescription: (produtoId) => oneRequest('/api/admin/ia/gerar-descricao', 'POST', { produtoId: Number(produtoId) }),
    normalizeProduct: (conteudoBruto, urlOrigem) => oneRequest('/api/admin/ia/normalizar-produto', 'POST', { conteudoBruto, ...(urlOrigem ? { urlOrigem } : {}) }),
  },
}

async function oneRequest(path, method, body, options = {}) {
  return unwrapOne(await apiRequest(path, { ...options, method, body }))
}

async function oneRequestWithNetworkRetry(path, method, body, { retries = 1, delayMs = 800 } = {}) {
  try {
    return await oneRequest(path, method, body)
  } catch (error) {
    const networkFailure = Number(error?.status || 0) === 0
      && !['REQUEST_ABORTED', 'IA_TIMEOUT'].includes(String(error?.code || ''))

    if (!networkFailure || retries <= 0) throw error

    await new Promise((resolve) => window.setTimeout(resolve, delayMs))
    return oneRequestWithNetworkRetry(path, method, body, {
      retries: retries - 1,
      delayMs: Math.min(delayMs * 2, 2000),
    })
  }
}

async function oneRequestWithTimeout(path, method, body, { signal, timeoutMs = 90000 } = {}) {
  const controller = new AbortController()
  let timedOut = false

  const abortFromExternal = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) abortFromExternal()
    else signal.addEventListener('abort', abortFromExternal, { once: true })
  }

  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    return await oneRequest(path, method, body, { signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted) {
      const wrapped = new Error(timedOut
        ? `A análise demorou mais de ${Math.round(timeoutMs / 1000)} segundos. Tente novamente.`
        : 'Análise cancelada.')
      wrapped.code = timedOut ? 'IA_TIMEOUT' : 'REQUEST_ABORTED'
      throw wrapped
    }
    throw error
  } finally {
    window.clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', abortFromExternal)
  }
}
