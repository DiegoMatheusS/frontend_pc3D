import { configurationFromComponents, inferMountedPcConfiguration } from '../utils/builderConfiguration'

const CATEGORY_META = {
  PROCESSADOR: ['hardwares', 'Processador', 'processador'],
  COOLER: ['hardwares', 'Cooler', 'cooler'],
  PLACA_MAE: ['hardwares', 'Placa-mãe', 'placa-mae'],
  MEMORIA_RAM: ['hardwares', 'Memória RAM', 'memoria'],
  PLACA_VIDEO: ['hardwares', 'Placa de vídeo', 'placa-video'],
  ARMAZENAMENTO: ['hardwares', 'Armazenamento', 'armazenamento'],
  FONTE: ['hardwares', 'Fonte', 'fonte'],
  GABINETE: ['hardwares', 'Gabinete', 'gabinete'],
  VENTOINHA: ['hardwares', 'Ventoinha', 'ventoinha'],
  MONITOR: ['monitores', 'Monitor', 'monitor'],
  MOUSE: ['perifericos', 'Mouse', 'mouse'],
  TECLADO: ['perifericos', 'Teclado', 'teclado'],
  FONE: ['perifericos', 'Fone', 'fone'],
  HEADSET: ['perifericos', 'Headset', 'headset'],
  MICROFONE: ['perifericos', 'Microfone', 'microfone'],
  WEBCAM: ['perifericos', 'Webcam', 'webcam'],
  CONTROLE: ['perifericos', 'Controle', 'controle'],
  CADEIRA: ['setup', 'Cadeira', 'cadeira'],
  MESA: ['setup', 'Mesa', 'mesa'],
  MOUSEPAD: ['setup', 'Mousepad', 'mousepad'],
  ILUMINACAO: ['setup', 'Iluminação', 'iluminacao'],
  SUPORTE_MONITOR: ['setup', 'Suporte para monitor', 'suporte-monitor'],
  NOTEBOOK: ['notebooks', 'Notebook', 'notebook'],
}

const CATEGORY_ALIASES = {
  PROCESSADORES: 'PROCESSADOR',
  PROCESSADOR: 'PROCESSADOR',
  COOLERS: 'COOLER',
  COOLER: 'COOLER',
  PLACAS_MAE: 'PLACA_MAE',
  PLACAS_MAE_: 'PLACA_MAE',
  PLACA_MAE: 'PLACA_MAE',
  MEMORIAS_RAM: 'MEMORIA_RAM',
  MEMORIAS: 'MEMORIA_RAM',
  MEMORIA_RAM: 'MEMORIA_RAM',
  PLACAS_VIDEO: 'PLACA_VIDEO',
  PLACAS_DE_VIDEO: 'PLACA_VIDEO',
  PLACA_VIDEO: 'PLACA_VIDEO',
  ARMAZENAMENTOS: 'ARMAZENAMENTO',
  ARMAZENAMENTO: 'ARMAZENAMENTO',
  FONTES: 'FONTE',
  FONTE: 'FONTE',
  GABINETES: 'GABINETE',
  GABINETE: 'GABINETE',
  VENTOINHAS: 'VENTOINHA',
  VENTOINHA: 'VENTOINHA',
  MONITORES: 'MONITOR',
  MONITOR: 'MONITOR',
  MOUSES: 'MOUSE',
  MOUSE: 'MOUSE',
  TECLADOS: 'TECLADO',
  TECLADO: 'TECLADO',
  HEADSETS: 'HEADSET',
  HEADSET: 'HEADSET',
  FONES: 'FONE',
  FONE: 'FONE',
  MICROFONES: 'MICROFONE',
  MICROFONE: 'MICROFONE',
  WEBCAMS: 'WEBCAM',
  WEBCAM: 'WEBCAM',
  CONTROLES: 'CONTROLE',
  CONTROLE: 'CONTROLE',
  CADEIRAS: 'CADEIRA',
  CADEIRA: 'CADEIRA',
  MESAS: 'MESA',
  MESA: 'MESA',
  MOUSEPADS: 'MOUSEPAD',
  MOUSEPAD: 'MOUSEPAD',
  ILUMINACAO: 'ILUMINACAO',
  SUPORTES_MONITOR: 'SUPORTE_MONITOR',
  SUPORTE_MONITOR: 'SUPORTE_MONITOR',
  BRACOS_MONITOR: 'SUPORTE_MONITOR',
  NOTEBOOKS: 'NOTEBOOK',
  NOTEBOOK: 'NOTEBOOK',
}

