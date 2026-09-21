import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { storeAiImportPreview } from '../utils/aiImportTransfer'
import { getAiConflicts, getAiMissingFields, getAiOffer, getAiPayload, getAiReadiness, getAiReconciliation } from '../utils/aiImportContract'

const ACTION_PRODUCT = 'CADASTRAR_PRODUTO'
const ACTION_HARDWARE = 'CADASTRAR_HARDWARE'

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

function RegistrationLinkForm({ flow, onChange, onSubmit, onCancel, sending }) {
  const isProduct = flow?.action === ACTION_PRODUCT
  const productUrl = clean(flow?.url)
  const affiliateUrl = clean(flow?.affiliateUrl)
  const productValid = validPublicUrl(productUrl)
  const affiliateValid = !isProduct || validPublicUrl(affiliateUrl)
  const ready = productValid && affiliateValid && !sending

  return (
    <form className="admin-ia-link-form" onSubmit={(event) => { event.preventDefault(); if (ready) onSubmit(productUrl, affiliateUrl) }}>
      <div className="admin-ia-link-form__head">
        <strong>{isProduct ? 'Analisar produto para cadastro' : 'Analisar Hardware por link'}</strong>
        <small>{isProduct ? 'Mercado Livre e Shopee usam API oficial quando disponível; Magazine Luiza/Magalu usa o extrator específico do ProjetoIA.' : 'A IA pesquisa a ficha técnica antes de cadastrar.'}</small>
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
        <button type="button" className="btn btn-secundario btn-pequeno" onClick={onCancel} disabled={sending}>Cancelar</button>
        <button type="submit" className="btn btn-primario btn-pequeno" disabled={!ready}>
          {sending ? 'Analisando...' : isProduct ? 'Analisar produto' : 'Analisar Hardware'}
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
          ? <button type="button" className="btn btn-primario btn-pequeno" onClick={onConfirm} disabled={sending || !flow.preview?.tokenConfirmacao || ((!flow.manualComplete) && (flow.preview?.podeConfirmar === false || readiness.ready === false || readiness.enabled === false))}>{sending ? 'Confirmando...' : 'Confirmar cadastro'}</button>
          : <button type="button" className="btn btn-primario btn-pequeno" onClick={onOpenForm} disabled={sending}>Abrir cadastro</button>}
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
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistente', text: 'Posso ajudar a revisar cadastros, organizar dados e explicar o estado do painel.' }])
  const [flow, setFlow] = useState(null)
  const context = useMemo(() => ({ rota: location.pathname, area: 'admin' }), [location.pathname])

  function startRegistration(action) {
    const label = action === ACTION_PRODUCT ? 'Produto' : 'Hardware'
    setFlow({ action, step: 'URL', url: '', affiliateUrl: '', preview: null, backendReady: false })
    setDraft('')
    setMessages((current) => [...current, {
      role: 'assistente',
      text: action === ACTION_PRODUCT
        ? 'Cole o link do produto e o seu link afiliado nos campos abaixo. Funciona com Mercado Livre, Shopee e Magazine Luiza/Magalu. Primeiro eu analiso e sempre mostro a prévia; o cadastro só acontece depois que você confirmar.'
        : `Cadastrar ${label}: cole o link abaixo. Vou analisar a ficha técnica antes de qualquer cadastro.`,
    }])
  }

  function cancelRegistration() {
    setFlow(null)
    setDraft('')
    setMessages((current) => [...current, { role: 'assistente', text: 'Cadastro por URL cancelado. Nenhum registro foi criado.' }])
  }

  async function finishRegistration(preview, adjustments = {}) {
    const result = await adminService.chatbot.confirmRegistration({
      tokenConfirmacao: preview.tokenConfirmacao,
      confirmar: true,
      ...(Object.keys(adjustments || {}).length ? { ajustes: adjustments } : {}),
    })
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
    setSending(true)
    try {
      try {
        const body = {
          acao: flow.action,
          url,
          ...(flow.action === ACTION_PRODUCT && affiliateUrl ? { urlAfiliada: affiliateUrl } : {}),
        }
        const result = await adminService.chatbot.analyzeRegistration(body)
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
      setFlow((current) => current ? { ...current, step: 'URL', preview: null } : current)
      setMessages((current) => [...current, { role: 'assistente', text: error?.message || 'Não foi possível analisar esse link.' }])
    } finally {
      setSending(false)
    }
  }

  async function confirmRegistration() {
    const readiness = getAiReadiness(flow?.preview || {})
    if (!flow?.backendReady || !flow?.preview?.tokenConfirmacao || sending || readiness.ready === false || readiness.enabled === false) return
    setSending(true)
    try {
      await finishRegistration(flow.preview, flow.adjustments || {})
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistente', text: error?.message || 'Não foi possível confirmar o cadastro.' }])
    } finally {
      setSending(false)
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
    const question = flow?.questions?.[flow?.questionIndex || 0]
    if (!question) return
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
      setMessages((current) => [...current, {
        role: 'assistente',
        text: error?.message || 'Não consegui aplicar essa resposta. Tente novamente.',
      }])
    } finally {
      setSending(false)
    }
  }

  async function send(event) {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || sending) return

    const next = [...messages, { role: 'usuario', text }]
    setMessages(next)
    setDraft('')

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

  const inputPlaceholder = flow?.step === 'QUESTIONS'
    ? (flow?.questions?.[flow?.questionIndex || 0]?.prompt || 'Responda o campo que falta...')
    : 'Pergunte sobre o catálogo...'

  return (
    <aside className="admin-ia-painel" data-aberto={open ? 'true' : 'false'} aria-hidden={!open}>
      <header className="admin-ia-cabecalho"><div className="admin-ia-cabecalho-info"><span className="admin-ia-cabecalho-icone">✦</span><div><strong>Assistente Admin</strong><small>Backend / catálogo</small></div></div><button className="admin-ia-fechar" type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      <div className="admin-ia-msgs" aria-live="polite">
        {!flow && (canCreateProduct || canCreateHardware) && <div className="admin-ia-quick-actions" aria-label="Ações rápidas do assistente">
          {canCreateProduct && <button type="button" onClick={() => startRegistration(ACTION_PRODUCT)}><span aria-hidden="true">＋</span><strong>Cadastrar Produto</strong><small>2 links → IA → cadastro</small></button>}
          {canCreateHardware && <button type="button" onClick={() => startRegistration(ACTION_HARDWARE)}><span aria-hidden="true">◇</span><strong>Cadastrar Hardware</strong><small>Link → ficha técnica</small></button>}
        </div>}
        {messages.map((message,index)=><div key={`${message.role}-${index}`} className={`admin-ia-chat-msg admin-ia-chat-msg--${message.role}`}>{message.text}</div>)}
        {flow?.step === 'PREVIEW' && <RegistrationPreview flow={flow} onConfirm={confirmRegistration} onCancel={cancelRegistration} onOpenForm={openFallbackForm} sending={sending} />}
        {sending&&<div className="admin-ia-chat-digitando"><span/><span/><span/></div>}
      </div>
      {flow?.step === 'URL'
        ? <RegistrationLinkForm
            flow={flow}
            onChange={(field, value) => setFlow((current) => current ? { ...current, [field]: value } : current)}
            onSubmit={analyzeRegistration}
            onCancel={cancelRegistration}
            sending={sending}
          />
        : <form className="admin-ia-entrada" onSubmit={send}><textarea className="admin-ia-textarea" value={draft} onChange={e=>setDraft(e.target.value)} placeholder={inputPlaceholder} maxLength={2000}/><button className="admin-ia-enviar" type="submit" disabled={!draft.trim()||sending}>➤</button></form>}
    </aside>
  )
}
