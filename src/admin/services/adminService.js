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
  // Respostas especializadas (Notebook/Build) possuem `produto` como relação.
  // Se o objeto já tem id próprio, ele é a entidade e não deve ser reduzido a data.produto.
  if (data.id !== undefined && data.id !== null) return data
  return data?.item || data?.dados || data?.produto || data?.hardware || data?.oferta || data?.parceiro || data?.usuario || data?.notebook || data?.build || data
}


function inferAiDestination(data = {}, payload = {}) {
  const explicit = String(data?.destinoSugerido || data?.resultadoProdutoIa?.tipoCadastro || '').toUpperCase()
  if (['HARDWARE', 'PRODUTO', 'NOTEBOOK', 'PC_MONTADO'].includes(explicit)) return explicit
  if (explicit === 'BUILD' || explicit === 'PC_MONTADO_HARDWARE') return 'PC_MONTADO'

  const route = String(data?.confirmacaoSugerida?.rota || '').toLowerCase()
  if (route.includes('/hardwares')) return 'HARDWARE'
  if (route.includes('/notebooks')) return 'NOTEBOOK'
  if (route.includes('/builds') || route.includes('/montados')) return 'PC_MONTADO'
  if (route.includes('/produtos')) return 'PRODUTO'

  const hardwareSpecKeys = [
    'especificacaoProcessador', 'especificacaoCooler', 'especificacaoPlacaMae', 'especificacaoMemoriaRam',
    'especificacaoPlacaVideo', 'especificacaoArmazenamento', 'especificacaoFonte', 'especificacaoGabinete',
    'especificacaoVentoinha',
  ]
  if (hardwareSpecKeys.some((key) => payload?.[key] && typeof payload[key] === 'object')) return 'HARDWARE'
  return 'PRODUTO'
}

function firstAiValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function nestedHardwareSpecs(payload = {}) {
  const keys = [
    'especificacaoProcessador', 'especificacaoCooler', 'especificacaoPlacaMae', 'especificacaoMemoriaRam',
    'especificacaoPlacaVideo', 'especificacaoArmazenamento', 'especificacaoFonte', 'especificacaoGabinete',
    'especificacaoVentoinha',
  ]
  return keys.reduce((result, key) => {
    const value = payload?.[key]
    return value && typeof value === 'object' && !Array.isArray(value) ? { ...result, ...value } : result
  }, {})
}

function inferGpuChipsetFromText(...values) {
  const text = values.map((value) => String(value ?? '').trim()).filter(Boolean).join(' ')
  if (!text) return undefined

  const patterns = [
    /\b(?:AMD\s+Radeon\s+|Radeon\s+)?(RX\s+\d{3,4}(?:\s+(?:XTX|XT|GRE))?)\b/i,
    /\b(?:NVIDIA\s+GeForce\s+|GeForce\s+)?(RTX\s+\d{3,4}(?:\s+(?:Ti\s+SUPER|SUPER|Ti))?)\b/i,
    /\b(?:NVIDIA\s+GeForce\s+|GeForce\s+)?(GTX\s+\d{3,4}(?:\s+(?:SUPER|Ti))?)\b/i,
    /\b(?:Intel\s+)?(Arc\s+[AB]\d{3,4})\b/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].replace(/\s+/g, ' ').trim().toUpperCase().replace('TI', 'Ti')
  }
  return undefined
}

function normalizeAiTechnicalAliases(fields = {}, categoria = '') {
  const next = { ...fields }
  const category = String(categoria || next.categoria || '').toUpperCase()

  if (category === 'PLACA_VIDEO') {
    const gpu = firstAiValue(
      next.gpu, next.gpuNome, next.nomeGpu, next.processadorGrafico, next.graphicsProcessor,
    )
    const chipsetExplicit = firstAiValue(
      next.chipset, next.tipoChipset, next.gpuChipset, next.chipsetGpu,
    )
    const chipset = chipsetExplicit ?? inferGpuChipsetFromText(next.modelo, next.nome, gpu)
    const consumo = firstAiValue(
      next.consumoWatts, next.tgpWatts, next.tgp, next.tbpWatts, next.tbp,
      next.boardPowerWatts, next.boardPower, next.totalBoardPowerWatts,
      next.totalBoardPower, next.powerConsumptionWatts,
    )

    if (gpu !== undefined) next.gpu = gpu
    if (chipset !== undefined) next.chipset = chipset
    if (consumo !== undefined) next.consumoWatts = consumo
  }

  return next
}

