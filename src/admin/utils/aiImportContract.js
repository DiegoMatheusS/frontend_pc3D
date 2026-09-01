const SPEC_KEY_BY_CATEGORY = {
  PROCESSADOR: 'especificacaoProcessador',
  PLACA_VIDEO: 'especificacaoPlacaVideo',
  PLACA_MAE: 'especificacaoPlacaMae',
  MEMORIA_RAM: 'especificacaoMemoriaRam',
  ARMAZENAMENTO: 'especificacaoArmazenamento',
  FONTE: 'especificacaoFonte',
  COOLER: 'especificacaoCooler',
  VENTOINHA: 'especificacaoVentoinha',
  GABINETE: 'especificacaoGabinete',
  NOTEBOOK: 'especificacaoNotebook',
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function safeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function safeValue(value, fallback = '') {
  return value === null || value === undefined ? fallback : value
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function normalizeCategory(value) {
  return String(value ?? '').trim().toUpperCase()
}

function csvValue(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return value.split(/[;,|]/).map((item) => item.trim()).filter(Boolean)
  return value
}

function normalizeTechnicalAliases(category, spec = {}) {
  const next = { ...object(spec) }
  const cat = normalizeCategory(category)

  if (cat === 'PLACA_VIDEO') {
    const gpu = firstDefined(next.gpu, next.gpuNome, next.nomeGpu, next.processadorGrafico, next.graphicsProcessor)
    const chipset = firstDefined(next.chipset, next.tipoChipset, next.gpuChipset, next.chipsetGpu)
    const consumoWatts = firstDefined(
      next.consumoWatts,
      next.tgpWatts,
      next.tgp,
      next.tbpWatts,
      next.tbp,
      next.boardPowerWatts,
      next.boardPower,
      next.totalBoardPowerWatts,
      next.totalBoardPower,
      next.powerConsumptionWatts,
    )
    if (gpu !== undefined) next.gpu = gpu
    // Chipset só é preenchido com dado explícito retornado pela IA/backend.
    if (chipset !== undefined) next.chipset = chipset
    if (consumoWatts !== undefined) next.consumoWatts = consumoWatts
    for (const alias of ['gpuNome','nomeGpu','processadorGrafico','graphicsProcessor','tipoChipset','gpuChipset','chipsetGpu','tgpWatts','tgp','tbpWatts','tbp','boardPowerWatts','boardPower','totalBoardPowerWatts','totalBoardPower','powerConsumptionWatts']) {
      delete next[alias]
    }
  }

  if (cat === 'PROCESSADOR') {
    const aliases = {
      frequenciaBaseMhz: firstDefined(next.frequenciaBaseMhz, next.clockBaseMhz),
      frequenciaTurboMhz: firstDefined(next.frequenciaTurboMhz, next.clockTurboMhz),
      cacheL3Mb: firstDefined(next.cacheL3Mb, next.cacheMb),
      frequenciaMemoriaMaximaMhz: firstDefined(next.frequenciaMemoriaMaximaMhz, next.frequenciaMemoriaMhz),
      capacidadeMemoriaMaximaGb: firstDefined(next.capacidadeMemoriaMaximaGb, next.capacidadeMaximaMemoriaGb),
      versaoPcie: firstDefined(next.versaoPcie, next.pcie, next.geracaoPcie),
      possuiVideoIntegrado: firstDefined(next.possuiVideoIntegrado, next.videoIntegrado, next.graficoIntegrado),
      modeloVideoIntegrado: firstDefined(next.modeloVideoIntegrado, next.modeloGraficoIntegrado),
      suportaEcc: firstDefined(next.suportaEcc, next.ecc),
      suporteOverclock: firstDefined(next.suporteOverclock, next.overclock),
    }
    for (const [key, value] of Object.entries(aliases)) {
      if (value !== undefined) next[key] = value
    }
    const tiposMemoria = firstDefined(next.tiposMemoriaSuportados, next.memoriaSuportada)
    if (tiposMemoria !== undefined) next.tiposMemoriaSuportados = csvValue(tiposMemoria)
    for (const alias of ['clockBaseMhz','clockTurboMhz','cacheMb','memoriaSuportada','frequenciaMemoriaMhz','capacidadeMaximaMemoriaGb','pcie','videoIntegrado','graficoIntegrado','modeloGraficoIntegrado','ecc','overclock']) {
      delete next[alias]
    }
  }

  return next
}

export function getAiCategory(response = {}) {
  const cadastroPayload = object(response?.cadastroSugerido?.payload)
  const partialPayload = object(response?.resultadoProdutoIa?.payloadParcialBackend)
  return normalizeCategory(
    cadastroPayload.categoria
    || partialPayload.categoria
    || response?.categoriaSugerida
    || response?.categoriaDetectada
    || response?.resultadoProdutoIa?.categoriaDetectada,
  )
}

export function getAiPayload(response = {}) {
  const cadastroPayload = object(response?.cadastroSugerido?.payload)
  const partialPayload = object(response?.resultadoProdutoIa?.payloadParcialBackend)
  const actionPayload = object(response?.acaoFrontend?.payloadInicial)
  const confirmationBody = object(response?.confirmacaoSugerida?.body)
  const legacyNormalized = object(response?.normalizacao?.camposNormalizados)
  const foundSpecs = object(response?.resultadoProdutoIa?.especificacoesEncontradas)

  const category = getAiCategory(response)
  const specKey = SPEC_KEY_BY_CATEGORY[category]
  const primaryPayload = Object.keys(cadastroPayload).length ? cadastroPayload
    : Object.keys(partialPayload).length ? partialPayload
      : Object.keys(actionPayload).length ? actionPayload
        : Object.keys(confirmationBody).length ? confirmationBody
          : legacyNormalized

  const partialSpec = specKey ? object(partialPayload?.[specKey]) : {}
  const cadastroSpec = specKey ? object(cadastroPayload?.[specKey]) : {}
  const primarySpec = specKey ? object(primaryPayload?.[specKey]) : {}
  const normalizedSpec = normalizeTechnicalAliases(category, {
    ...foundSpecs,
    ...partialSpec,
    ...cadastroSpec,
    ...primarySpec,
  })

  const merged = {
    ...legacyNormalized,
    ...actionPayload,
    ...confirmationBody,
    ...partialPayload,
    ...cadastroPayload,
  }

  if (category && !merged.categoria) merged.categoria = category
  if (specKey && Object.keys(normalizedSpec).length) merged[specKey] = normalizedSpec

  // Facilita o preenchimento dos formulários atuais sem transformar texto bruto em descrição.
  return {
    ...merged,
    ...normalizedSpec,
    descricao: primaryPayload?.descricao ?? merged?.descricao ?? '',
  }
}

export function getAiOffer(response = {}) {
  const suggested = object(response?.ofertaSugerida)
  const nested = object(response?.resultadoProdutoIa?.ofertaColetada)
  const collected = object(response?.ofertaColetada)
  const offer = { ...suggested, ...nested, ...collected }
  if (!Object.keys(offer).length) return null
  return {
    ...offer,
    // Preço e disponibilidade têm como fonte principal ofertaColetada.
    preco: safeValue(collected.preco ?? nested.preco ?? suggested.preco),
    precoAnterior: safeValue(collected.precoAnterior ?? nested.precoAnterior ?? suggested.precoAnterior),
    disponivel: collected.disponivel ?? nested.disponivel ?? suggested.disponivel ?? true,
    parceiroId: collected.parceiroId ?? nested.parceiroId ?? suggested.parceiroId,
    parceiroNome: collected.parceiroNome ?? nested.parceiroNome ?? suggested.parceiroNome,
    urlOriginal: safeText(collected.urlOriginal)
      || safeText(collected.urlProduto)
      || safeText(nested.urlOriginal)
      || safeText(nested.urlProduto)
      || safeText(suggested.urlOriginal)
      || safeText(suggested.urlProduto),
    // Nunca inventar URL afiliada no frontend; apenas reaproveitar o que o backend enviar.
    urlAfiliada: safeText(collected.urlAfiliada ?? nested.urlAfiliada ?? suggested.urlAfiliada),
  }
}

export function getAiMissingFields(response = {}) {
  const value = response?.cadastroSugerido?.camposObrigatoriosAusentes
    ?? response?.resultadoProdutoIa?.camposObrigatoriosAusentes
    ?? response?.normalizacao?.ausentes
    ?? []
  return Array.isArray(value) ? value.filter(Boolean) : []
}

export function getAiReconciliation(response = {}) {
  return object(response?.reconciliacao)
}

export function getAiConflicts(response = {}) {
  const conflicts = getAiReconciliation(response)?.conflitos
  return Array.isArray(conflicts) ? conflicts : []
}

export function getAiReadiness(response = {}) {
  const ready = response?.cadastroSugerido?.prontoParaCadastrar
  const enabled = response?.confirmacaoSugerida?.habilitada
  return {
    ready: ready !== false,
    enabled: enabled !== false,
    canConfirm: ready === true && enabled !== false,
  }
}

export function getAiDiagnostics(response = {}) {
  const marketplace = object(response?.resultadoProdutoIa?.marketplace)
  const service = object(response?.resultadoProdutoIa?.servicoProdutoIa)
  return {
    marketplace,
    service,
    source: response?.resultadoProdutoIa?.origemColeta || response?.resultadoProdutoIa?.fonte || '',
  }
}

export function normalizeAiResponse(response) {
  if (!response || typeof response !== 'object') return response
  const payload = getAiPayload(response)
  const offer = getAiOffer(response)
  const missing = getAiMissingFields(response)
  const reconciliation = getAiReconciliation(response)
  const category = getAiCategory(response)

  const explicitDestination = String(response?.destinoSugerido || response?.resultadoProdutoIa?.tipoCadastro || '').toUpperCase()
  const route = String(response?.confirmacaoSugerida?.rota || '').toLowerCase()
  let destination = explicitDestination
  if (!['HARDWARE', 'PRODUTO', 'NOTEBOOK', 'PC_MONTADO'].includes(destination)) {
    if (route.includes('/hardwares')) destination = 'HARDWARE'
    else if (route.includes('/notebooks')) destination = 'NOTEBOOK'
    else if (route.includes('/builds') || route.includes('/montados')) destination = 'PC_MONTADO'
    else if (route.includes('/produtos')) destination = 'PRODUTO'
    else if (SPEC_KEY_BY_CATEGORY[category] && category !== 'NOTEBOOK') destination = 'HARDWARE'
    else destination = 'PRODUTO'
  }

  return {
    ...response,
    destinoSugerido: destination,
    categoriaDetectada: response?.categoriaDetectada || response?.resultadoProdutoIa?.categoriaDetectada || category,
    categoriaSugerida: response?.categoriaSugerida || category,
    reconciliacao: reconciliation,
    cadastroSugerido: response?.cadastroSugerido && typeof response.cadastroSugerido === 'object'
      ? { ...response.cadastroSugerido, payload }
      : { payload, camposObrigatoriosAusentes: missing },
    ofertaSugerida: offer,
    iaDisponivel: response?.iaDisponivel !== false && !response?.resultadoProdutoIa?.erro,
    normalizacao: {
      ...(response?.normalizacao || {}),
      camposNormalizados: payload,
      ausentes: missing,
      alertas: Array.isArray(response?.normalizacao?.alertas) ? response.normalizacao.alertas : [],
      textoExplicativo: response?.normalizacao?.textoExplicativo
        || 'Dados estruturados retornados pelo Projeto IA. Revise os campos antes de salvar.',
    },
  }
}
