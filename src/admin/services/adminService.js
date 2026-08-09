import { apiRequest } from '../../services/httpClient'

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
  return data?.item || data?.dados || data?.produto || data?.hardware || data?.oferta || data?.parceiro || data?.usuario || data?.notebook || data?.build || data
}

async function list(path) {
  return unwrapList(await apiRequest(path))
}

async function one(path) {
  return unwrapOne(await apiRequest(path))
}

export const adminService = {
  dashboard: {
    async load() {
      const entries = await Promise.allSettled([
        list('/api/admin/produtos'),
        list('/api/admin/hardwares'),
        list('/api/admin/ofertas'),
        list('/api/admin/ofertas/parceiros'),
        list('/api/admin/notebooks'),
        list('/api/admin/builds'),
        list('/api/usuarios'),
      ])
      const value = (index) => entries[index].status === 'fulfilled' ? entries[index].value : []
      const sourceNames = ['Produtos', 'Hardwares', 'Ofertas', 'Parceiros', 'Notebooks', 'PCs Montados', 'Usuários']
      return {
        produtos: value(0),
        hardwares: value(1),
        ofertas: value(2),
        parceiros: value(3),
        notebooks: value(4),
        builds: value(5),
        usuarios: value(6),
        sources: entries.map((entry, index) => ({
          name: sourceNames[index],
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
    update: (id, body) => oneRequest(`/api/admin/produtos/${id}`, 'PATCH', body),
    remove: (id) => apiRequest(`/api/admin/produtos/${id}`, { method: 'DELETE' }),
    import: (urlOriginal) => oneRequest('/api/admin/produtos/importar', 'POST', { urlOriginal }),
  },

  hardwares: {
    list: () => list('/api/admin/hardwares'),
    get: (id) => one(`/api/admin/hardwares/${id}`),
    create: (body) => oneRequest('/api/hardwares', 'POST', body),
    update: (id, body) => oneRequest(`/api/admin/hardwares/${id}`, 'PATCH', body),
    remove: (id) => apiRequest(`/api/admin/hardwares/${id}`, { method: 'DELETE' }),
    import: (urlOriginal) => oneRequest('/api/admin/hardwares/importar', 'POST', { urlOriginal }),
    models: (hardwareId) => list(`/api/admin/hardwares/${hardwareId}/modelos-3d`),
    createModel: (hardwareId, body) => oneRequest(`/api/admin/hardwares/${hardwareId}/modelos-3d`, 'POST', body),
    updateModel: (modelId, body) => oneRequest(`/api/admin/hardwares/modelos-3d/${modelId}`, 'PATCH', body),
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

  offers: {
    list: () => list('/api/admin/ofertas'),
    get: (id) => one(`/api/admin/ofertas/${id}`),
    create: (body) => oneRequest('/api/admin/ofertas', 'POST', body),
    update: (id, body) => oneRequest(`/api/admin/ofertas/${id}`, 'PATCH', body),
    remove: (id) => apiRequest(`/api/admin/ofertas/${id}`, { method: 'DELETE' }),
    history: (id) => list(`/api/admin/ofertas/${id}/historico`),
    partners: () => list('/api/admin/ofertas/parceiros'),
    partner: (id) => one(`/api/admin/ofertas/parceiros/${id}`),
    createPartner: (body) => oneRequest('/api/admin/ofertas/parceiros', 'POST', body),
    updatePartner: (id, body) => oneRequest(`/api/admin/ofertas/parceiros/${id}`, 'PATCH', body),
  },

  users: {
    list: () => list('/api/usuarios'),
    get: (id) => one(`/api/usuarios/${id}`),
    create: (body) => oneRequest('/api/usuarios', 'POST', body),
    update: (id, body) => oneRequest(`/api/usuarios/${id}`, 'PATCH', body),
    resetPassword: (id, novaSenha) => oneRequest(`/api/usuarios/${id}/senha`, 'PATCH', { novaSenha }),
  },

  notebooks: {
    list: () => list('/api/admin/notebooks'),
    get: (id) => one(`/api/admin/notebooks/${id}`),
    create: (body) => oneRequest('/api/admin/notebooks', 'POST', body),
    update: (id, body) => oneRequest(`/api/admin/notebooks/${id}`, 'PATCH', body),
    remove: (id) => apiRequest(`/api/admin/notebooks/${id}`, { method: 'DELETE' }),
  },

  builds: {
    list: () => list('/api/admin/builds'),
    get: (id) => one(`/api/admin/builds/${id}`),
    create: (body) => oneRequest('/api/admin/builds', 'POST', body),
    update: (id, body) => oneRequest(`/api/admin/builds/${id}`, 'PATCH', body),
    remove: (id) => apiRequest(`/api/admin/builds/${id}`, { method: 'DELETE' }),
  },

  audit: {
    list: () => list('/api/admin/auditoria'),
  },

  ai: {
    chat: (body) => oneRequest('/api/admin/ia/chat', 'POST', body),
    importLink: (url) => oneRequest('/api/admin/ia/importar-link', 'POST', { url }),
    analyzeProduct: (produtoId) => oneRequest('/api/admin/ia/analisar-produto', 'POST', { produtoId: Number(produtoId) }),
    generateProductDescription: (produtoId) => oneRequest('/api/admin/ia/gerar-descricao', 'POST', { produtoId: Number(produtoId) }),
    normalizeProduct: (conteudoBruto, urlOrigem) => oneRequest('/api/admin/ia/normalizar-produto', 'POST', { conteudoBruto, ...(urlOrigem ? { urlOrigem } : {}) }),
  },
}

async function oneRequest(path, method, body) {
  return unwrapOne(await apiRequest(path, { method, body }))
}