function compactAiDescription(fields = {}, categoria = '') {
  const category = String(categoria || fields?.categoria || '').toUpperCase()
  const raw = String(fields?.descricao ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:compre\s+j[aá]|comprar\s+agora|aproveite\s+agora|garanta\s+j[aá])\b[^.!?]*[.!?]?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (category === 'PLACA_VIDEO') {
    const marca = String(fields?.marca ?? '').trim()
    const modelo = String(fields?.modelo ?? '').trim()
    const chipset = String(fields?.chipset ?? '').trim()
    const memoria = Number(fields?.memoriaVideoGb)
    const tipoMemoria = String(fields?.tipoMemoriaVideo ?? '').trim()
    const arquitetura = String(fields?.arquitetura ?? '').trim()
    const barramento = Number(fields?.barramentoBits)
    const pcie = Number(fields?.geracaoPcie)
    const hdmi = Number(fields?.hdmi)
    const displayPort = Number(fields?.displayPort)

    const identidade = [marca, modelo].filter(Boolean).join(' ').trim() || chipset || 'selecionada'
    const detalhes = []
    if (Number.isFinite(memoria) && memoria > 0) detalhes.push(`${memoria} GB${tipoMemoria ? ` ${tipoMemoria}` : ''}`)
    else if (tipoMemoria) detalhes.push(tipoMemoria)
    if (arquitetura) detalhes.push(`arquitetura ${arquitetura}`)
    if (Number.isFinite(barramento) && barramento > 0) detalhes.push(`barramento de ${barramento} bits`)
    if (Number.isFinite(pcie) && pcie > 0) detalhes.push(`interface PCIe ${pcie}.0`)

    const first = `Placa de vídeo ${identidade}${detalhes.length ? ` com ${detalhes.join(', ')}` : ''}.`
    const conexoes = []
    if (Number.isFinite(hdmi) && hdmi > 0) conexoes.push(`${hdmi}x HDMI`)
    if (Number.isFinite(displayPort) && displayPort > 0) conexoes.push(`${displayPort}x DisplayPort`)
    const secondParts = []
    if (chipset && !modelo.toUpperCase().includes(chipset.toUpperCase())) secondParts.push(`chipset ${chipset}`)
    if (conexoes.length) secondParts.push(`saídas ${conexoes.join(' e ')}`)
    const second = secondParts.length ? `Conta com ${secondParts.join(' e ')}.` : ''
    return `${first}${second ? ` ${second}` : ''}`.trim()
  }

  if (!raw) return ''
  const sentences = raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [raw]
  let short = sentences.slice(0, 3).join(' ').replace(/\s+/g, ' ').trim()
  if (short.length > 520) short = `${short.slice(0, 517).replace(/[,;:\s]+$/g, '')}...`
  return short
}