const PRODUCT_GROUPS = {
  COMPONENTES: 'hardwares',
  PERIFERICOS: 'perifericos',
  SETUP: 'setup',
  ACESSORIOS: 'setup',
  COMPUTADORES: 'computadores',
}


function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value, fallback = '—') {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') return value.trim() || fallback
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    const candidate = value.nome ?? value.name ?? value.label ?? value.titulo ?? value.title ?? value.codigo ?? value.slug
    return candidate === undefined || candidate === null ? fallback : text(candidate, fallback)
  }
  return fallback
}

function normalizeCategoryToken(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function categoryCode(value) {
  const candidates = typeof value === 'object' && value
    ? [value.codigo, value.code, value.nome, value.name, value.slug]
    : [value]

  for (const candidate of candidates) {
    const normalized = normalizeCategoryToken(candidate)
    if (!normalized) continue
    if (CATEGORY_META[normalized]) return normalized
    if (CATEGORY_ALIASES[normalized]) return CATEGORY_ALIASES[normalized]
  }
  return normalizeCategoryToken(candidates.find(Boolean) || '')
}

function yesNo(value) {
  if (typeof value === 'string') return value
  if (value == null) return '—'
  return value ? 'Sim' : 'Não'
}

function normalizeOffers(rawOffers = []) {
  if (!Array.isArray(rawOffers)) return []
  return rawOffers
    .filter((item) => item && item.ativo !== false)
    .map((item) => ({
      id: item.id,
      store: item.parceiro?.nome || item.loja?.nome || item.loja || item.parceiroNome || 'Loja parceira',
      seller: item.vendedorNome || null,
      price: number(item.precoAtual ?? item.preco ?? item.valor),
      previousPrice: number(item.precoAnterior, 0) || null,
      url: item.urlAfiliada || item.urlAfiliado || item.linkAfiliado || item.urlOriginal || item.url || '#',
    }))
    .filter((item) => item.price >= 0)
    .sort((a, b) => a.price - b.price)
}

function cpuSpecs(item) {
  const spec = item.especificacaoProcessador || item.especificacoes?.processador || item.especificacoes || {}
  const memory = spec.tiposMemoriaSuportados || spec.tiposMemoria || spec.memoriaSuportada
  return {
    socket: spec.socket || spec.soquete,
    generation: spec.geracao || spec.generation,
    architecture: spec.arquitetura || spec.architecture,
    cores: number(spec.nucleos ?? spec.cores, null),
    threads: number(spec.threads, null),
    baseClockGhz: spec.clockBaseGhz ?? (spec.clockBaseMhz ? number(spec.clockBaseMhz) / 1000 : undefined),
    boostClockGhz: spec.clockTurboGhz ?? (spec.clockTurboMhz ? number(spec.clockTurboMhz) / 1000 : undefined),
    cacheL3Mb: spec.cacheL3Mb ?? spec.cacheL3,
    tdpWatts: spec.tdpWatts ?? spec.tdp,
    integratedGraphics: yesNo(spec.videoIntegrado ?? spec.integratedGraphics),
    memory: Array.isArray(memory) ? memory.join(', ') : memory,
    pcie: spec.pcie || spec.versaoPcie,
  }
}

function genericSpecs(item) {
  const candidates = [
    item.especificacoes,
    item.especificacaoMemoria,
    item.especificacaoPlacaMae,
    item.especificacaoGabinete,
    item.especificacaoPlacaVideo,
    item.especificacaoArmazenamento,
    item.especificacaoFonte,
    item.especificacaoMonitor,
    item.especificacaoMouse,
    item.especificacaoTeclado,
  ].filter(Boolean)
  return Object.assign({}, ...candidates)
}

function specValue(raw, ...keys) {
  for (const key of keys) {
    const value = raw?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function arrayText(value) {
  if (Array.isArray(value)) return value.join(', ')
  return value
}

function normalizeSpecs(item, category) {
  if (category === 'PROCESSADOR') return Object.fromEntries(Object.entries(cpuSpecs(item)).filter(([, value]) => value !== undefined && value !== null && value !== ''))

  const raw = genericSpecs(item)
  let normalized = raw

  if (category === 'PLACA_VIDEO') {
    normalized = {
      ...raw,
      vramGb: specValue(raw, 'vramGb', 'memoriaVideoGb'),
      memoryType: specValue(raw, 'memoryType', 'tipoMemoria', 'tipoMemoriaVideo'),
      memoryBusBits: specValue(raw, 'memoryBusBits', 'barramentoBits'),
      boostClockMhz: specValue(raw, 'boostClockMhz', 'clockBoostMhz'),
      tgpWatts: specValue(raw, 'tgpWatts', 'consumoWatts'),
      recommendedPsuWatts: specValue(raw, 'recommendedPsuWatts', 'fonteRecomendadaWatts', 'potenciaFonteRecomendadaWatts'),
      lengthMm: specValue(raw, 'lengthMm', 'comprimentoMm'),
      slots: specValue(raw, 'slots', 'slotsOcupados'),
      pcie: specValue(raw, 'pcie', 'versaoPcie', 'geracaoPcie'),
    }
  } else if (category === 'PLACA_MAE') {
    normalized = {
      ...raw,
      socket: specValue(raw, 'socket'),
      chipset: specValue(raw, 'chipset'),
      formFactor: specValue(raw, 'formFactor', 'formato'),
      memory: arrayText(specValue(raw, 'memory', 'tipoMemoria', 'tiposMemoriaSuportados')),
      ramSlots: specValue(raw, 'ramSlots', 'slotsMemoria'),
      maxRamGb: specValue(raw, 'maxRamGb', 'memoriaMaximaGb', 'capacidadeMaximaMemoriaGb'),
      m2Slots: Array.isArray(raw.slotsM2) ? raw.slotsM2.length : specValue(raw, 'm2Slots', 'quantidadeSlotsM2'),
      sataPorts: specValue(raw, 'sataPorts', 'portasSata'),
      wifi: yesNo(specValue(raw, 'wifi')),
      bluetooth: yesNo(specValue(raw, 'bluetooth')),
      pcie: specValue(raw, 'pcie', 'versaoPcie'),
    }
  } else if (category === 'MEMORIA_RAM') {
    const perModule = number(specValue(raw, 'capacidadePorModuloGb', 'capacidadeModuloGb'), 0)
    const modules = number(specValue(raw, 'quantidadeModulos', 'modules'), 1)
    normalized = {
      ...raw,
      capacityGb: specValue(raw, 'capacityGb', 'capacidadeTotalGb') ?? (perModule ? perModule * modules : undefined),
      modules,
      memoryType: specValue(raw, 'memoryType', 'tipoMemoria', 'tipo'),
      frequencyMhz: specValue(raw, 'frequencyMhz', 'frequenciaMhz'),
      latency: specValue(raw, 'latency', 'latenciaCl'),
      voltage: specValue(raw, 'voltage', 'tensao', 'tensaoVolts'),
      rgb: yesNo(specValue(raw, 'rgb')),
    }
  } else if (category === 'ARMAZENAMENTO') {
    normalized = {
      ...raw,
      capacityGb: specValue(raw, 'capacityGb', 'capacidadeGb'),
      type: specValue(raw, 'type', 'tipo'),
      interface: specValue(raw, 'interface'),
      readMbps: specValue(raw, 'readMbps', 'leituraMbS', 'leituraSequencialMbps'),
      writeMbps: specValue(raw, 'writeMbps', 'gravacaoMbS', 'escritaSequencialMbps'),
      formFactor: specValue(raw, 'formFactor', 'formato'),
    }
  } else if (category === 'FONTE') {
    normalized = {
      ...raw,
      powerWatts: specValue(raw, 'powerWatts', 'potenciaWatts'),
      certification: specValue(raw, 'certification', 'certificacao'),
      modularity: specValue(raw, 'modularity', 'modularidade'),
      pcie5: yesNo(Boolean(specValue(raw, 'conector12vhpwr', 'conectores12vhpwr', 'conectores12v2x6'))),
      fanMm: specValue(raw, 'fanMm', 'tamanhoVentoinhaMm'),
    }
  } else if (category === 'MONITOR') {
    normalized = {
      ...raw,
      sizeInches: specValue(raw, 'sizeInches', 'polegadas', 'tamanhoPolegadas'),
      resolution: specValue(raw, 'resolution', 'resolucao'),
      refreshRateHz: specValue(raw, 'refreshRateHz', 'taxaAtualizacaoHz'),
      panel: specValue(raw, 'panel', 'painel'),
      responseTimeMs: specValue(raw, 'responseTimeMs', 'tempoRespostaMs'),
      hdr: yesNo(specValue(raw, 'hdr')),
      displayPort: specValue(raw, 'displayPort'),
      hdmi: specValue(raw, 'hdmi'),
      vesa: specValue(raw, 'vesa'),
    }
  } else if (category === 'MOUSE') {
    normalized = {
      ...raw,
      sensor: specValue(raw, 'sensor'),
      dpiMax: specValue(raw, 'dpiMax', 'dpiMaximo'),
      pollingRateHz: specValue(raw, 'pollingRateHz', 'pollingRate'),
      buttons: specValue(raw, 'buttons', 'botoes'),
      weightGrams: specValue(raw, 'weightGrams', 'pesoGramas'),
      connection: arrayText(specValue(raw, 'connection', 'conexao', 'conexoes')),
      rgb: yesNo(specValue(raw, 'rgb')),
    }
  } else if (category === 'TECLADO') {
    normalized = {
      ...raw,
      type: specValue(raw, 'type', 'tipo'),
      layout: specValue(raw, 'layout'),
      size: specValue(raw, 'size', 'tamanho'),
      switch: specValue(raw, 'switch'),
      connection: arrayText(specValue(raw, 'connection', 'conexao', 'conexoes')),
      rgb: yesNo(specValue(raw, 'rgb')),
      hotSwap: yesNo(specValue(raw, 'hotSwap', 'hotswap')),
    }
  } else if (category === 'HEADSET' || category === 'FONE') {
    normalized = {
      ...raw,
      connection: arrayText(specValue(raw, 'connection', 'conexao', 'conexoes')),
      driverMm: specValue(raw, 'driverMm', 'tamanhoDriverMm'),
      microphone: yesNo(specValue(raw, 'microphone', 'microfone')),
      surround: yesNo(specValue(raw, 'surround')),
      weightGrams: specValue(raw, 'weightGrams', 'pesoGramas'),
    }
  }

  return Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined && value !== null && value !== ''))
}

export function normalizeProduct(item) {
  const hardware = item?.hardware && typeof item.hardware === 'object' ? item.hardware : null
  const rawCategory = hardware?.categoria ?? item.categoria ?? item.category ?? ''
  const enumCategory = categoryCode(rawCategory)
  const [knownGroup, knownCategory, knownCategoryKey] = CATEGORY_META[enumCategory] || []
  const rawGroup = typeof rawCategory === 'object' && rawCategory ? rawCategory.grupo : undefined
  const mappedGroup = PRODUCT_GROUPS[normalizeCategoryToken(rawGroup)]
  const group = knownGroup || mappedGroup || text(item.group || item.grupo, 'hardwares').toLowerCase()
  const category = knownCategory || text(rawCategory, 'Produto')
  const categoryKey = knownCategoryKey || text(item.categoryKey || item.categoriaChave || item.slugCategoria, 'produto')
  const offers = normalizeOffers(item.ofertas || item.offers || (item.melhorOferta ? [item.melhorOferta] : []))
  const price = offers[0]?.price ?? number(item.precoAtual ?? item.preco ?? item.price)
  const previousPrice = offers.find((offer) => offer.previousPrice)?.previousPrice ?? (number(item.precoAnterior ?? item.previousPrice, 0) || null)
  const has3d = Boolean(item.possuiModelo3D || item.modelo3D || item.modelo3d || item.modelo3DId || item.builderCompatible)

  return {
    id: item.id,
    slug: item.slug || String(item.id),
    group,
    category,
    categoryKey,
    name: text(item.nome ?? item.name, `${text(item.marca, '')} ${text(item.modelo, '')}`.trim() || 'Produto'),
    brand: text(item.marca ?? item.brand ?? hardware?.marca),
    description: item.descricao || item.description || hardware?.descricao || '',
    image: item.imagemUrl || item.imagem || item.image || hardware?.imagemUrl || null,
    hoverImage: item.imagemHoverUrl || item.hoverImage || item.imageHover || hardware?.imagemHoverUrl || null,
    rating: number(item.mediaAvaliacoes ?? item.avaliacao?.media ?? item.rating),
    reviewsCount: number(item.quantidadeAvaliacoes ?? item.avaliacao?.quantidade ?? item.reviewsCount),
    builderCompatible: item.builderCompatible === true || has3d,
    builderId: item.hardware?.id ?? item.hardwareId3D ?? item.builderId ?? item.id,
    price,
    previousPrice,
    tags: Array.isArray(item.tags) ? item.tags : [],
    specs: normalizeSpecs(hardware ? { ...item, ...hardware, especificacoes: item.especificacoes ?? hardware.especificacoes } : item, enumCategory),
    offers,
  }
}


function normalizeNotebookSpecs(rawSpecs = {}) {
  const spec = rawSpecs && typeof rawSpecs === 'object' ? rawSpecs : {}
  return {
    ...spec,
    cpu: text(spec.cpu ?? spec.processador ?? spec.processadorModelo),
    cpuBrand: text(spec.cpuBrand ?? spec.marcaProcessador ?? spec.processadorMarca, ''),
    cpuGeneration: text(spec.cpuGeneration ?? spec.geracaoProcessador, ''),
    cpuCores: number(spec.cpuCores ?? spec.nucleosProcessador ?? spec.nucleos, 0),
    cpuThreads: number(spec.cpuThreads ?? spec.threadsProcessador ?? spec.threads, 0),
    cpuTdpWatts: number(spec.cpuTdpWatts ?? spec.tdpProcessador ?? spec.tdpCpu, 0),
    gpu: text(spec.gpu ?? spec.placaVideo ?? spec.placaDeVideo, 'Vídeo integrado'),
    dedicatedGpu: Boolean(spec.dedicatedGpu ?? spec.gpuDedicada ?? spec.placaVideoDedicada),
    vramGb: number(spec.vramGb ?? spec.memoriaVideoGb ?? spec.vram, 0),
    gpuTgpWatts: number(spec.gpuTgpWatts ?? spec.tgpGpu ?? spec.tgp, 0),
    ramGb: number(spec.ramGb ?? spec.memoriaRamGb ?? spec.memoriaInstaladaGb, 0),
    ramType: text(spec.ramType ?? spec.tipoMemoria ?? spec.tipoRam, ''),
    maxRamGb: number(spec.maxRamGb ?? spec.memoriaMaximaGb ?? spec.ramMaximaGb, 0),
    storageGb: number(spec.storageGb ?? spec.armazenamentoGb ?? spec.capacidadeArmazenamentoGb, 0),
    m2Slots: number(spec.m2Slots ?? spec.slotsM2, 0),
    screenInches: number(spec.screenInches ?? spec.telaPolegadas ?? spec.polegadas, 0),
    resolution: text(spec.resolution ?? spec.resolucaoTela ?? spec.resolucao, ''),
    refreshRateHz: number(spec.refreshRateHz ?? spec.taxaAtualizacaoHz ?? spec.hz, 0),
    panel: text(spec.panel ?? spec.painelTela ?? spec.tipoPainel, ''),
    brightnessNits: number(spec.brightnessNits ?? spec.brilhoNits, 0),
    batteryWh: number(spec.batteryWh ?? spec.bateriaWh, 0),
    weightKg: number(spec.weightKg ?? spec.pesoKg, 0),
    upgradeRam: text(spec.upgradeRam ?? spec.ramExpansivel, '—'),
    upgradeStorage: text(spec.upgradeStorage ?? spec.armazenamentoExpansivel, '—'),
  }
}

export function normalizeNotebook(item) {
  const offers = normalizeOffers(item.ofertas || item.offers)
  const specs = normalizeNotebookSpecs(item.especificacoes || item.especificacaoNotebook || item.specs || {})
  return {
    id: item.id,
    slug: item.slug || String(item.id),
    name: item.nome || item.name || `${item.marca || ''} ${item.modelo || ''}`.trim() || 'Notebook',
    brand: text(item.marca ?? item.brand),
    model: text(item.modelo ?? item.model, ''),
    use: text(item.finalidade ?? item.uso ?? item.use, 'Uso geral'),
    description: item.descricao || item.description || '',
    rating: number(item.mediaAvaliacoes ?? item.rating),
    reviewsCount: number(item.quantidadeAvaliacoes ?? item.reviewsCount),
    price: offers[0]?.price ?? number(item.precoAtual ?? item.preco ?? item.price),
    previousPrice: offers.find((offer) => offer.previousPrice)?.previousPrice ?? (number(item.precoAnterior ?? item.previousPrice, 0) || null),
    tags: Array.isArray(item.tags) ? item.tags : [],
    specs,
    offers,
  }
}

function componentName(component, fallback = '—') {
  return component?.hardware?.nome || component?.produto?.nome || component?.nome || fallback
}

export function normalizeMountedPc(item) {
  const product = item.produto || item.product || {}
  const offers = normalizeOffers(item.ofertas || item.offers || product.ofertas || product.offers)
  const components = item.componentes || []
  const find = (category) => components.find((component) => categoryCode(component.categoria ?? component.hardware?.categoria) === category)
  const cpu = find('PROCESSADOR')
  const gpu = find('PLACA_VIDEO')
  const motherboard = find('PLACA_MAE')
  const ram = find('MEMORIA_RAM')
  const storage = find('ARMAZENAMENTO')
  const psu = find('FONTE')
  const cooler = find('COOLER')
  const pcCase = find('GABINETE')
  const fans = components.filter((component) => categoryCode(component.categoria ?? component.hardware?.categoria) === 'VENTOINHA')
  const explicitBuilderConfiguration = item.configuracao3D || item.builderConfiguration || item.configuracao || item.configuration
  const componentsBuilderConfiguration = configurationFromComponents(components)

  const cpuSpec = cpu?.hardware?.especificacaoProcessador || {}
  const gpuSpec = gpu?.hardware?.especificacaoPlacaVideo || {}
  const ramSpec = ram?.hardware?.especificacaoMemoriaRam || {}
  const storageSpec = storage?.hardware?.especificacaoArmazenamento || {}
  const psuSpec = psu?.hardware?.especificacaoFonte || {}
  const ramGb = number(item.ramGb, 0) || (number(ramSpec.capacidadePorModuloGb, 0) * number(ramSpec.quantidadeModulos, 1) * number(ram?.quantidade, 1))
  const storageGb = number(item.storageGb, 0) || (number(storageSpec.capacidadeGb, 0) * number(storage?.quantidade, 1))
  const ratingData = item.avaliacao || item.ratingData || {}

  const normalized = {
    id: item.id,
    name: item.nome || item.name || product.nome || product.name || 'PC Montado',
    category: text(item.categoria ?? item.category ?? product.categoria ?? product.category, 'PC Montado'),
    usage: text(item.finalidade ?? item.uso ?? item.usage, 'Uso geral'),
    resolution: text(item.resolucaoRecomendada ?? item.resolucao ?? item.resolution),
    store: offers[0]?.store || item.loja || item.parceiro?.nome || 'Multiloja',
    cpu: item.processador || item.cpu || componentName(cpu),
    cpuTdp: number(item.cpuTdp ?? cpu?.tdpWatts ?? cpuSpec.tdpWatts),
    gpu: item.placaVideo || item.gpu || componentName(gpu, 'Vídeo integrado'),
    gpuTgp: number(item.gpuTgp ?? gpu?.tgpWatts ?? gpuSpec.consumoWatts),
    motherboard: item.placaMae || item.motherboard || componentName(motherboard),
    ram: item.memoria || item.ram || componentName(ram),
    ramGb,
    storage: item.armazenamento || item.storage || componentName(storage),
    storageGb,
    powerSupply: item.fonte || item.powerSupply || componentName(psu),
    powerSupplyWatts: number(item.powerSupplyWatts ?? psu?.potenciaWatts ?? psuSpec.potenciaWatts),
    cooler: item.cooler || componentName(cooler),
    case: item.gabinete || item.case || componentName(pcCase),
    fans: number(item.quantidadeVentoinhas ?? item.fans, fans.reduce((total, component) => total + Math.max(1, number(component.quantidade, 1)), 0)),
    estimatedConsumption: number(item.consumoEstimadoWatts ?? item.estimatedConsumption),
    rating: number(item.mediaAvaliacoes ?? ratingData.media ?? item.rating),
    reviewsCount: number(item.quantidadeAvaliacoes ?? ratingData.quantidade ?? item.reviewsCount),
    offersCount: number(item.quantidadeOfertasAtivas ?? item.offersCount, offers.length),
    price: offers[0]?.price ?? number(item.melhorPreco ?? item.precoAtual ?? item.price),
    highlight: item.destaque || item.highlight || '',
    description: item.descricao || item.description || product.descricao || product.description || '',
    image: item.imagemUrl || item.image || product.imagemUrl || product.image || null,
    offers,
    components,
    purchaseSummary: item.resumoCompra || item.purchaseSummary || null,
    builderConfiguration: explicitBuilderConfiguration || componentsBuilderConfiguration,
  }

  normalized.builderConfiguration = inferMountedPcConfiguration(normalized)
  return normalized
}

export function normalizeCommunityBuild(item) {
  const author = text(item.autor?.nome ?? item.usuario?.nome ?? item.author, 'Usuário')
  const componentList = item.componentes || []
  const find = (category) => componentList.find((component) => categoryCode(component.categoria ?? component.hardware?.categoria) === category)
  const comments = Array.isArray(item.comentarios) ? item.comentarios : (Array.isArray(item.comments) ? item.comments : [])
  const commentsTreeCount = comments.reduce((total, comment) => {
    const replies = Array.isArray(comment.respostas) ? comment.respostas : (Array.isArray(comment.replies) ? comment.replies : [])
    return total + 1 + replies.length
  }, 0)
  const reportedCommentsCount = item.quantidadeComentarios ?? item.commentsCount
  const commentsCount = reportedCommentsCount == null
    ? commentsTreeCount
    : Math.max(number(reportedCommentsCount), commentsTreeCount)
  const componentsBuilderConfiguration = configurationFromComponents(componentList)

  const normalized = {
    id: item.id,
    slug: item.slug || String(item.id),
    title: item.titulo || item.title || 'Build da comunidade',
    author,
    authorInitials: author.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
    description: item.descricao || item.description || '',
    cpu: item.processador || item.cpu || componentName(find('PROCESSADOR')),
    gpu: item.placaVideo || item.gpu || componentName(find('PLACA_VIDEO'), 'Vídeo integrado'),
    ram: item.memoria || item.ram || componentName(find('MEMORIA_RAM')),
    storage: item.armazenamento || item.storage || componentName(find('ARMAZENAMENTO')),
    motherboard: item.placaMae || item.motherboard || componentName(find('PLACA_MAE')),
    psu: item.fonte || item.psu || componentName(find('FONTE')),
    price: number(item.precoAtualEstimado ?? item.precoNaPublicacao ?? item.price),
    consumption: number(item.consumoEstimadoWatts ?? item.consumoNaPublicacao ?? item.consumption),
    compatibility: item.statusCompatibilidade || item.compatibilidade || item.compatibility || 'INFORMACAO_INSUFICIENTE',
    rating: number(item.mediaAvaliacoes ?? item.rating),
    reviewsCount: number(item.quantidadeAvaliacoes ?? item.reviewsCount),
    commentsCount,
    copies: number(item.quantidadeCopias ?? item.copies),
    views: number(item.visualizacoes ?? item.views),
    purpose: item.finalidade || item.purpose || 'Uso geral',
    resolution: item.resolucao || item.resolution || 'Não aplicável',
    visibility: item.visibilidade || item.visibility || 'PUBLICA',
    status: item.status || 'PUBLICADA',
    authorId: item.usuarioId ?? item.usuario?.id ?? item.autor?.id ?? null,
    createdAt: item.publicadoEm || item.criadoEm || item.createdAt || '',
    updatedAt: item.atualizadoEm || item.updatedAt || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    comments: comments.map((comment) => ({
      id: comment.id,
      author: comment.usuario?.nome || comment.autor?.nome || comment.author || 'Usuário',
      text: comment.texto || comment.text || '',
      time: comment.criadoEm || comment.time || '',
      replies: Array.isArray(comment.respostas) ? comment.respostas.map((reply) => ({
        id: reply.id,
        author: reply.usuario?.nome || reply.autor?.nome || reply.author || 'Usuário',
        text: reply.texto || reply.text || '',
        time: reply.criadoEm || reply.time || '',
      })) : (comment.replies || []),
    })),
    components: componentList,
    builderConfiguration: item.configuracao3D || item.builderConfiguration || item.configuracao || componentsBuilderConfiguration,
  }

  normalized.builderConfiguration = inferMountedPcConfiguration({
    ...normalized,
    name: normalized.title,
    powerSupply: normalized.psu,
    powerSupplyWatts: Number(String(normalized.psu).match(/\d+/)?.[0]) || 0,
    fans: Number(item.quantidadeVentoinhas || item.fans || 4),
    ramGb: Number(String(normalized.ram).match(/\d+/)?.[0]) || 16,
  })

  return normalized
}

export function normalizeOfferItem(item) {
  const offers = normalizeOffers(item.ofertas || item.offers || (item.oferta ? [item.oferta] : []))
  const product = item.produto || item.hardware || item
  const rawCategory = item.categoria ?? product?.categoria ?? item.category ?? product?.category ?? ''
  const categoryEnumSource = typeof rawCategory === 'string'
    ? rawCategory
    : rawCategory?.codigo || rawCategory?.slug || rawCategory?.nome || rawCategory?.name || ''
  const categoryEnum = categoryCode(categoryEnumSource)
  const [group, knownCategory] = CATEGORY_META[categoryEnum] || [item.grupo || item.group || 'hardwares', null]
  const category = knownCategory
    || (typeof rawCategory === 'string' ? rawCategory : rawCategory?.nome || rawCategory?.name || rawCategory?.label)
    || 'Produto'
  const price = item.melhorPreco ?? offers[0]?.price ?? item.precoAtual ?? item.price ?? 0
  const previousPrice = item.precoAnterior ?? offers[0]?.previousPrice ?? item.previousPrice ?? null

  return {
    id: product.id ?? item.produtoId ?? item.hardwareId ?? item.id,
    group: text(item.grupo ?? item.group ?? group, 'hardwares').toLowerCase(),
    category,
    name: product.nome || product.name || item.nome || item.name || 'Produto',
    brand: text(product.marca ?? product.brand ?? item.marca ?? item.brand),
    image: product.imagemUrl || product.image || item.imagemUrl || item.image || null,
    price: number(price),
    previousPrice: previousPrice == null ? null : number(previousPrice),
    offersCount: number(item.quantidadeOfertasAtivas ?? item.quantidadeOfertas ?? item.offersCount, offers.length),
    bestStore: offers[0]?.store || item.melhorOferta?.parceiro?.nome || item.bestStore || 'Loja parceira',
    context: product.descricao || item.descricao || item.context || '',
    tags: Array.isArray(product.tags || item.tags) ? (product.tags || item.tags) : [],
  }
}
