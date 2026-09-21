import { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { storeAiImportPreview } from '../utils/aiImportTransfer'
import { getAiConflicts, getAiMissingFields, getAiOffer, getAiPayload, getAiReadiness, getAiReconciliation } from '../utils/aiImportContract'

const ACTION_PRODUCT = 'CADASTRAR_PRODUTO'
const ACTION_HARDWARE = 'CADASTRAR_HARDWARE'
const ACTION_BUILD = 'CADASTRAR_PC_MONTADO'

const BUILD_INFO_QUESTIONS = [
  { field: 'nome', prompt: 'Qual é o nome do PC montado? Ex.: PC Gamer Ryzen 7 + RTX 4070.' },
  { field: 'finalidade', prompt: 'Qual é a finalidade principal? Ex.: jogos, trabalho, edição. Digite "pular" se não quiser informar.' },
  { field: 'resolucaoRecomendada', prompt: 'Qual resolução você recomenda para esse PC? Ex.: 1080p, 1440p ou 4K. Digite "pular" para deixar em branco.' },
]

const BUILD_COMPONENT_STEPS = [
  { categoria: 'PROCESSADOR', label: 'processador', optional: false },
  { categoria: 'PLACA_MAE', label: 'placa-mãe', optional: false },
  { categoria: 'MEMORIA_RAM', label: 'memória RAM', optional: false },
  { categoria: 'ARMAZENAMENTO', label: 'armazenamento', optional: false },
  { categoria: 'FONTE', label: 'fonte', optional: false },
  { categoria: 'GABINETE', label: 'gabinete', optional: false },
  { categoria: 'PLACA_VIDEO', label: 'placa de vídeo', optional: true },
  { categoria: 'COOLER', label: 'cooler', optional: true },
]

function isSkipAnswer(value) {
  return /^(pular|skip|nao|não|nenhum|sem)$/i.test(clean(value))
}

function hardwareSearchText(hardware = {}) {
  return normalizedAnswerKey([
    hardware.id,
    hardware.nome,
    hardware.marca,
    hardware.modelo,
    hardware.mpn,
    hardware.gtin,
  ].filter(Boolean).join(' '))
}

function buildComponentPrompt(step) {
  if (!step) return ''
  return step.optional
    ? `Digite parte do nome/modelo da ${step.label} para pesquisar no catálogo ou "pular".`
    : `Digite parte do nome/modelo da ${step.label} para pesquisar no catálogo.`
}

function buildCategoryFromPurpose(value) {
  const normalized = normalizedAnswerKey(value)
  if (/jogo|gamer|game/.test(normalized)) return 'PC Gamer'
  if (/edicao|edição|criacao|criação|render|video|vídeo/.test(normalized)) return 'PC Creator'
  if (/trabalho|office|escritorio|escritório/.test(normalized)) return 'PC Trabalho'
  return 'PC Montado'
}

function nextBuildComponentIndex(componentes = [], startIndex = 0) {
  const selected = new Set((Array.isArray(componentes) ? componentes : []).map((item) => item.categoria))
  for (let index = Math.max(0, startIndex); index < BUILD_COMPONENT_STEPS.length; index += 1) {
    if (!selected.has(BUILD_COMPONENT_STEPS[index].categoria)) return index
  }
  return BUILD_COMPONENT_STEPS.length
}

function buildLinkedComponents(preview, hardwares = []) {
  const source = getAiPayload(preview)
  const linked = Array.isArray(source?.componentes) ? source.componentes : []
  const detected = preview?.cadastroSugerido?.componentesDetectados
    || preview?.acaoFrontend?.componentesDetectados
    || []
  const hardwareById = new Map((hardwares || []).map((hardware) => [Number(hardware.id), hardware]))
  const raw = [
    ...linked,
    ...(Array.isArray(detected) ? detected : []),
  ]
  const seen = new Set()
  return raw.flatMap((item, index) => {
    const categoria = clean(item?.categoria).toUpperCase()
    if (!categoria) return []

    let hardwareId = Number(item?.hardwareId)
    let hardware = Number.isInteger(hardwareId) && hardwareId > 0
      ? hardwareById.get(hardwareId)
      : null

    if (!hardware) {
      const targetTokens = [
        item?.modelo,
        item?.nome,
        item?.marca,
      ].map(normalizedAnswerKey).filter((value) => value.length >= 3)
      const candidates = (hardwares || []).filter((candidate) => {
        if (candidate?.publicado !== true || candidate?.ativo === false) return false
        if (clean(candidate?.categoria).toUpperCase() !== categoria) return false
        const haystack = hardwareSearchText(candidate)
        const candidateModel = normalizedAnswerKey(candidate?.modelo)
        return targetTokens.some((token) => (
          haystack.includes(token)
          || (candidateModel.length >= 3 && token.includes(candidateModel))
        ))
      })
      if (candidates.length === 1) {
        hardware = candidates[0]
        hardwareId = Number(hardware.id)
      }
    }

    const key = `${categoria}:${hardwareId}`
    if (!hardware || !Number.isInteger(hardwareId) || hardwareId < 1 || seen.has(key)) return []
    if (hardware.publicado !== true || hardware.ativo === false) return []
    seen.add(key)
    return [{
      hardwareId,
      categoria,
      quantidade: Number(item?.quantidade || 1),
      ordem: index,
      nome: clean(hardware.nome) || clean(item?.hardwareNome) || `Hardware #${hardwareId}`,
      marca: clean(hardware.marca),
      modelo: clean(hardware.modelo),
    }]
  })
}

function responseText(data) {
  if (typeof data === 'string') return data
  return data?.resposta || data?.mensagem || data?.texto || data?.conteudo || data?.answer || 'Resposta recebida do backend.'
}

function clean(value) {
  return String(value ?? '').trim()
}

function formatPrice(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}


const SPEC_FIELD_BY_CATEGORY = {
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

const CATEGORY_ANSWER_ALIASES = {
  celular: 'CELULAR',
  smartphone: 'CELULAR',
  telefone: 'TELEFONE',
  tablet: 'TABLET',
  notebook: 'NOTEBOOK',
  monitor: 'MONITOR',
  processador: 'PROCESSADOR',
  cpu: 'PROCESSADOR',
  'placa de video': 'PLACA_VIDEO',
  gpu: 'PLACA_VIDEO',
  'placa mae': 'PLACA_MAE',
  memoria: 'MEMORIA_RAM',
  'memoria ram': 'MEMORIA_RAM',
  armazenamento: 'ARMAZENAMENTO',
  ssd: 'ARMAZENAMENTO',
  hd: 'ARMAZENAMENTO',
  fonte: 'FONTE',
  gabinete: 'GABINETE',
  cooler: 'COOLER',
  ventoinha: 'VENTOINHA',
  mouse: 'MOUSE',
  teclado: 'TECLADO',
  fone: 'FONE',
  headset: 'FONE',
  microfone: 'MICROFONE',
  videogame: 'VIDEOGAME',
  console: 'VIDEOGAME',
  camera: 'CAMERA',
  'maquina fotografica': 'CAMERA',
  'smart tv': 'SMART_TV',
  tv: 'TV',
  'aspirador de po': 'ASPIRADOR_PO',
  aspirador: 'ASPIRADOR_PO',
  'robo aspirador': 'ROBO_ASPIRADOR',
  drone: 'DRONE',
  'air fryer': 'AIR_FRYER',
  cafeteira: 'CAFETEIRA',
  liquidificador: 'LIQUIDIFICADOR',
  ventilador: 'VENTILADOR',
  climatizador: 'CLIMATIZADOR',
}

function normalizedAnswerKey(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function normalizeCategoryAnswer(value) {
  const key = normalizedAnswerKey(value)
  return CATEGORY_ANSWER_ALIASES[key] || key.toUpperCase().replaceAll(' ', '_')
}

function parseBrazilianNumber(value) {
  const raw = clean(value).replace(/R\$/gi, '').replace(/\s+/g, '')
  if (!raw) return null
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw
  const number = Number(normalized.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(number) ? number : null
}

function parseQuestionValue(field, value) {
  const text = clean(value)
  if (!text) return null
  if (field === 'preco' || field === 'precoAnterior') return parseBrazilianNumber(text)

  const normalized = normalizedAnswerKey(text)
  if (/^(sim|s|true|yes)$/.test(normalized)) return true
  if (/^(nao|n|false|no)$/.test(normalized)) return false

  if (/(?:mhz|ghz|watts?|gb|mb|nucleos|threads|quantidade|capacidade|largura|altura|comprimento|rpm|mm|litros|minutos|metros|polegadas|hz|pa)$/i.test(field)) {
    const number = parseBrazilianNumber(text)
    if (number !== null) return number
  }
  if (/^(tipos|formatos|conectores|frequencias)/i.test(field) && /[,;|]/.test(text)) {
    return text.split(/[,;|]/).map((item) => item.trim()).filter(Boolean)
  }
  return text
}

function questionPrompt(field) {
  const custom = {
    categoria: 'Qual é a categoria desse produto? Ex.: celular, tablet, processador, videogame, câmera ou aspirador.',
    nome: 'Qual é o nome completo do produto?',
    marca: 'Qual é a marca?',
    modelo: 'Qual é o modelo?',
    preco: 'Qual é o preço atual? Pode responder, por exemplo, 918 ou 918,00.',
    precoAnterior: 'Qual era o preço anterior?',
  }
  return custom[field] || `Não consegui obter ${humanizeField(field)}. Qual é o valor correto?`
}

function buildRegistrationQuestions(preview, action, answered = {}) {
  const summary = normalizeAutomaticPreview(preview)
  const questions = []
  const added = new Set()
  const add = (field) => {
    if (!field || answered[field] !== undefined || added.has(field)) return
    added.add(field)
    questions.push({ field, prompt: questionPrompt(field) })
  }

  if (!summary.category) add('categoria')
  if (!summary.name) add('nome')
  if (!summary.brand) add('marca')
  if (!summary.model) add('modelo')
  const priceNumber = Number(summary.price)
  if (
    action === ACTION_PRODUCT
    && (summary.price === null || summary.price === undefined || summary.price === '' || !Number.isFinite(priceNumber) || priceNumber <= 0)
  ) add('preco')

  const technical = summary.technical || {}
  for (const field of getAiMissingFields(preview)) {
    if (['categoria', 'nome', 'marca', 'modelo', 'preco'].includes(field)) {
      add(field)
      continue
    }
    const hasValue = technical[field] !== undefined && technical[field] !== null && technical[field] !== ''
    if (!hasValue) add(field)
  }
  return questions
}

function mergeManualPreview(summary, flow) {
  const adjustments = flow?.adjustments || {}
  const corrected = adjustments?.dadosCorrigidos || {}
  const category = adjustments?.categoria || summary.category
  const specKey = SPEC_FIELD_BY_CATEGORY[category]
  const specCorrected = specKey && corrected?.[specKey] && typeof corrected[specKey] === 'object'
    ? corrected[specKey]
    : {}

  return {
    ...summary,
    category,
    name: clean(corrected.nome) || summary.name,
    brand: clean(corrected.marca) || summary.brand,
    model: clean(corrected.modelo) || summary.model,
    description: clean(corrected.descricao) || summary.description,
    mpn: clean(corrected.mpn) || summary.mpn,
    gtin: clean(corrected.gtin) || summary.gtin,
    price: adjustments.preco ?? summary.price,
    previousPrice: adjustments.precoAnterior ?? summary.previousPrice,
    technical: { ...(summary.technical || {}), ...corrected, ...specCorrected },
  }
}

function humanizeField(key) {
  const labels = {
    mpn: 'MPN',
    gtin: 'GTIN / EAN',
    ean: 'EAN',
    sku: 'SKU',
    urlOriginal: 'Link do produto',
    urlAfiliada: 'Link afiliado',
    codigoMarketplace: 'Código marketplace',
    fontePreco: 'Fonte do preço',
    disponivel: 'Disponibilidade',
    descricao: 'Descrição',
    nome: 'Nome',
    marca: 'Marca',
    modelo: 'Modelo',
    imagemUrl: 'Imagem',
  }
  if (labels[key]) return labels[key]
  return String(key || '')
    .replace(/^especificacao/i, '')
    .replaceAll('_', ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase())
}

function previewValue(value) {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (Array.isArray(value)) {
    const items = value.filter((item) => ['string', 'number', 'boolean'].includes(typeof item))
    return items.length ? items.map((item) => previewValue(item)).join(', ') : ''
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'string') return value.trim()
  return ''
}

function flattenPreviewData(source = {}, depth = 0) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return []
  const entries = []
  Object.entries(source).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    const simple = previewValue(value)
    if (simple) {
      entries.push([key, simple])
      return
    }
    if (depth < 1 && value && typeof value === 'object' && !Array.isArray(value)) {
      flattenPreviewData(value, depth + 1).forEach(([childKey, childValue]) => {
        entries.push([childKey, childValue])
      })
    }
  })
  return entries
}

function validPublicUrl(value) {
  try {
    const url = new URL(clean(value))
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

function unsupportedChatbotRoute(error) {
  return [404, 405].includes(Number(error?.status))
}

function previewSource(preview = {}) {
  return getAiPayload(preview)
}

function previewOffer(preview = {}) {
  return getAiOffer(preview)
}

function normalizeAutomaticPreview(data = {}) {
  const analysis = data?.analise || data?.analysis || {}
  const hardware = analysis?.hardware || data?.hardware || {}
  const product = analysis?.produto || data?.produto || {}
  const offer = analysis?.oferta || data?.oferta || {}
  const source = getAiPayload(data)
  const structuredOffer = getAiOffer(data) || {}
  const hardwareData = { ...source, ...(hardware?.dadosDetectados || hardware?.dados || hardware?.data || {}) }
  const productData = { ...source, ...(product?.dadosDetectados || product?.dados || product?.data || {}) }
  const offerData = { ...structuredOffer, ...(offer?.dadosDetectados || offer?.dados || offer?.data || {}) }
  const collectedSpecs = product?.especificacoesEncontradas && typeof product.especificacoesEncontradas === 'object'
    ? product.especificacoesEncontradas
    : {}
  const missing = getAiMissingFields(data)
  const conflicts = getAiConflicts(data)

  return {
    name: clean(productData?.nome || hardwareData?.nome || data?.nome),
    brand: clean(productData?.marca || hardwareData?.marca),
    model: clean(productData?.modelo || hardwareData?.modelo),
    category: clean(analysis?.categoria || data?.categoria || productData?.categoria || hardwareData?.categoria || data?.categoriaDetectada),
    image: clean(productData?.imagemUrl || hardwareData?.imagemUrl),
    description: clean(productData?.descricao || hardwareData?.descricao),
    mpn: clean(productData?.mpn || hardwareData?.mpn),
    gtin: clean(productData?.gtin || productData?.ean || hardwareData?.gtin || hardwareData?.ean),
    price: offerData?.preco ?? offer?.preco ?? data?.preco,
    previousPrice: offerData?.precoAnterior ?? offer?.precoAnterior ?? data?.precoAnterior,
    available: offerData?.disponivel ?? offer?.disponivel,
    partner: clean(offerData?.parceiroNome || offer?.parceiroNome || offerData?.parceiro?.nome || offer?.parceiro?.nome),
    affiliateUrl: clean(offerData?.urlAfiliada || offer?.urlAfiliada),
    originalUrl: clean(offerData?.urlOriginal || offer?.urlOriginal),
    marketplaceCode: clean(offerData?.codigoMarketplace || offer?.codigoMarketplace),
    priceSource: clean(offerData?.fontePreco || offer?.fontePreco),
    hardwareExisting: hardware?.existente,
    hardwareId: hardware?.id,
    productExisting: product?.existente ?? Boolean(getAiReconciliation(data)?.produtoExistente),
    productId: product?.id ?? getAiReconciliation(data)?.produtoExistente?.id,
    offerExisting: offer?.existente ?? Boolean(getAiReconciliation(data)?.ofertaExistente),
    offerId: offer?.id ?? getAiReconciliation(data)?.ofertaExistente?.id,
    registrationType: clean(analysis?.tipoCadastro),
    actions: Array.isArray(data?.acoesPrevistas) ? data.acoesPrevistas : [],
    warnings: [
      ...(Array.isArray(data?.avisos) ? data.avisos : []),
      ...missing.map((field) => `Campo para revisão: ${field}`),
      ...conflicts.map((item) => typeof item === 'string' ? item : `Conflito em ${item?.campo || 'campo técnico'}`),
    ],
    technical: { ...collectedSpecs, ...hardwareData, ...productData },
  }
}

function normalizeFallbackPreview(preview = {}) {
  const source = previewSource(preview)
  const offer = previewOffer(preview) || {}
  const reconciliation = getAiReconciliation(preview)
  return {
    name: clean(source.nome),
    brand: clean(source.marca),
    model: clean(source.modelo),
    category: clean(source.categoria || preview?.categoriaDetectada || preview?.categoriaSugerida),
    image: clean(source.imagemUrl),
    description: clean(source.descricao),
    mpn: clean(source.mpn),
    gtin: clean(source.gtin || source.ean),
    price: offer?.preco,
    previousPrice: offer?.precoAnterior,
    available: offer?.disponivel,
    partner: clean(offer?.parceiroNome || offer?.parceiro?.nome),
    affiliateUrl: clean(offer?.urlAfiliada),
    originalUrl: clean(offer?.urlOriginal),
    marketplaceCode: clean(offer?.codigoMarketplace),
    priceSource: clean(offer?.fontePreco),
    hardwareExisting: reconciliation?.hardwareExistente ? true : undefined,
    hardwareId: reconciliation?.hardwareExistente?.id,
    productExisting: reconciliation?.produtoExistente ? true : undefined,
    productId: reconciliation?.produtoExistente?.id,
    offerExisting: reconciliation?.ofertaExistente ? true : undefined,
    offerId: reconciliation?.ofertaExistente?.id,
    actions: [],
    warnings: [
      ...(Array.isArray(preview?.normalizacao?.alertas) ? preview.normalizacao.alertas : []),
      ...getAiMissingFields(preview).map((field) => `Campo para revisão: ${field}`),
      ...getAiConflicts(preview).map((item) => typeof item === 'string' ? item : `Conflito em ${item?.campo || 'campo técnico'}`),
    ],
    technical: source,
  }
}

function entityStatus(value, id, pendingLabel) {
  if (value === true) return `Já cadastrado${id ? ` (#${id})` : ''}`
  if (value === false) return pendingLabel
  return 'Será verificado no backend'
}

function RegistrationLinkForm({ flow, onChange, onSubmit, sending }) {
  const isProduct = flow?.action === ACTION_PRODUCT
  const isBuild = flow?.action === ACTION_BUILD
  const productUrl = clean(flow?.url)
  const affiliateUrl = clean(flow?.affiliateUrl)
  const productValid = validPublicUrl(productUrl)
  const affiliateValid = !isProduct || validPublicUrl(affiliateUrl)
  const ready = productValid && affiliateValid && !sending

  return (
    <form className="admin-ia-link-form" onSubmit={(event) => { event.preventDefault(); if (ready) onSubmit(productUrl, affiliateUrl) }}>
      <div className="admin-ia-link-form__head">
        <strong>{isProduct ? 'Analisar produto para cadastro' : isBuild ? 'Analisar PC Montado por link' : 'Analisar Hardware por link'}</strong>
        <small>{isProduct
          ? 'Mercado Livre e Shopee usam API oficial quando disponível; Magazine Luiza/Magalu usa o extrator específico do ProjetoIA.'
          : isBuild
            ? 'A IA identifica o PC e tenta vincular automaticamente as peças aos Hardwares já publicados.'
            : 'A IA pesquisa a ficha técnica antes de cadastrar.'}</small>
      </div>
      <label>
        <span>Link do produto</span>
        <input
          type="url"
          value={flow?.url || ''}
          onChange={(event) => onChange('url', event.target.value)}
          placeholder="https://..."
          autoComplete="off"
          required
          disabled={sending}
        />
      </label>
      {isProduct && (
        <label>
          <span>Link afiliado</span>
          <input
            type="url"
            value={flow?.affiliateUrl || ''}
            onChange={(event) => onChange('affiliateUrl', event.target.value)}
            placeholder="https://..."
            autoComplete="off"
            required
            disabled={sending}
          />
        </label>
      )}
      <div className="admin-ia-link-form__actions">
        <button type="submit" className="btn btn-primario btn-pequeno" disabled={!ready}>
          {sending ? 'Analisando...' : isProduct ? 'Analisar produto' : isBuild ? 'Analisar PC Montado' : 'Analisar Hardware'}
        </button>
      </div>
      {isProduct && <small className="admin-ia-link-form__note">A IA sempre mostra uma prévia com os dados encontrados antes de qualquer cadastro.</small>}
    </form>
  )
}

function RegistrationPreview({ flow, onConfirm, onCancel, onOpenForm, sending }) {
  if (!flow?.preview) return null
  const baseSummary = flow.backendReady ? normalizeAutomaticPreview(flow.preview) : normalizeFallbackPreview(flow.preview)
  const summary = mergeManualPreview(baseSummary, flow)
  const price = formatPrice(summary.price)
  const previousPrice = formatPrice(summary.previousPrice)
  const readiness = getAiReadiness(flow.preview)
  const identityKeys = new Set(['nome','marca','modelo','descricao','mpn','gtin','ean','imagemUrl','categoria','metadados','urlOriginal','urlAfiliada'])
  const technicalEntries = flattenPreviewData(summary.technical || {})
    .filter(([key, value]) => !identityKeys.has(key) && value)
    .slice(0, 12)
  const originalUrl = summary.originalUrl || clean(flow?.url)
  const affiliateUrl = summary.affiliateUrl || clean(flow?.affiliateUrl)

  return (
    <section className="admin-ia-registration-card" aria-label="Prévia do cadastro por IA">
      <div className="admin-ia-registration-head">
        {summary.image ? <img src={summary.image} alt="" loading="lazy" /> : <span className="admin-ia-registration-placeholder" aria-hidden="true">✦</span>}
        <div>
          <small>{summary.category ? summary.category.replaceAll('_', ' ') : 'Produto identificado'}</small>
          <strong>{summary.name || [summary.brand, summary.model].filter(Boolean).join(' ') || 'Cadastro encontrado pela IA'}</strong>
          {(summary.brand || summary.model) && <span>{[summary.brand, summary.model].filter(Boolean).join(' · ')}</span>}
        </div>
      </div>

      <div className="admin-ia-registration-grid">
        {summary.registrationType !== 'PRODUTO_OFERTA' && <div><span>Hardware</span><strong>{entityStatus(summary.hardwareExisting, summary.hardwareId, 'Será criado se necessário')}</strong></div>}
        {summary.registrationType === 'PRODUTO_OFERTA' && <div><span>Cadastro</span><strong>Produto comum + Oferta</strong><small>Não será criado Hardware de PC</small></div>}
        {flow.action === ACTION_PRODUCT && <div><span>Produto</span><strong>{entityStatus(summary.productExisting, summary.productId, 'Será criado')}</strong></div>}
        {flow.action === ACTION_PRODUCT && <div><span>Oferta</span><strong>{entityStatus(summary.offerExisting, summary.offerId, 'Será criada/atualizada')}</strong></div>}
        {flow.action === ACTION_PRODUCT && <div className="admin-ia-registration-price"><span>Preço</span><strong>{price || 'Não identificado'}</strong>{previousPrice && previousPrice !== price ? <small>Antes: {previousPrice}</small> : null}</div>}
        {flow.action === ACTION_PRODUCT && summary.partner && <div><span>Parceiro</span><strong>{summary.partner}</strong></div>}
        {summary.brand && <div><span>Marca</span><strong>{summary.brand}</strong></div>}
        {summary.model && <div><span>Modelo</span><strong>{summary.model}</strong></div>}
        {summary.mpn && <div><span>MPN</span><strong>{summary.mpn}</strong></div>}
        {summary.gtin && <div><span>GTIN / EAN</span><strong>{summary.gtin}</strong></div>}
        {flow.action === ACTION_PRODUCT && summary.available !== undefined && <div><span>Disponibilidade</span><strong>{summary.available ? 'Disponível' : 'Indisponível'}</strong></div>}
      </div>

      {summary.description && <div className="admin-ia-collected-description"><span>Descrição coletada</span><p>{summary.description}</p></div>}

      {flow.action === ACTION_PRODUCT && (
        <div className="admin-ia-registration-links">
          {originalUrl && <div><span>Link do produto</span><a href={originalUrl} target="_blank" rel="noreferrer">{originalUrl}</a></div>}
          {affiliateUrl && <div><span>Link afiliado</span><a href={affiliateUrl} target="_blank" rel="noreferrer">{affiliateUrl}</a></div>}
          {summary.marketplaceCode && <div><span>Código marketplace</span><strong>{summary.marketplaceCode}</strong></div>}
          {summary.priceSource && <div><span>Fonte do preço</span><strong>{summary.priceSource}</strong></div>}
        </div>
      )}

      {technicalEntries.length > 0 && <div className="admin-ia-collected-data"><span>Dados coletados pela IA</span><div>{technicalEntries.map(([key, value]) => <p key={key}><b>{humanizeField(key)}</b><strong>{String(value)}</strong></p>)}</div></div>}
      {flow.action === ACTION_HARDWARE && price && <p className="admin-ia-registration-note">O preço foi encontrado no anúncio apenas para conferência e não será salvo no Hardware.</p>}
      {flow.action === ACTION_PRODUCT && !price && <p className="admin-ia-registration-note">Os dados do Produto foram preservados, mas o preço não foi identificado. Abra o cadastro para informar somente o preço que faltou.</p>}
      {summary.actions.length > 0 && <div className="admin-ia-registration-plan"><span>Plano do backend</span><strong>{summary.actions.map((item) => String(item).replaceAll('_', ' ')).join(' → ')}</strong></div>}
      {summary.warnings.length > 0 && <div className="admin-ia-registration-warning"><strong>Revisar</strong>{summary.warnings.slice(0, 4).map((item, index) => <span key={index}>{String(item)}</span>)}</div>}

      {!flow.backendReady && <p className="admin-ia-registration-note">A análise por URL já funciona. O cadastro automático pelo chat será ativado quando as rotas do backend estiverem disponíveis; por enquanto, abra o formulário com a URL já preenchida.</p>}

      <div className="admin-ia-registration-actions">
        <button type="button" className="btn btn-secundario btn-pequeno" onClick={onCancel} disabled={sending}>Cancelar</button>
        {flow.backendReady && <button type="button" className="btn btn-secundario btn-pequeno" onClick={onOpenForm} disabled={sending}>{flow.action === ACTION_PRODUCT && !price ? 'Abrir cadastro e informar preço' : 'Corrigir dados'}</button>}
        {flow.backendReady
          ? <button type="button" className="btn btn-primario btn-pequeno" onClick={onConfirm} disabled={sending || !flow.preview?.tokenConfirmacao || ((!flow.manualComplete) && (flow.preview?.podeConfirmar === false || readiness.ready === false || readiness.enabled === false))}>{sending ? 'Confirmando...' : 'Confirmar e publicar'}</button>
          : <button type="button" className="btn btn-primario btn-pequeno" onClick={onOpenForm} disabled={sending}>Abrir cadastro</button>}
      </div>
    </section>
  )
}

function BuildRegistrationPreview({ flow, onConfirm, onCancel, sending }) {
  const build = flow?.build || {}
  const components = Array.isArray(build.componentes) ? build.componentes : []
  return (
    <section className="admin-ia-registration-card" aria-label="Prévia do PC Montado">
      <div className="admin-ia-registration-head">
        <span className="admin-ia-registration-placeholder" aria-hidden="true">PC</span>
        <div>
          <small>{build.categoria || 'PC Montado'}</small>
          <strong>{build.nome || 'PC Montado'}</strong>
          <span>{[build.finalidade, build.resolucaoRecomendada].filter(Boolean).join(' · ') || 'Configuração completa'}</span>
        </div>
      </div>
      <div className="admin-ia-build-summary">
        {components.map((component) => (
          <div key={`${component.categoria}-${component.hardwareId}`}>
            <span>{component.categoria.replaceAll('_', ' ')}</span>
            <strong>{component.nome || `Hardware #${component.hardwareId}`}</strong>
            <small>{[component.marca, component.modelo].filter(Boolean).join(' · ') || `ID ${component.hardwareId}`}</small>
          </div>
        ))}
      </div>
      <p className="admin-ia-registration-note">
        O backend vai validar compatibilidade, consumo e componentes obrigatórios antes de publicar.
      </p>
      <div className="admin-ia-registration-actions">
        <button type="button" className="btn btn-secundario btn-pequeno" onClick={onCancel} disabled={sending}>Cancelar</button>
        <button type="button" className="btn btn-primario btn-pequeno" onClick={onConfirm} disabled={sending}>
          {sending ? 'Publicando...' : 'Confirmar e publicar PC'}
        </button>
      </div>
    </section>
  )
}

export default function AdminAssistant({ open, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = String(user?.papel || '').toUpperCase()
  const canCreateHardware = role === 'ADMIN'
  const canCreateProduct = role === 'ADMIN'
  const canCreateBuild = role === 'ADMIN'
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistente', text: 'Posso ajudar a revisar cadastros, organizar dados e explicar o estado do painel.' }])
  const [flow, setFlow] = useState(null)
  const activeFlowId = useRef(0)
  const context = useMemo(() => ({ rota: location.pathname, area: 'admin' }), [location.pathname])

  async function startBuildRegistration() {
    const flowId = activeFlowId.current + 1
    activeFlowId.current = flowId
    setSending(true)
    setDraft('')
    try {
      const items = await adminService.hardwares.listForBuild()
      if (activeFlowId.current !== flowId) return
      const hardwares = (Array.isArray(items) ? items : []).filter(
        (hardware) => hardware?.ativo !== false && hardware?.publicado === true,
      )
      if (!hardwares.length) {
        setMessages((current) => [...current, {
          role: 'assistente',
          text: 'Não encontrei Hardwares ativos e publicados para montar o PC. Cadastre/publique as peças primeiro.',
        }])
        return
      }
      setFlow({
        flowId,
        action: ACTION_BUILD,
        step: 'BUILD_URL',
        url: '',
        hardwares,
        buildCandidates: [],
        build: {
          nome: '',
          finalidade: '',
          resolucaoRecomendada: '',
          categoria: 'PC Montado',
          publicado: true,
          ativo: true,
          componentes: [],
        },
      })
      setMessages((current) => [...current, {
        role: 'assistente',
        text: 'Cole o link do PC montado. Vou extrair a configuração e vincular automaticamente as peças que já existirem em Hardwares. Depois pergunto somente o que faltar.',
      }])
    } catch (error) {
      if (activeFlowId.current !== flowId) return
      setMessages((current) => [...current, {
        role: 'assistente',
        text: error?.message || 'Não consegui carregar os Hardwares para montar o PC.',
      }])
    } finally {
      if (activeFlowId.current === flowId) setSending(false)
    }
  }

  async function analyzeBuildLink(url) {
    const flowId = flow?.flowId
    if (!flowId || activeFlowId.current !== flowId) return
    setSending(true)
    try {
      const preview = await adminService.ai.importLink(url, 'PC_MONTADO')
      if (activeFlowId.current !== flowId) return

      const source = getAiPayload(preview)
      const componentes = buildLinkedComponents(preview, flow.hardwares || [])
      const build = {
        ...(flow.build || {}),
        nome: clean(source?.nome),
        finalidade: clean(source?.finalidade),
        resolucaoRecomendada: clean(source?.resolucaoRecomendada || source?.resolucao),
        categoria: clean(source?.categoria) || buildCategoryFromPurpose(source?.finalidade),
        descricao: clean(source?.descricao),
        imagemUrl: clean(source?.imagemUrl),
        publicado: true,
        ativo: true,
        componentes,
      }

      const infoQuestions = BUILD_INFO_QUESTIONS.filter((question) => !clean(build[question.field]))
      if (infoQuestions.length > 0) {
        setFlow((current) => current && current.flowId === flowId ? {
          ...current,
          step: 'BUILD_INFO',
          url,
          preview,
          build,
          buildInfoQuestions: infoQuestions,
          infoIndex: 0,
          componentIndex: nextBuildComponentIndex(componentes, 0),
        } : current)
        setMessages((current) => [...current, {
          role: 'assistente',
          text: `A IA analisou o link e vinculou ${componentes.length} peça(s). ${infoQuestions[0].prompt}`,
        }])
        return
      }

      const nextIndex = nextBuildComponentIndex(componentes, 0)
      if (nextIndex >= BUILD_COMPONENT_STEPS.length) {
        setFlow((current) => current && current.flowId === flowId ? {
          ...current,
          step: 'BUILD_PREVIEW',
          url,
          preview,
          build,
          componentIndex: nextIndex,
          buildCandidates: [],
        } : current)
        setMessages((current) => [...current, {
          role: 'assistente',
          text: `A IA conseguiu vincular ${componentes.length} peça(s) do anúncio ao catálogo. Confira a prévia e confirme para validar/publicar.`,
        }])
        return
      }

      const nextStep = BUILD_COMPONENT_STEPS[nextIndex]
      setFlow((current) => current && current.flowId === flowId ? {
        ...current,
        step: 'BUILD_COMPONENT',
        url,
        preview,
        build,
        componentIndex: nextIndex,
        buildCandidates: [],
      } : current)
      setMessages((current) => [...current, {
        role: 'assistente',
        text: `A IA vinculou ${componentes.length} peça(s). Não consegui vincular a ${nextStep.label}. ${buildComponentPrompt(nextStep)}`,
      }])
    } catch (error) {
      if (activeFlowId.current !== flowId) return
      setMessages((current) => [...current, {
        role: 'assistente',
        text: error?.message || 'Não consegui analisar esse PC montado pelo link.',
      }])
    } finally {
      if (activeFlowId.current === flowId) setSending(false)
    }
  }

  function appendBuildComponent(hardware) {
    const stepIndex = Number(flow?.componentIndex || 0)
    const step = BUILD_COMPONENT_STEPS[stepIndex]
    if (!step || !hardware) return
    const component = {
      hardwareId: Number(hardware.id),
      categoria: step.categoria,
      quantidade: 1,
      ordem: stepIndex,
      nome: clean(hardware.nome) || `Hardware #${hardware.id}`,
      marca: clean(hardware.marca),
      modelo: clean(hardware.modelo),
    }
    const componentes = [
      ...(Array.isArray(flow?.build?.componentes) ? flow.build.componentes : []).filter(
        (item) => item.categoria !== step.categoria,
      ),
      component,
    ].sort((a, b) => a.ordem - b.ordem)
    const nextIndex = nextBuildComponentIndex(componentes, stepIndex + 1)

    if (nextIndex >= BUILD_COMPONENT_STEPS.length) {
      const finalidade = clean(flow?.build?.finalidade)
      setFlow((current) => ({
        ...current,
        step: 'BUILD_PREVIEW',
        componentIndex: nextIndex,
        buildCandidates: [],
        build: {
          ...current.build,
          categoria: current.build?.categoria || buildCategoryFromPurpose(finalidade),
          componentes,
        },
      }))
      setMessages((current) => [...current, {
        role: 'assistente',
        text: 'Configuração concluída. Confira a prévia abaixo. Ao confirmar, o backend valida compatibilidade e publica o PC.',
      }])
      return
    }

    const nextStep = BUILD_COMPONENT_STEPS[nextIndex]
    setFlow((current) => ({
      ...current,
      step: 'BUILD_COMPONENT',
      componentIndex: nextIndex,
      buildCandidates: [],
      build: { ...current.build, componentes },
    }))
    setMessages((current) => [...current, {
      role: 'assistente',
      text: `${component.nome} selecionado. ${buildComponentPrompt(nextStep)}`,
    }])
  }

  function skipBuildComponent() {
    const index = Number(flow?.componentIndex || 0)
    const step = BUILD_COMPONENT_STEPS[index]
    if (!step?.optional) {
      setMessages((current) => [...current, { role: 'assistente', text: `${step?.label || 'Esse componente'} é obrigatório para publicar o PC.` }])
      return
    }
    const nextIndex = nextBuildComponentIndex(flow?.build?.componentes || [], index + 1)
    if (nextIndex >= BUILD_COMPONENT_STEPS.length) {
      setFlow((current) => ({ ...current, step: 'BUILD_PREVIEW', componentIndex: nextIndex, buildCandidates: [] }))
      setMessages((current) => [...current, { role: 'assistente', text: 'Configuração concluída. Confira a prévia e confirme para validar/publicar.' }])
      return
    }
    const nextStep = BUILD_COMPONENT_STEPS[nextIndex]
    setFlow((current) => ({ ...current, step: 'BUILD_COMPONENT', componentIndex: nextIndex, buildCandidates: [] }))
    setMessages((current) => [...current, { role: 'assistente', text: buildComponentPrompt(nextStep) }])
  }

  async function answerBuildFlow(text) {
    if (flow?.step === 'BUILD_INFO') {
      const questions = Array.isArray(flow?.buildInfoQuestions) && flow.buildInfoQuestions.length
        ? flow.buildInfoQuestions
        : BUILD_INFO_QUESTIONS
      const index = Number(flow?.infoIndex || 0)
      const question = questions[index]
      if (!question) return
      const skipped = question.field !== 'nome' && isSkipAnswer(text)
      const value = skipped ? '' : clean(text)
      if (question.field === 'nome' && value.length < 2) {
        setMessages((current) => [...current, { role: 'assistente', text: 'Informe um nome com pelo menos 2 caracteres.' }])
        return
      }
      const nextIndex = index + 1
      const nextBuild = {
        ...(flow.build || {}),
        [question.field]: value,
        ...(question.field === 'finalidade' ? { categoria: buildCategoryFromPurpose(value) } : {}),
      }
      if (nextIndex < questions.length) {
        setFlow((current) => ({ ...current, infoIndex: nextIndex, build: nextBuild }))
        setMessages((current) => [...current, { role: 'assistente', text: questions[nextIndex].prompt }])
        return
      }
      const componentIndex = nextBuildComponentIndex(nextBuild.componentes || [], 0)
      if (componentIndex >= BUILD_COMPONENT_STEPS.length) {
        setFlow((current) => ({ ...current, step: 'BUILD_PREVIEW', componentIndex, build: nextBuild, buildCandidates: [] }))
        setMessages((current) => [...current, { role: 'assistente', text: 'Os dados do link ficaram completos. Confira a prévia e confirme para validar/publicar.' }])
        return
      }
      setFlow((current) => ({ ...current, step: 'BUILD_COMPONENT', componentIndex, build: nextBuild, buildCandidates: [] }))
      setMessages((current) => [...current, { role: 'assistente', text: buildComponentPrompt(BUILD_COMPONENT_STEPS[componentIndex]) }])
      return
    }

    if (flow?.step === 'BUILD_COMPONENT' || flow?.step === 'BUILD_CANDIDATE') {
      const index = Number(flow?.componentIndex || 0)
      const step = BUILD_COMPONENT_STEPS[index]
      if (!step) return
      if (step.optional && isSkipAnswer(text)) {
        skipBuildComponent()
        return
      }
      const term = normalizedAnswerKey(text)
      const candidates = (flow.hardwares || [])
        .filter((hardware) => String(hardware?.categoria || '').toUpperCase() === step.categoria)
        .filter((hardware) => {
          if (!term) return false
          if (/^\d+$/.test(term) && Number(hardware.id) === Number(term)) return true
          return hardwareSearchText(hardware).includes(term)
        })
        .slice(0, 8)

      if (!candidates.length) {
        setMessages((current) => [...current, {
          role: 'assistente',
          text: `Não encontrei ${step.label} publicado com "${text}". Tente outro nome/modelo ou ID.${step.optional ? ' Você também pode digitar "pular".' : ''}`,
        }])
        return
      }
      if (candidates.length === 1) {
        appendBuildComponent(candidates[0])
        return
      }

      setFlow((current) => ({ ...current, step: 'BUILD_CANDIDATE', buildCandidates: candidates }))
      setMessages((current) => [...current, {
        role: 'assistente',
        text: `Encontrei ${candidates.length} opções de ${step.label}. Escolha uma nos botões logo acima da caixa de mensagem.`,
      }])
    }
  }

  async function confirmBuildRegistration() {
    if (flow?.action !== ACTION_BUILD || flow?.step !== 'BUILD_PREVIEW' || sending) return
    const flowId = flow?.flowId
    const build = flow.build || {}
    const componentes = (Array.isArray(build.componentes) ? build.componentes : []).map((item, index) => ({
      hardwareId: Number(item.hardwareId),
      categoria: item.categoria,
      quantidade: Number(item.quantidade || 1),
      ordem: index,
    }))
    const componentNames = (build.componentes || []).map((item) => item.nome).filter(Boolean)
    const finalidade = clean(build.finalidade)
    const body = {
      nome: clean(build.nome),
      categoria: clean(build.categoria) || buildCategoryFromPurpose(finalidade),
      ...(finalidade ? { finalidade } : {}),
      ...(clean(build.resolucaoRecomendada) ? { resolucaoRecomendada: clean(build.resolucaoRecomendada) } : {}),
      descricao: `PC montado${finalidade ? ` para ${finalidade}` : ''} com ${componentNames.join(', ')}.`,
      publicado: true,
      ativo: true,
      componentes,
      configuracao3D: {},
    }

    setSending(true)
    try {
      const saved = await adminService.builds.create(body)
      if (activeFlowId.current !== flowId) return
      setMessages((current) => [...current, {
        role: 'assistente',
        text: `PC montado publicado com sucesso: #${saved?.id || '?'} · ${saved?.produto?.nome || build.nome}.`,
      }])
      setFlow(null)
    } catch (error) {
      if (activeFlowId.current !== flowId) return
      setMessages((current) => [...current, {
        role: 'assistente',
        text: error?.message || 'Não foi possível publicar o PC montado. Revise a compatibilidade dos componentes.',
      }])
    } finally {
      if (activeFlowId.current === flowId) setSending(false)
    }
  }

  function startRegistration(action) {
    const label = action === ACTION_PRODUCT ? 'Produto' : 'Hardware'
    const flowId = activeFlowId.current + 1
    activeFlowId.current = flowId
    setFlow({ flowId, action, step: 'URL', url: '', affiliateUrl: '', preview: null, backendReady: false })
    setDraft('')
    setMessages((current) => [...current, {
      role: 'assistente',
      text: action === ACTION_PRODUCT
        ? 'Cole o link do produto e o seu link afiliado nos campos abaixo. Funciona com Mercado Livre, Shopee e Magazine Luiza/Magalu. Primeiro eu analiso e sempre mostro a prévia; o cadastro só acontece depois que você confirmar.'
        : `Cadastrar ${label}: cole o link abaixo. Vou analisar a ficha técnica antes de qualquer cadastro.`,
    }])
  }

  function cancelRegistration() {
    const wasBuild = flow?.action === ACTION_BUILD
    activeFlowId.current += 1
    setSending(false)
    setFlow(null)
    setDraft('')
    setMessages((current) => [...current, {
      role: 'assistente',
      text: wasBuild
        ? 'Cadastro do PC montado cancelado. Nenhum registro foi criado.'
        : 'Cadastro cancelado. Nenhum registro foi criado.',
    }])
  }

  async function finishRegistration(preview, adjustments = {}, flowId = null) {
    const result = await adminService.chatbot.confirmRegistration({
      tokenConfirmacao: preview.tokenConfirmacao,
      confirmar: true,
      ...(Object.keys(adjustments || {}).length ? { ajustes: adjustments } : {}),
    })
    if (flowId && activeFlowId.current !== flowId) return result
    const hardware = result?.hardware
    const product = result?.produto
    const offer = result?.oferta
    const parts = [
      hardware?.id ? `Hardware #${hardware.id} ${String(hardware.acao || '').toLowerCase()}` : '',
      product?.id ? `Produto #${product.id} ${String(product.acao || '').toLowerCase()}` : '',
      offer?.id ? `Oferta #${offer.id} ${String(offer.acao || '').toLowerCase()}` : '',
    ].filter(Boolean)
    const prefix = 'Cadastro concluído.'
    setMessages((current) => [...current, { role: 'assistente', text: parts.length ? `${prefix} ${parts.join(' · ')}` : responseText(result) }])
    setFlow(null)
    return result
  }

  async function analyzeRegistration(url, affiliateUrl = '') {
    const flowId = flow?.flowId
    if (!flowId || activeFlowId.current !== flowId) return
    setSending(true)
    try {
      try {
        const body = {
          acao: flow.action,
          url,
          ...(flow.action === ACTION_PRODUCT && affiliateUrl ? { urlAfiliada: affiliateUrl } : {}),
        }
        const result = await adminService.chatbot.analyzeRegistration(body)
        if (activeFlowId.current !== flowId) return
        const readiness = getAiReadiness(result)
        const warnings = Array.isArray(result?.avisos) ? result.avisos : []
        const safePreview = Boolean(
          result?.podeConfirmar === true
          && readiness.ready !== false
          && readiness.enabled !== false
          && warnings.length === 0
          && getAiMissingFields(result).length === 0
          && getAiConflicts(result).length === 0
        )
        const questions = buildRegistrationQuestions(result, flow.action)
        if (questions.length > 0) {
          setFlow((current) => ({
            ...current,
            step: 'QUESTIONS',
            url,
            affiliateUrl,
            preview: result,
            backendReady: true,
            questions,
            questionIndex: 0,
            answers: {},
            adjustments: {},
            manualComplete: false,
          }))
          setMessages((current) => [...current, {
            role: 'assistente',
            text: `A análise ficou incompleta. Vou pedir só o que faltou. ${questions[0].prompt}`,
          }])
          return
        }
        setFlow((current) => ({ ...current, step: 'PREVIEW', url, affiliateUrl, preview: result, backendReady: true, questions: [], adjustments: {}, manualComplete: false }))
        setMessages((current) => [...current, {
          role: 'assistente',
          text: safePreview
            ? 'Análise concluída e sem conflitos. Confira a prévia abaixo e clique em Confirmar cadastro para gravar.'
            : 'Análise concluída. Revise a prévia abaixo, especialmente os avisos, antes de confirmar.',
        }])
        return
      } catch (error) {
        if (!unsupportedChatbotRoute(error)) throw error
      }

      const preview = await adminService.ai.importLink(url)
      if (activeFlowId.current !== flowId) return
      const previewWithAffiliate = flow.action === ACTION_PRODUCT && affiliateUrl
        ? {
            ...preview,
            ofertaColetada: {
              ...(preview?.ofertaColetada || {}),
              urlOriginal: preview?.ofertaColetada?.urlOriginal || url,
              urlAfiliada: affiliateUrl,
            },
          }
        : preview
      setFlow((current) => ({ ...current, step: 'PREVIEW', url, affiliateUrl, preview: previewWithAffiliate, backendReady: false }))
      setMessages((current) => [...current, { role: 'assistente', text: 'A IA analisou o link. O backend de confirmação automática ainda não está disponível, então deixei a prévia pronta para abrir no formulário.' }])
    } catch (error) {
      if (activeFlowId.current !== flowId) return
      setFlow((current) => current && current.flowId === flowId ? { ...current, step: 'URL', preview: null } : current)
      setMessages((current) => [...current, { role: 'assistente', text: error?.message || 'Não foi possível analisar esse link.' }])
    } finally {
      if (activeFlowId.current === flowId) setSending(false)
    }
  }

  async function confirmRegistration() {
    const flowId = flow?.flowId
    const readiness = getAiReadiness(flow?.preview || {})
    const blockedByReadiness = !flow?.manualComplete && (
      flow?.preview?.podeConfirmar === false
      || readiness.ready === false
      || readiness.enabled === false
    )
    if (!flowId || activeFlowId.current !== flowId || !flow?.backendReady || !flow?.preview?.tokenConfirmacao || sending || blockedByReadiness) return
    setSending(true)
    try {
      await finishRegistration(flow.preview, flow.adjustments || {}, flowId)
    } catch (error) {
      if (activeFlowId.current !== flowId) return
      setMessages((current) => [...current, { role: 'assistente', text: error?.message || 'Não foi possível confirmar o cadastro.' }])
    } finally {
      if (activeFlowId.current === flowId) setSending(false)
    }
  }

  function openFallbackForm() {
    if (!flow?.preview) return
    const url = clean(flow.url)
    const currentPayload = getAiPayload(flow.preview)
    const analysis = flow.preview?.analise || flow.preview?.analysis || {}
    const hardwareData = analysis?.hardware?.dadosDetectados || analysis?.hardware?.dados || analysis?.hardware?.data || {}
    const productData = analysis?.produto?.dadosDetectados || analysis?.produto?.dados || analysis?.produto?.data || {}
    const offerData = analysis?.oferta?.dadosDetectados || analysis?.oferta?.dados || analysis?.oferta?.data || {}
    const category = analysis?.categoria || hardwareData?.categoria || productData?.categoria
    const transferable = Object.keys(currentPayload).length
      ? flow.preview
      : {
          ...flow.preview,
          categoriaSugerida: category,
          cadastroSugerido: {
            ...(flow.preview?.cadastroSugerido || {}),
            payload: { ...hardwareData, ...productData, ...(category ? { categoria: category } : {}) },
          },
          ofertaColetada: Object.keys(offerData).length ? offerData : flow.preview?.ofertaColetada,
        }

    if (flow.action === ACTION_HARDWARE) {
      storeAiImportPreview({ ...transferable, destinoSugerido: 'HARDWARE', urlOrigem: transferable?.urlOrigem || url })
      navigate('/admin/hardwares/novo?origem=chatbot')
    } else {
      storeAiImportPreview({ ...transferable, destinoSugerido: 'PRODUTO', urlOrigem: transferable?.urlOrigem || url })
      navigate(`/admin/produtos/novo?origem=chatbot${url ? `&url=${encodeURIComponent(url)}` : ''}`)
    }
    onClose?.()
  }

  async function answerRegistrationQuestion(text) {
    const flowId = flow?.flowId
    const question = flow?.questions?.[flow?.questionIndex || 0]
    if (!flowId || activeFlowId.current !== flowId || !question) return
    setSending(true)
    try {
      const field = question.field
      let value = field === 'categoria' ? normalizeCategoryAnswer(text) : parseQuestionValue(field, text)
      if (value === null || value === '') {
        setMessages((current) => [...current, { role: 'assistente', text: `Não consegui entender esse valor. ${question.prompt}` }])
        return
      }

      const answers = { ...(flow.answers || {}), [field]: value }
      let preview = flow.preview
      let adjustments = {
        ...(flow.adjustments || {}),
        dadosCorrigidos: { ...(flow.adjustments?.dadosCorrigidos || {}) },
      }

      if (field === 'categoria') {
        adjustments.categoria = value
        const body = {
          acao: flow.action,
          url: flow.url,
          ...(flow.action === ACTION_PRODUCT && flow.affiliateUrl ? { urlAfiliada: flow.affiliateUrl } : {}),
          categoriaEsperada: value,
        }
        preview = await adminService.chatbot.analyzeRegistration(body)
        if (activeFlowId.current !== flowId) return
      } else if (field === 'preco' || field === 'precoAnterior') {
        adjustments[field] = value
      } else {
        const category = adjustments.categoria || normalizeAutomaticPreview(preview).category
        const specKey = SPEC_FIELD_BY_CATEGORY[category]
        const technicalMissing = getAiMissingFields(preview).includes(field)
        if (technicalMissing && specKey) {
          adjustments.dadosCorrigidos[specKey] = {
            ...(adjustments.dadosCorrigidos[specKey] || {}),
            [field]: value,
          }
        } else {
          adjustments.dadosCorrigidos[field] = value
        }
      }

      const remaining = buildRegistrationQuestions(preview, flow.action, answers)
      if (remaining.length === 0) {
        setFlow((current) => ({
          ...current,
          step: 'PREVIEW',
          preview,
          answers,
          questions: [],
          questionIndex: 0,
          adjustments,
          manualComplete: true,
          backendReady: true,
        }))
        setMessages((current) => [...current, {
          role: 'assistente',
          text: 'Pronto. Completei a prévia com as suas respostas. Confira tudo abaixo; o cadastro só será gravado quando você clicar em Confirmar cadastro.',
        }])
        return
      }

      setFlow((current) => ({
        ...current,
        step: 'QUESTIONS',
        preview,
        answers,
        questions: remaining,
        questionIndex: 0,
        adjustments,
        backendReady: true,
      }))
      setMessages((current) => [...current, { role: 'assistente', text: remaining[0].prompt }])
    } catch (error) {
      if (activeFlowId.current !== flowId) return
      setMessages((current) => [...current, {
        role: 'assistente',
        text: error?.message || 'Não consegui aplicar essa resposta. Tente novamente.',
      }])
    } finally {
      if (activeFlowId.current === flowId) setSending(false)
    }
  }

  async function send(event) {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || sending) return

    const next = [...messages, { role: 'usuario', text }]
    setMessages(next)
    setDraft('')

    if (flow?.action === ACTION_BUILD && ['BUILD_INFO', 'BUILD_COMPONENT', 'BUILD_CANDIDATE'].includes(flow?.step)) {
      await answerBuildFlow(text)
      return
    }

    if (flow?.step === 'QUESTIONS') {
      await answerRegistrationQuestion(text)
      return
    }

    setSending(true)
    try {
      const historico = next.slice(-8).map((item) => ({ papel: item.role === 'usuario' ? 'usuario' : 'assistente', conteudo: item.text }))
      const result = await adminService.ai.chat({ mensagem: text, historico, contexto: context })
      setMessages((current) => [...current, { role: 'assistente', text: responseText(result) }])
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistente', text: error?.message || 'A IA administrativa não respondeu.' }])
    } finally {
      setSending(false)
    }
  }

  const buildStep = flow?.action === ACTION_BUILD ? BUILD_COMPONENT_STEPS[Number(flow?.componentIndex || 0)] : null
  const buildInfoQuestions = Array.isArray(flow?.buildInfoQuestions) && flow.buildInfoQuestions.length
    ? flow.buildInfoQuestions
    : BUILD_INFO_QUESTIONS
  const inputPlaceholder = flow?.action === ACTION_BUILD && flow?.step === 'BUILD_INFO'
    ? (buildInfoQuestions[Number(flow?.infoIndex || 0)]?.prompt || 'Responda para continuar...')
    : flow?.action === ACTION_BUILD && ['BUILD_COMPONENT', 'BUILD_CANDIDATE'].includes(flow?.step)
      ? buildComponentPrompt(buildStep)
      : flow?.step === 'QUESTIONS'
        ? (flow?.questions?.[flow?.questionIndex || 0]?.prompt || 'Responda o campo que falta...')
        : 'Pergunte sobre o catálogo...'

  const stickyReadiness = getAiReadiness(flow?.preview || {})
  const showStickyConfirm = Boolean(
    flow?.step === 'PREVIEW'
    && flow?.backendReady
    && flow?.preview?.tokenConfirmacao
  )
  const showStickyBuildConfirm = flow?.action === ACTION_BUILD && flow?.step === 'BUILD_PREVIEW'
  const stickyConfirmDisabled = Boolean(
    sending
    || (
      !flow?.manualComplete
      && (
        flow?.preview?.podeConfirmar === false
        || stickyReadiness.ready === false
        || stickyReadiness.enabled === false
      )
    )
  )

  return (
    <aside className="admin-ia-painel" data-aberto={open ? 'true' : 'false'} aria-hidden={!open}>
      <header className="admin-ia-cabecalho"><div className="admin-ia-cabecalho-info"><span className="admin-ia-cabecalho-icone">✦</span><div><strong>Assistente Admin</strong><small>Backend / catálogo</small></div></div><button className="admin-ia-fechar" type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      <div className="admin-ia-msgs" aria-live="polite">
        {!flow && (canCreateProduct || canCreateHardware || canCreateBuild) && <div className="admin-ia-quick-actions" aria-label="Ações rápidas do assistente">
          {canCreateProduct && <button type="button" onClick={() => startRegistration(ACTION_PRODUCT)}><span aria-hidden="true">＋</span><strong>Cadastrar Produto</strong><small>2 links → IA → cadastro</small></button>}
          {canCreateHardware && <button type="button" onClick={() => startRegistration(ACTION_HARDWARE)}><span aria-hidden="true">◇</span><strong>Cadastrar Hardware</strong><small>Link → ficha técnica</small></button>}
          {canCreateBuild && <button type="button" onClick={startBuildRegistration}><span aria-hidden="true">PC</span><strong>Cadastrar PC Montado</strong><small>Link → IA → peças → publicar</small></button>}
        </div>}
        {messages.map((message,index)=><div key={`${message.role}-${index}`} className={`admin-ia-chat-msg admin-ia-chat-msg--${message.role}`}>{message.text}</div>)}
        {flow?.step === 'PREVIEW' && <RegistrationPreview flow={flow} onConfirm={confirmRegistration} onCancel={cancelRegistration} onOpenForm={openFallbackForm} sending={sending} />}
        {flow?.step === 'BUILD_PREVIEW' && <BuildRegistrationPreview flow={flow} onConfirm={confirmBuildRegistration} onCancel={cancelRegistration} sending={sending} />}
        {sending&&<div className="admin-ia-chat-digitando"><span/><span/><span/></div>}
      </div>
      {['URL', 'BUILD_URL'].includes(flow?.step)
        ? <>
            {flow && <div className="admin-ia-flow-cancel" aria-label="Cancelar cadastro em andamento">
              <span><strong>Cadastro em andamento</strong><small>Você pode cancelar a qualquer momento.</small></span>
              <button type="button" className="btn btn-secundario btn-pequeno" onClick={cancelRegistration}>Cancelar cadastro</button>
            </div>}
            <RegistrationLinkForm
            flow={flow}
            onChange={(field, value) => setFlow((current) => current ? { ...current, [field]: value } : current)}
            onSubmit={flow?.action === ACTION_BUILD ? analyzeBuildLink : analyzeRegistration}
            sending={sending}
          />
          </>
        : <>
            {flow && <div className="admin-ia-flow-cancel" aria-label="Cancelar cadastro em andamento">
              <span><strong>Cadastro em andamento</strong><small>Você pode cancelar a qualquer momento.</small></span>
              <button type="button" className="btn btn-secundario btn-pequeno" onClick={cancelRegistration}>Cancelar cadastro</button>
            </div>}
            {!flow && (canCreateProduct || canCreateHardware || canCreateBuild) && <div className="admin-ia-quick-actions admin-ia-quick-actions--bottom" aria-label="Ações de cadastro junto da caixa de mensagem">
              {canCreateProduct && <button type="button" onClick={() => startRegistration(ACTION_PRODUCT)}><span aria-hidden="true">＋</span><strong>Cadastrar Produto</strong><small>2 links → IA → cadastro</small></button>}
              {canCreateHardware && <button type="button" onClick={() => startRegistration(ACTION_HARDWARE)}><span aria-hidden="true">◇</span><strong>Cadastrar Hardware</strong><small>Link → ficha técnica</small></button>}
              {canCreateBuild && <button type="button" onClick={startBuildRegistration}><span aria-hidden="true">PC</span><strong>Cadastrar PC Montado</strong><small>Link → IA → peças → publicar</small></button>}
            </div>}
            {flow?.action === ACTION_BUILD && flow?.step === 'BUILD_CANDIDATE' && Array.isArray(flow?.buildCandidates) && flow.buildCandidates.length > 0 && <div className="admin-ia-build-candidates" aria-label="Opções de Hardware">
              {flow.buildCandidates.map((hardware) => <button key={hardware.id} type="button" onClick={() => appendBuildComponent(hardware)} disabled={sending}>
                <strong>{hardware.nome || `Hardware #${hardware.id}`}</strong>
                <small>{[hardware.marca, hardware.modelo].filter(Boolean).join(' · ') || `ID ${hardware.id}`}</small>
              </button>)}
            </div>}
            {showStickyBuildConfirm && <div className="admin-ia-bottom-action" aria-label="Confirmar PC Montado">
              <span><strong>PC pronto para validação</strong><small>O backend confere compatibilidade antes de publicar.</small></span>
              <button type="button" className="btn btn-primario btn-pequeno" onClick={confirmBuildRegistration} disabled={sending}>
                {sending ? 'Publicando...' : 'Confirmar e publicar PC'}
              </button>
            </div>}
            {showStickyConfirm && <div className="admin-ia-bottom-action" aria-label="Ação rápida da prévia">
              <span><strong>Prévia pronta</strong><small>Revise acima se quiser; não precisa subir para confirmar.</small></span>
              <button type="button" className="btn btn-primario btn-pequeno" onClick={confirmRegistration} disabled={stickyConfirmDisabled}>
                {sending ? 'Confirmando...' : 'Confirmar e publicar'}
              </button>
            </div>}
            <form className="admin-ia-entrada" onSubmit={send}><textarea className="admin-ia-textarea" value={draft} onChange={e=>setDraft(e.target.value)} placeholder={inputPlaceholder} maxLength={2000}/><button className="admin-ia-enviar" type="submit" disabled={!draft.trim()||sending}>➤</button></form>
          </>}
    </aside>
  )
}