function normalizeAiImportResult(data) {
  if (!data || typeof data !== 'object') return data

  const payload = data?.cadastroSugerido?.payload
    || data?.resultadoProdutoIa?.payloadParcialBackend
    || data?.confirmacaoSugerida?.body
    || data?.acaoFrontend?.payloadInicial
    || data?.normalizacao?.camposNormalizados
    || {}

  const foundSpecs = data?.resultadoProdutoIa?.especificacoesEncontradas
  const existingNormalized = data?.normalizacao?.camposNormalizados

  const categoriaDetectada = data?.categoriaDetectada
    || data?.categoriaSugerida
    || data?.resultadoProdutoIa?.categoriaDetectada
    || payload?.categoria
    || null

  const camposNormalizadosBase = normalizeAiTechnicalAliases({
    ...(foundSpecs && typeof foundSpecs === 'object' ? foundSpecs : {}),
    ...nestedHardwareSpecs(payload),
    ...(existingNormalized && typeof existingNormalized === 'object' ? existingNormalized : {}),
    ...(payload && typeof payload === 'object' ? payload : {}),
  }, categoriaDetectada)
  const descricaoCompacta = compactAiDescription(camposNormalizadosBase, categoriaDetectada)
  const camposNormalizados = {
    ...camposNormalizadosBase,
    ...(descricaoCompacta ? { descricao: descricaoCompacta } : {}),
  }
  const payloadNormalizado = payload && typeof payload === 'object'
    ? { ...payload, ...camposNormalizados, ...(descricaoCompacta ? { descricao: descricaoCompacta } : {}) }
    : payload

  const oferta = data?.ofertaSugerida
    || data?.ofertaColetada
    || data?.resultadoProdutoIa?.ofertaColetada
    || null

  const ausentes = data?.normalizacao?.ausentes
    || data?.cadastroSugerido?.camposObrigatoriosAusentes
    || data?.resultadoProdutoIa?.camposObrigatoriosAusentes
    || []

  const destinoSugerido = inferAiDestination(data, payload)

  return {
    ...data,
    ...(data?.cadastroSugerido && typeof data.cadastroSugerido === 'object' ? {
      cadastroSugerido: { ...data.cadastroSugerido, payload: payloadNormalizado },
    } : {}),
    ...(data?.resultadoProdutoIa && typeof data.resultadoProdutoIa === 'object' ? {
      resultadoProdutoIa: {
        ...data.resultadoProdutoIa,
        ...(data.resultadoProdutoIa.payloadParcialBackend && typeof data.resultadoProdutoIa.payloadParcialBackend === 'object'
          ? { payloadParcialBackend: { ...data.resultadoProdutoIa.payloadParcialBackend, ...camposNormalizados } }
          : {}),
      },
    } : {}),
    ...(data?.confirmacaoSugerida && typeof data.confirmacaoSugerida === 'object' ? {
      confirmacaoSugerida: {
        ...data.confirmacaoSugerida,
        ...(data.confirmacaoSugerida.body && typeof data.confirmacaoSugerida.body === 'object'
          ? { body: { ...data.confirmacaoSugerida.body, ...camposNormalizados } }
          : {}),
      },
    } : {}),
    destinoSugerido,
    categoriaDetectada,
    categoriaSugerida: data?.categoriaSugerida || categoriaDetectada,
    iaDisponivel: data?.iaDisponivel !== false && !data?.resultadoProdutoIa?.erro,
    normalizacao: {
      ...(data?.normalizacao || {}),
      camposNormalizados,
      ausentes: Array.isArray(ausentes) ? ausentes : [],
      alertas: Array.isArray(data?.normalizacao?.alertas) ? data.normalizacao.alertas : [],
      textoExplicativo: data?.normalizacao?.textoExplicativo
        || 'Dados estruturados retornados pelo Produto IA. Revise os campos antes de salvar.',
    },
    ofertaSugerida: oferta ? {
      ...oferta,
      urlOriginal: oferta.urlOriginal || oferta.urlProduto || data?.urlOrigem || '',
    } : null,
  }
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
    models: (hardwareId) => list(`/api/admin/hardwares/${hardwareId}/modelos-3d`),
    createModel: (hardwareId, body) => oneRequest(`/api/admin/hardwares/${hardwareId}/modelos-3d`, 'POST', body),
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
    verifyPrices: (limite = 50) => apiRequest('/api/admin/ofertas/verificar-precos', {
      method: 'POST',
      body: { limite: Number(limite) || 50 },
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

  ai: {
    chat: (body) => oneRequest('/api/admin/ia/chat', 'POST', body),
    importLink: async (url, categoriaEsperada) => normalizeAiImportResult(await oneRequest('/api/admin/ia/importar-link', 'POST', { url, ...(categoriaEsperada ? { categoriaEsperada } : {}) })),
    analyzeProduct: (produtoId) => oneRequest('/api/admin/ia/analisar-produto', 'POST', { produtoId: Number(produtoId) }),
    generateProductDescription: (produtoId) => oneRequest('/api/admin/ia/gerar-descricao', 'POST', { produtoId: Number(produtoId) }),
    normalizeProduct: (conteudoBruto, urlOrigem) => oneRequest('/api/admin/ia/normalizar-produto', 'POST', { conteudoBruto, ...(urlOrigem ? { urlOrigem } : {}) }),
  },
}

async function oneRequest(path, method, body) {
  return unwrapOne(await apiRequest(path, { method, body }))
}
