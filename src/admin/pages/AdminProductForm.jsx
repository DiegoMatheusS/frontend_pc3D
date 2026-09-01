import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { AdminBack, AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { AdminTechnicalFields, normalizeSpec, productSchemaFor, readSpec } from '../components/AdminTechnicalFields'
import { getSpecializedProductTarget } from '../utils/productRouting'
import { consumeAiImportPreview, storeAiImportPreview } from '../utils/aiImportTransfer'
import { getAiConflicts, getAiDiagnostics, getAiOffer, getAiPayload, getAiReadiness, getAiReconciliation } from '../utils/aiImportContract'

const EMPTY = {
  categoriaId: '', nome: '', marca: '', modelo: '', descricao: '', mpn: '', gtin: '',
  imagemUrl: '', imagemHoverUrl: '', publicado: true, ativo: true, metadados: '{}',
}

const EMPTY_OFFER = {
  parceiroId: '', preco: '', precoAnterior: '', urlOriginal: '', urlAfiliada: '',
  _originalPartnerId: '',
}

const HARDWARE_CATEGORY_ALIASES = {
  PROCESSADOR: ['processadores', 'processador', 'cpu'],
  COOLER: ['coolers', 'cooler'],
  PLACA_MAE: ['placas-mae', 'placa-mae', 'placa mae', 'motherboard'],
  MEMORIA_RAM: ['memorias-ram', 'memoria-ram', 'memoria ram', 'ram'],
  PLACA_VIDEO: ['placas-video', 'placa-video', 'placa de video', 'gpu'],
  ARMAZENAMENTO: ['armazenamento', 'ssd', 'hdd'],
  FONTE: ['fontes', 'fonte', 'psu'],
  GABINETE: ['gabinetes', 'gabinete', 'case'],
  VENTOINHA: ['ventoinhas', 'ventoinha', 'fan', 'fans'],
  MONITOR: ['monitores', 'monitor'],
  MOUSE: ['mouses', 'mouse'],
  TECLADO: ['teclados', 'teclado'],
  FONE: ['fones', 'fone', 'fone de ouvido', 'fones de ouvido'],
  HEADSET: ['headsets', 'headset'],
  MICROFONE: ['microfones', 'microfone'],
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function normalizeGtin(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 32)
}

function validGtin(value) {
  const digits = normalizeGtin(value)
  if (!digits) return true
  if (![8, 12, 13, 14].includes(digits.length)) return false
  const numbers = digits.split('').map(Number)
  const check = numbers.pop()
  let sum = 0
  for (let i = numbers.length - 1, pos = 0; i >= 0; i -= 1, pos += 1) sum += numbers[i] * (pos % 2 === 0 ? 3 : 1)
  return (10 - (sum % 10)) % 10 === check
}

function normalizeProductForm(item = {}) {
  return {
    ...EMPTY,
    ...item,
    categoriaId: item.categoriaId || item.categoria?.id || '',
    nome: String(item.nome ?? ''),
    marca: String(item.marca ?? ''),
    modelo: String(item.modelo ?? ''),
    descricao: String(item.descricao || item.hardware?.descricao || ''),
    mpn: String(item.mpn ?? ''),
    gtin: normalizeGtin(item.gtin),
    imagemUrl: String(item.imagemUrl || item.hardware?.imagemUrl || ''),
    imagemHoverUrl: String(item.imagemHoverUrl || item.hardware?.imagemHoverUrl || ''),
    publicado: Boolean(item.publicado),
    ativo: typeof item.ativo === 'boolean' ? item.ativo : true,
    metadados: JSON.stringify(item.metadados || {}, null, 2),
  }
}

function normalizeOfferForm(item = {}) {
  const parceiroId = item.parceiroId || item.parceiro?.id || ''
  return {
    ...EMPTY_OFFER,
    parceiroId,
    _originalPartnerId: parceiroId,
    preco: item.preco ?? '',
    precoAnterior: item.precoAnterior ?? '',
    urlOriginal: String(item.urlOriginal ?? ''),
    urlAfiliada: String(item.urlAfiliada ?? ''),
  }
}

function normalizeToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function findCategoryFromPreview(categories, sourceCategory) {
  const target = normalizeToken(sourceCategory)
  if (!target) return null
  return categories.find((category) => {
    const candidates = [category?.nome, category?.slug, category?.codigo, category?.categoria]
      .map(normalizeToken)
      .filter(Boolean)
    return candidates.some((candidate) => candidate === target || candidate.includes(target) || target.includes(candidate))
  }) || null
}

function findCategoryFromHardware(categories, hardware = {}) {
  const directId = hardware?.produto?.categoriaId || hardware?.produto?.categoria?.id || hardware?.categoriaProdutoId
  if (directId) {
    const direct = categories.find((category) => Number(category.id) === Number(directId))
    if (direct) return direct
  }

  const directName = hardware?.produto?.categoria?.slug || hardware?.produto?.categoria?.nome || hardware?.categoriaProduto
  const byDirectName = findCategoryFromPreview(categories, directName)
  if (byDirectName) return byDirectName

  const aliases = HARDWARE_CATEGORY_ALIASES[String(hardware?.categoria || '').toUpperCase()] || [hardware?.categoria]
  for (const alias of aliases) {
    const found = findCategoryFromPreview(categories, alias)
    if (found) return found
  }
  return null
}

function hardwareProductId(hardware = {}) {
  return Number(hardware?.produtoId || hardware?.produto?.id) || null
}

function hardwareLabel(hardware = {}) {
  const category = String(hardware.categoria || 'HARDWARE').replaceAll('_', ' ')
  const name = hardware.nome || [hardware.marca, hardware.modelo].filter(Boolean).join(' ') || `Hardware #${hardware.id}`
  const productId = hardwareProductId(hardware)
  return `${category} · ${name}${productId ? ` · Produto #${productId}` : ''}`
}

function technicalFromPreview(schema, source = {}) {
  if (!schema) return {}
  const keys = [...schema.fields.map(([key]) => key), ...(schema.repeaters || []).map((item) => item.key)]
  return Object.fromEntries(keys.flatMap((key) => source[key] !== undefined && source[key] !== null ? [[key, source[key]]] : []))
}


function aiPreviewSource(preview = {}) {
  return getAiPayload(preview)
}

function aiConflictLabels(preview = {}) {
  return getAiConflicts(preview).map((item) => {
    if (typeof item === 'string') return item
    const field = item?.campo || 'campo técnico'
    const banco = item?.valorBanco ?? item?.atual
    const ia = item?.valorIa ?? item?.novo
    if (banco !== undefined || ia !== undefined) return `${field}: banco ${String(banco ?? 'vazio')} · IA ${String(ia ?? 'vazio')}`
    return `Conflito em ${field}`
  })
}

function AiImportContractInfo({ preview }) {
  if (!preview) return null
  const reconciliation = getAiReconciliation(preview)
  const readiness = getAiReadiness(preview)
  const diagnostics = getAiDiagnostics(preview)
  const fillable = Array.isArray(reconciliation?.camposPreenchiveis) ? reconciliation.camposPreenchiveis : []
  const version = cleanText(diagnostics?.service?.versao)
  const source = cleanText(diagnostics?.source?.fonte || diagnostics?.source || preview?.resultadoProdutoIa?.fonte)
  return <>
    {(reconciliation?.produtoExistente || reconciliation?.ofertaExistente) && <div className="admin-import-preview-list warn"><strong>Já existe no CriaByte</strong><ul>
      {reconciliation?.produtoExistente && <li>Este produto já existe no CriaByte.</li>}
      {reconciliation?.ofertaExistente && <li>Já existe uma oferta correspondente.</li>}
    </ul></div>}
    <PreviewList title="Campos que a IA pode completar" items={fillable} />
    <PreviewList title="Conflitos para revisão" items={aiConflictLabels(preview)} tone="warn" />
    {readiness.ready === false && <p className="admin-inline-warning">Alguns campos ainda precisam de revisão antes do cadastro.</p>}
    {(version || source) && <small className="admin-help">{version ? `Projeto IA ${version}` : 'Projeto IA'}{source ? ` · Fonte: ${source}` : ''}</small>}
  </>
}

function findExistingHardwareFromAi(hardwareItems = [], preview = {}) {
  const source = aiPreviewSource(preview)
  const targetCategory = normalizeToken(source.categoria || preview?.categoriaDetectada || preview?.categoriaSugerida)
  const targetBrand = normalizeToken(source.marca)
  const targetModel = normalizeToken(source.modelo)
  const targetMpn = normalizeToken(source.mpn)
  const targetGtin = normalizeGtin(source.gtin || source.ean)
  const targetName = normalizeToken(source.nome)

  const scored = (Array.isArray(hardwareItems) ? hardwareItems : []).flatMap((hardware) => {
    const hardwareCategory = normalizeToken(hardware?.categoria)
    if (targetCategory && hardwareCategory && targetCategory !== hardwareCategory) return []

    const brand = normalizeToken(hardware?.marca || hardware?.produto?.marca)
    const model = normalizeToken(hardware?.modelo || hardware?.produto?.modelo)
    const mpn = normalizeToken(hardware?.mpn || hardware?.produto?.mpn)
    const gtin = normalizeGtin(hardware?.gtin || hardware?.produto?.gtin)
    const name = normalizeToken(hardware?.nome || hardware?.produto?.nome)

    let score = 0
    const reasons = []
    if (targetGtin && gtin && targetGtin === gtin) { score += 140; reasons.push('GTIN') }
    if (targetMpn && mpn && targetMpn === mpn) { score += 110; reasons.push('MPN') }
    if (targetBrand && brand && targetBrand === brand) { score += 25; reasons.push('marca') }
    if (targetModel && model && targetModel === model) { score += 70; reasons.push('modelo') }
    else if (targetModel && name && name.includes(targetModel)) { score += 65; reasons.push('modelo no nome') }
    if (targetName && name && targetName === name) { score += 75; reasons.push('nome') }

    // Não vincula automaticamente por nome/modelo fraco. GTIN/MPN ou marca+modelo exatos são seguros.
    if (score < 90) return []
    return [{ hardware, score, reasons }]
  }).sort((a, b) => b.score - a.score)

  if (!scored.length) return { hardware: null, ambiguous: [] }
  const best = scored[0]
  const tied = scored.filter((item) => item.score === best.score)
  if (tied.length > 1) return { hardware: null, ambiguous: tied.map((item) => item.hardware) }
  return { hardware: best.hardware, ambiguous: [] }
}

function offersForProduct(offers = [], productId) {
  if (!productId) return []
  return offers
    .filter((offer) => Number(offer?.produtoId || offer?.produto?.id) === Number(productId))
    .filter((offer) => String(offer?.status || 'ATIVA').toUpperCase() !== 'DESCONTINUADA')
    .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0))
}

function ofertaInicialUnsupported(error) {
  const text = String(error?.message || error || '').toLowerCase()
  return text.includes('ofertainicial') && (
    text.includes('should not exist') ||
    text.includes('não deve existir') ||
    text.includes('nao deve existir') ||
    text.includes('property') ||
    text.includes('propriedade')
  )
}


function findCategoryFromSuggestion(categories, suggestionCategory) {
  const raw = String(suggestionCategory || '').toUpperCase()
  const aliases = raw === 'NOTEBOOK'
    ? ['notebooks', 'notebook']
    : raw === 'OUTRO'
      ? ['outros', 'outro', 'setup']
      : (HARDWARE_CATEGORY_ALIASES[raw] || [suggestionCategory])
  for (const alias of aliases) {
    const found = findCategoryFromPreview(categories, alias)
    if (found) return found
  }
  return null
}

function technicalFromSuggestion(schema, suggestion = {}) {
  if (!schema) return {}
  const source = suggestion.especificacoes || {}
  const category = String(suggestion.categoria || '').toUpperCase()
  const mapped = { ...source }
  if (category === 'MONITOR' && source.painel !== undefined) mapped.tipoPainel = source.painel
  if (category === 'FONE' && source.conexao !== undefined) mapped.tipoConexao = source.conexao
  return technicalFromPreview(schema, mapped)
}

function PreviewList({ title, items = [], tone = '' }) {
  const clean = (Array.isArray(items) ? items : []).filter(Boolean)
  if (!clean.length) return null
  return <div className={`admin-import-preview-list ${tone}`}><strong>{title}</strong><ul>{clean.map((item, index) => <li key={`${title}-${index}`}>{String(item)}</li>)}</ul></div>
}

export default function AdminProductForm() {
  const { id } = useParams()
  const editing = id && id !== 'novo'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useAdminToast()
  const suggestionOriginId = !editing && searchParams.get('origem') === 'sugestao-oferta' ? searchParams.get('sugestaoId') : ''
  const fromOfferSuggestion = Boolean(suggestionOriginId)
  const { user } = useAuth()
  const role = String(user?.papel || '').toUpperCase()
  const canWriteAi = role === 'ADMIN' || role === 'EDITOR'
  const canImportLink = role === 'ADMIN'

  const [transferredPreview] = useState(() => editing ? null : consumeAiImportPreview())
  const [transferredPreviewApplied, setTransferredPreviewApplied] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [technical, setTechnical] = useState({})
  const [categories, setCategories] = useState([])
  const [hardwares, setHardwares] = useState([])
  const [hardwareSearch, setHardwareSearch] = useState('')
  const [selectedHardwareId, setSelectedHardwareId] = useState('')
  const [hardwareLoading, setHardwareLoading] = useState(!editing)
  const [hardwareError, setHardwareError] = useState('')

  const [partners, setPartners] = useState([])
  const [allOffers, setAllOffers] = useState([])
  const [includeOffer, setIncludeOffer] = useState(!editing)
  const [offerRows, setOfferRows] = useState([{ ...EMPTY_OFFER }])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [importUrl, setImportUrl] = useState(() => transferredPreview?.urlOrigem || searchParams.get('url') || '')
  const [importing, setImporting] = useState(false)
  const [importElapsed, setImportElapsed] = useState(0)
  const importAbortRef = useRef(null)
  const [importPreview, setImportPreview] = useState(transferredPreview)
  const [aiBusy, setAiBusy] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [suggestionPrefill, setSuggestionPrefill] = useState(null)
  const [originMode, setOriginMode] = useState(fromOfferSuggestion ? 'SUGESTAO' : 'ADMIN')
  const [originSuggestionSearch, setOriginSuggestionSearch] = useState('')
  const [originSuggestions, setOriginSuggestions] = useState([])
  const [originSuggestionsLoading, setOriginSuggestionsLoading] = useState(false)

  useEffect(() => {
    if (!importing) {
      setImportElapsed(0)
      return undefined
    }
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      setImportElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [importing])

  useEffect(() => () => {
    importAbortRef.current?.abort()
  }, [])

  const selectedCategory = useMemo(
    () => categories.find((category) => Number(category.id) === Number(form.categoriaId)),
    [categories, form.categoriaId],
  )
  const schema = useMemo(() => productSchemaFor(selectedCategory), [selectedCategory])

  const filteredHardwares = useMemo(() => {
    const terms = String(hardwareSearch || '')
      .trim()
      .split(/\s+/)
      .map(normalizeToken)
      .filter(Boolean)

    return [...hardwares]
      .filter((hardware) => {
        if (!terms.length) return true
        const product = hardware?.produto || {}
        const searchable = normalizeToken([
          hardware.id,
          hardware.categoria,
          hardware.nome,
          hardware.marca,
          hardware.modelo,
          hardware.mpn,
          hardware.gtin,
          hardware.descricao,
          product.nome,
          product.marca,
          product.modelo,
          product.mpn,
          product.gtin,
          product.categoria?.nome,
          product.categoria?.slug,
        ].filter(Boolean).join(' '))
        return terms.every((term) => searchable.includes(term))
      })
      .sort((a, b) => hardwareLabel(a).localeCompare(hardwareLabel(b), 'pt-BR'))
  }, [hardwares, hardwareSearch])

  const selectedHardware = useMemo(
    () => hardwares.find((hardware) => Number(hardware.id) === Number(selectedHardwareId)) || null,
    [hardwares, selectedHardwareId],
  )


  useEffect(() => {
    if (!transferredPreview || transferredPreviewApplied || loading || !categories.length) return
    setTransferredPreviewApplied(true)
    applySmartImportPreview(transferredPreview, false)
  }, [transferredPreview, transferredPreviewApplied, loading, categories.length])
  const selectedLinkedProductId = hardwareProductId(selectedHardware)
  const linkedCount = useMemo(() => hardwares.filter((hardware) => hardwareProductId(hardware)).length, [hardwares])

  useEffect(() => {
    let active = true
    Promise.all([
      adminService.products.categories(),
      adminService.offers.partners().catch(() => []),
      adminService.offers.list().catch(() => []),
      editing ? adminService.products.get(id) : Promise.resolve(null),
      suggestionOriginId ? adminService.offerSuggestions.get(suggestionOriginId) : Promise.resolve(null),
    ])
      .then(([cats, partnerItems, offerItems, item, suggestion]) => {
        if (!active) return
        setCategories(cats)
        setPartners(partnerItems)
        setAllOffers(offerItems)

        if (item) {
          const specialized = getSpecializedProductTarget(item)
          if (specialized?.kind !== 'HARDWARE' && specialized) {
            toast.show(`Este item usa o cadastro especializado de ${specialized.label}. Abrindo a tela correta.`, 'info')
            navigate(specialized.route, { replace: true })
            return
          }

          const next = normalizeProductForm(item)
          setForm(next)
          const cat = cats.find((category) => Number(category.id) === Number(next.categoriaId))
          setTechnical(readSpec(item, productSchemaFor(cat)))

          const existingOffers = offersForProduct(offerItems, item.id)
          if (existingOffers.length) {
            setIncludeOffer(true)
            setOfferRows(existingOffers.map((existingOffer) => ({
              ...normalizeOfferForm(existingOffer),
              id: existingOffer.id,
              status: existingOffer.status || 'ATIVA',
            })))
          } else {
            setIncludeOffer(false)
            setOfferRows([{ ...EMPTY_OFFER }])
          }
          setDirty(false)
        } else if (suggestion) {
          const suggestionCategory = findCategoryFromSuggestion(cats, suggestion.categoria)
          const suggestionSchema = productSchemaFor(suggestionCategory)
          setSuggestionPrefill(suggestion)
          setForm({
            ...EMPTY,
            categoriaId: suggestionCategory?.id || '',
            nome: String(suggestion.nome || ''),
            publicado: true,
            ativo: true,
          })
          setTechnical(technicalFromSuggestion(suggestionSchema, suggestion))
          setIncludeOffer(false)
          setOfferRows([{ ...EMPTY_OFFER }])
          setImportUrl(String(suggestion.urlOriginal || ''))
          setDirty(true)
        } else {
          setDirty(false)
        }
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [id, editing, navigate, toast, suggestionOriginId])

  useEffect(() => {
    if (editing) return
    let active = true
    adminService.hardwares.list()
      .then((items) => {
        if (!active) return
        const list = Array.isArray(items) ? items : []
        setHardwares(list)
        setHardwareError('')
      })
      .catch((err) => {
        if (!active) return
        setHardwareError(err?.message || 'Não foi possível carregar os Hardwares cadastrados.')
      })
      .finally(() => active && setHardwareLoading(false))
    return () => { active = false }
  }, [editing])

  useEffect(() => {
    if (editing || fromOfferSuggestion || role !== 'ADMIN' || originMode !== 'SUGESTAO') {
      setOriginSuggestions([])
      setOriginSuggestionsLoading(false)
      return
    }
    let active = true
    setOriginSuggestionsLoading(true)
    const timer = window.setTimeout(() => {
      adminService.offerSuggestions.list({ status: 'EM_ANALISE', search: originSuggestionSearch.trim() })
        .then((payload) => {
          if (!active) return
          const items = Array.isArray(payload) ? payload : Array.isArray(payload?.sugestoes) ? payload.sugestoes : []
          setOriginSuggestions(items.slice(0, 20))
        })
        .catch(() => { if (active) setOriginSuggestions([]) })
        .finally(() => { if (active) setOriginSuggestionsLoading(false) })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [editing, fromOfferSuggestion, originMode, originSuggestionSearch, role])

  function chooseOriginSuggestion(suggestion) {
    if (!suggestion?.id) return
    navigate(`/admin/produtos/novo?origem=sugestao-oferta&sugestaoId=${encodeURIComponent(suggestion.id)}`)
  }

  useEffect(() => {
    const handler = (event) => {
      if (!dirty || saving) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty, saving])

  const update = (key, value) => {
    setDirty(true)
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateOffer = (index, key, value) => {
    setDirty(true)
    setOfferRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))
  }

  const addOffer = () => {
    setDirty(true)
    if (!includeOffer) {
      setIncludeOffer(true)
      setOfferRows((current) => current.length ? current : [{ ...EMPTY_OFFER }])
      return
    }
    setOfferRows((current) => [...current, { ...EMPTY_OFFER }])
  }

  const removeOffer = async (index) => {
    const row = offerRows[index]
    if (!row) return

    if (row.id) {
      const confirmed = window.confirm(`Excluir a Oferta #${row.id}? Esta ação remove a oferta cadastrada.`)
      if (!confirmed) return
      try {
        await adminService.offers.remove(row.id)
        setAllOffers((current) => current.filter((item) => Number(item?.id) !== Number(row.id)))
        setOfferRows((current) => {
          const next = current.filter((_, rowIndex) => rowIndex !== index)
          if (!next.length) {
            setIncludeOffer(false)
            return [{ ...EMPTY_OFFER }]
          }
          return next
        })
        toast.show('Oferta excluída e descontinuada no cadastro.')
      } catch (err) {
        toast.show(err?.message || 'Não foi possível excluir a Oferta.', 'erro')
      }
      return
    }

    setDirty(true)
    setOfferRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index)
      return next.length ? next : [{ ...EMPTY_OFFER }]
    })
  }

  function changeCategory(value) {
    setDirty(true)
    setForm((current) => ({ ...current, categoriaId: value }))
    setTechnical({})
  }

  function updateTechnical(key, value) {
    setDirty(true)
    setTechnical((current) => ({ ...current, [key]: value }))
  }

  function applyExistingOffers(productId) {
    const existingOffers = offersForProduct(allOffers, productId)
    setIncludeOffer(true)
    setOfferRows(existingOffers.length
      ? existingOffers.map((existingOffer) => ({
          ...normalizeOfferForm(existingOffer),
          id: existingOffer.id,
          status: existingOffer.status || 'ATIVA',
        }))
      : [{ ...EMPTY_OFFER }])
  }

  async function selectHardware(value) {
    setSelectedHardwareId(value)
    if (!value) {
      if (offerRows.some((row) => row.id)) {
        setOfferRows([{ ...EMPTY_OFFER }])
        setIncludeOffer(true)
      }
      return
    }

    setHardwareLoading(true)
    setHardwareError('')
    try {
      const hardware = await adminService.hardwares.get(value)
      const linkedProductId = hardwareProductId(hardware)
      let sourceProduct = hardware?.produto || {}

      if (linkedProductId && (!sourceProduct?.id || !sourceProduct?.categoria)) {
        sourceProduct = await adminService.products.get(linkedProductId).catch(() => sourceProduct)
      }

      const enrichedHardware = { ...hardware, produto: sourceProduct }
      const category = findCategoryFromHardware(categories, enrichedHardware)
      const nextSchema = productSchemaFor(category)
      const technicalSource = {
        ...(hardware?.especificacoes && typeof hardware.especificacoes === 'object' ? hardware.especificacoes : {}),
        ...(nextSchema && sourceProduct?.[nextSchema.key] && typeof sourceProduct[nextSchema.key] === 'object' ? sourceProduct[nextSchema.key] : {}),
      }

      setForm((current) => ({
        ...current,
        categoriaId: category?.id || current.categoriaId,
        nome: String(sourceProduct?.nome ?? hardware?.nome ?? current.nome ?? ''),
        marca: String(hardware?.marca ?? sourceProduct?.marca ?? current.marca ?? ''),
        modelo: String(hardware?.modelo ?? sourceProduct?.modelo ?? current.modelo ?? ''),
        descricao: String(cleanText(sourceProduct?.descricao) || cleanText(hardware?.descricao) || current.descricao || ''),
        mpn: String(hardware?.mpn ?? sourceProduct?.mpn ?? current.mpn ?? ''),
        gtin: normalizeGtin(hardware?.gtin ?? sourceProduct?.gtin ?? current.gtin),
        imagemUrl: String(cleanText(sourceProduct?.imagemUrl) || cleanText(hardware?.imagemUrl) || current.imagemUrl || ''),
        imagemHoverUrl: String(cleanText(sourceProduct?.imagemHoverUrl) || cleanText(hardware?.imagemHoverUrl) || current.imagemHoverUrl || ''),
        publicado: linkedProductId ? Boolean(sourceProduct?.publicado) : current.publicado,
        ativo: linkedProductId && typeof sourceProduct?.ativo === 'boolean' ? sourceProduct.ativo : current.ativo,
        metadados: linkedProductId && sourceProduct?.metadados
          ? JSON.stringify(sourceProduct.metadados, null, 2)
          : current.metadados,
      }))

      if (nextSchema) setTechnical(technicalFromPreview(nextSchema, technicalSource))
      else setTechnical({})

      setHardwares((current) => current.map((item) => Number(item.id) === Number(hardware.id)
        ? { ...item, ...hardware, produto: sourceProduct }
        : item))
      if (linkedProductId) applyExistingOffers(linkedProductId)
      else if (offerRows.some((row) => row.id)) {
        setOfferRows([{ ...EMPTY_OFFER }])
        setIncludeOffer(true)
      }

      setDirty(true)
      if (linkedProductId) {
        toast.show(`Hardware #${hardware.id} já possui o Produto #${linkedProductId}. O cadastro comercial existente será reutilizado, sem duplicar.`)
      } else if (category) {
        toast.show(`Dados do Hardware #${hardware.id} preenchidos. Um novo Produto comercial será criado ao salvar.`)
      } else {
        toast.show(`Dados do Hardware #${hardware.id} preenchidos. Confira a categoria antes de salvar.`, 'alerta')
      }
    } catch (err) {
      setHardwareError(err?.message || 'Não foi possível carregar o Hardware selecionado.')
      toast.show(err?.message || 'Não foi possível carregar o Hardware selecionado.', 'erro')
    } finally {
      setHardwareLoading(false)
    }
  }

  async function importData() {
    if (!canImportLink || !cleanText(importUrl) || importing) return

    importAbortRef.current?.abort()
    const controller = new AbortController()
    importAbortRef.current = controller
    setImporting(true)
    setImportElapsed(0)
    setImportPreview(null)

    try {
      const result = await adminService.ai.importLink(cleanText(importUrl), undefined, {
        signal: controller.signal,
        timeoutMs: 90000,
      })
      if (controller.signal.aborted) return
      setImportPreview(result)
      if (editing && dirty) {
        toast.show('A prévia da IA está pronta. Como existem alterações manuais no formulário, revise e clique em aplicar para não sobrescrever seus ajustes.', 'alerta')
        return
      }
      await applySmartImportPreview(result, false)
    } catch (err) {
      if (err?.code === 'REQUEST_ABORTED') {
        toast.show('Análise cancelada. Você pode tentar novamente quando quiser.', 'alerta')
      } else if (err?.code === 'IA_TIMEOUT') {
        toast.show('A IA demorou mais de 90 segundos para responder. A tela foi liberada para tentar novamente. Se isso continuar no Magazine ou Mercado Livre, o backend/Projeto IA está demorando ou bloqueado.', 'erro')
      } else {
        toast.show(err?.message || 'Não foi possível analisar o link com a IA.', 'erro')
      }
    } finally {
      if (importAbortRef.current === controller) importAbortRef.current = null
      setImporting(false)
    }
  }

  function cancelImportData() {
    importAbortRef.current?.abort()
  }

  async function applySmartImportPreview(preview = importPreview, notify = true) {
    if (!preview) return

    if (preview?.destinoSugerido === 'HARDWARE') {
      // Se o usuário já escolheu um Hardware existente, nunca manda para criar outro.
      if (selectedHardwareId) {
        applyImportPreview(preview, notify, { skipSpecialRouting: true, preserveHardware: true })
        if (notify) toast.show('Dados da IA aplicados ao Produto usando o Hardware já selecionado.')
        return
      }

      let hardwarePool = hardwares
      // Garante que a checagem não dependa do carregamento assíncrono da lista da tela.
      // Se a IA responder antes dos Hardwares, recarrega a lista antes de decidir criar outro.
      if (!hardwarePool.length || hardwareLoading) {
        try {
          const fresh = await adminService.hardwares.list()
          hardwarePool = Array.isArray(fresh) ? fresh : []
          if (hardwarePool.length) setHardwares(hardwarePool)
        } catch { /* se a consulta falhar, mantém o fluxo normal abaixo */ }
      }

      const match = findExistingHardwareFromAi(hardwarePool, preview)
      if (match.hardware?.id) {
        await selectHardware(String(match.hardware.id))
        applyImportPreview(preview, false, { skipSpecialRouting: true, preserveHardware: true })
        setImportPreview((current) => current ? { ...current, hardwareExistenteId: match.hardware.id } : current)
        toast.show(`Hardware #${match.hardware.id} já existe. Mantive você no cadastro de Produto e vinculei o Hardware existente.`)
        return
      }

      if (match.ambiguous.length) {
        const source = aiPreviewSource(preview)
        setHardwareSearch(cleanText(source.mpn || source.modelo || source.nome))
        toast.show('Encontrei mais de um Hardware compatível. Selecione o correto abaixo; não vou criar outro automaticamente.', 'alerta')
        return
      }

      applyImportPreview(preview, false)
      toast.show('Esse Hardware não foi encontrado no cadastro. Abrindo o cadastro de Hardware com os campos preenchidos.')
      return
    }

    applyImportPreview(preview, notify)
    if (!notify && preview?.destinoSugerido === 'PRODUTO') {
      toast.show('Dados encontrados pela IA foram preenchidos. Revise o Produto e as ofertas antes de salvar.')
    }
  }

  function applyImportPreview(preview = importPreview, notify = true, { skipSpecialRouting = false, preserveHardware = false } = {}) {
    const source = getAiPayload(preview)
    if (!Object.keys(source).length) {
      toast.show('Não existem dados normalizados para aplicar. Faça o cadastro manualmente.', 'alerta')
      return
    }
    if (!skipSpecialRouting && preview?.destinoSugerido === 'HARDWARE') {
      storeAiImportPreview(preview)
      navigate('/admin/hardwares/novo?origem=ia-importacao')
      return
    }
    if (!skipSpecialRouting && preview?.destinoSugerido === 'NOTEBOOK') {
      storeAiImportPreview(preview)
      navigate('/admin/notebooks/novo?origem=ia-importacao')
      return
    }
    if (!skipSpecialRouting && preview?.destinoSugerido === 'PC_MONTADO') {
      storeAiImportPreview(preview)
      navigate('/admin/montados/novo?origem=ia-importacao')
      return
    }

    const category = source.categoriaId
      ? categories.find((item) => Number(item.id) === Number(source.categoriaId))
      : findCategoryFromPreview(categories, source.categoria || preview?.categoriaDetectada || preview?.categoriaSugerida)
    const nextCategoryId = category?.id || source.categoriaId || form.categoriaId
    const importedSchema = productSchemaFor(category || selectedCategory)
    const image = source.imagemUrl ?? preview?.coleta?.meta?.imagem ?? preview?.coleta?.meta?.ogImage ?? ''
    if (!preserveHardware) setSelectedHardwareId('')
    setForm((current) => ({
      ...current,
      categoriaId: nextCategoryId,
      nome: source.nome ?? current.nome,
      marca: source.marca ?? current.marca,
      modelo: source.modelo ?? current.modelo,
      descricao: source.descricao ?? current.descricao,
      mpn: source.mpn ?? current.mpn,
      gtin: normalizeGtin(source.gtin ?? source.ean ?? current.gtin),
      imagemUrl: image || current.imagemUrl,
      imagemHoverUrl: source.imagemHoverUrl ?? current.imagemHoverUrl,
      metadados: source.metadados && typeof source.metadados === 'object'
        ? JSON.stringify(source.metadados, null, 2)
        : current.metadados,
    }))
    if (importedSchema) {
      const structured = source[importedSchema.key] && typeof source[importedSchema.key] === 'object'
        ? source[importedSchema.key]
        : source
      setTechnical((current) => ({ ...current, ...technicalFromPreview(importedSchema, structured) }))
    }

    const offer = getAiOffer(preview)
    if (offer && (cleanText(offer.urlOriginal) || cleanText(importUrl))) {
      setIncludeOffer(true)
      setOfferRows((current) => {
        const importedUrl = cleanText(offer.urlOriginal) || cleanText(importUrl)
        const importedPartnerId = offer.parceiroId ? String(offer.parceiroId) : ''
        const nextOffer = {
          ...EMPTY_OFFER,
          parceiroId: importedPartnerId,
          preco: offer.preco ?? '',
          precoAnterior: offer.precoAnterior ?? '',
          urlOriginal: importedUrl,
          urlAfiliada: cleanText(offer.urlAfiliada || ''),
        }

        // Se a mesma oferta já estiver cadastrada, atualiza os dados comerciais
        // retornados pela IA (principalmente preço/preço anterior) sem duplicá-la.
        const sameOfferIndex = current.findIndex((row) => cleanText(row.urlOriginal) === importedUrl)
        if (sameOfferIndex >= 0) {
          return current.map((row, index) => index === sameOfferIndex ? {
            ...row,
            parceiroId: importedPartnerId || row.parceiroId,
            preco: offer.preco ?? row.preco,
            precoAnterior: offer.precoAnterior ?? row.precoAnterior,
            urlOriginal: importedUrl,
            urlAfiliada: cleanText(offer.urlAfiliada || '') || row.urlAfiliada,
          } : row)
        }

        const firstEditable = current.findIndex((row) => !row.id && !cleanText(row.urlOriginal) && !cleanText(row.preco))
        if (firstEditable >= 0) {
          return current.map((row, index) => index === firstEditable ? {
            ...row,
            ...nextOffer,
            parceiroId: importedPartnerId || row.parceiroId,
          } : row)
        }

        return [...current, nextOffer]
      })
    }

    setDirty(true)
    if (notify) toast.show('Prévia do Produto IA aplicada. Revise os dados e a oferta antes de salvar.')
  }

  async function analyzeWithAi() {
    if (!editing) return
    setAiBusy('analyze')
    try {
      const result = await adminService.ai.analyzeProduct(id)
      setAiAnalysis(result?.analise || 'A IA não retornou uma análise.')
    } catch (err) {
      toast.show(err?.message || 'Não foi possível analisar o Produto com a IA.', 'erro')
    } finally {
      setAiBusy('')
    }
  }

  async function generateDescriptionWithAi() {
    if (!editing || !canWriteAi) return
    setAiBusy('description')
    try {
      const result = await adminService.ai.generateProductDescription(id)
      if (!result?.descricao) throw new Error('A IA não retornou uma descrição.')
      update('descricao', result.descricao)
      toast.show('Descrição gerada pela IA. Revise e salve para aplicar.')
    } catch (err) {
      toast.show(err?.message || 'Não foi possível gerar a descrição com a IA.', 'erro')
    } finally {
      setAiBusy('')
    }
  }

  function buildOffersPayload() {
    if (!includeOffer) return []

    return offerRows.map((row, index) => {
      const numero = index + 1
      const parceiroId = Number(row.parceiroId)
      const preco = Number(row.preco)
      const urlOriginal = cleanText(row.urlOriginal)
      const urlAfiliada = cleanText(row.urlAfiliada)

      if (!parceiroId) throw new Error(`Selecione o parceiro da Oferta ${numero}.`)
      if (!Number.isFinite(preco) || preco <= 0) throw new Error(`Informe um preço válido para a Oferta ${numero}.`)
      if (!urlOriginal) throw new Error(`Informe a URL original da Oferta ${numero}.`)

      const precoAnterior = row.precoAnterior === '' ? undefined : Number(row.precoAnterior)
      if (precoAnterior !== undefined && (!Number.isFinite(precoAnterior) || precoAnterior <= 0)) {
        throw new Error(`Informe um preço anterior válido na Oferta ${numero} ou deixe o campo vazio.`)
      }

      return {
        id: row.id || null,
        status: row.status || 'ATIVA',
        originalPartnerId: Number(row._originalPartnerId) || null,
        payload: {
          parceiroId,
          preco,
          ...(precoAnterior !== undefined ? { precoAnterior } : {}),
          urlOriginal,
          ...(urlAfiliada ? { urlAfiliada } : { urlAfiliada: null }),
        },
      }
    })
  }

  async function saveOffersForProduct(productId, entries, skipNewIndex = -1) {
    const resolvedProductId = Number(productId)
    if (!Number.isInteger(resolvedProductId) || resolvedProductId < 1) {
      throw new Error('Não foi possível identificar o Produto para salvar as ofertas.')
    }

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]
      if (index === skipNewIndex && !entry.id) continue

      if (entry.id) {
        const partnerChanged = entry.originalPartnerId
          && Number(entry.originalPartnerId) !== Number(entry.payload.parceiroId)

        if (partnerChanged) {
          // O backend atual não aceita parceiroId no PATCH da Oferta.
          // Para trocar a loja sem perder preço/link, cria a substituta primeiro
          // e só depois descontinua a antiga.
          await adminService.offers.create({
            produtoId: resolvedProductId,
            ...entry.payload,
          })
          await adminService.offers.remove(entry.id)
          continue
        }

        // parceiroId pertence à Oferta, mas o DTO de atualização atual não o aceita.
        // Não enviá-lo evita que preço/URLs falhem com
        // "A propriedade parceiroId não deve existir".
        await adminService.offers.update(entry.id, {
          preco: entry.payload.preco,
          precoAnterior: entry.payload.precoAnterior ?? null,
          urlOriginal: entry.payload.urlOriginal,
          urlAfiliada: entry.payload.urlAfiliada,
        })
        if (String(entry.status || 'ATIVA').toUpperCase() !== 'ATIVA') {
          await adminService.offers.setStatus(entry.id, 'ATIVA')
        }
      } else {
        await adminService.offers.create({ produtoId: resolvedProductId, ...entry.payload })
      }
    }
  }


  async function removeAllOffersForProduct() {
    const existingIds = offerRows
      .map((row) => Number(row?.id))
      .filter((offerId) => Number.isInteger(offerId) && offerId > 0)

    for (const offerId of existingIds) {
      await adminService.offers.remove(offerId)
    }

    if (existingIds.length) {
      setAllOffers((current) => current.filter((item) => !existingIds.includes(Number(item?.id))))
      setOfferRows([{ ...EMPTY_OFFER }])
    }
  }


  async function createWithOptionalInitialOffer(create, productBody, ofertaInicial) {
    if (!ofertaInicial) return { saved: await create(productBody), offerCreatedInProduct: false }

    try {
      const saved = await create({ ...productBody, ofertaInicial })
      return { saved, offerCreatedInProduct: true }
    } catch (err) {
      if (!ofertaInicialUnsupported(err)) throw err
      const saved = await create(productBody)
      return { saved, offerCreatedInProduct: false }
    }
  }

  async function submit(event, draft = false) {
    event?.preventDefault()
    const formElement = event?.currentTarget
    if (!draft && formElement && !formElement.checkValidity()) {
      formElement.reportValidity()
      return
    }
    if (!draft && !selectedHardwareId && !validGtin(form.gtin)) {
      setError(new Error('GTIN/EAN inválido. Confira a quantidade de dígitos e o dígito verificador.'))
      return
    }

    if (draft) {
      if (!cleanText(form.nome)) {
        setError(new Error('Informe o nome do Produto antes de salvar o rascunho.'))
        return
      }
      if (!form.categoriaId) {
        setError(new Error('Selecione a categoria do Produto antes de salvar o rascunho.'))
        return
      }
    }

    setSaving(true)
    setError(null)
    try {
      let metadados = {}
      const metadataText = cleanText(form.metadados)
      try { metadados = metadataText ? JSON.parse(metadataText) : {} } catch { throw new Error('O JSON de metadados está inválido.') }

      const body = {
        categoriaId: Number(form.categoriaId),
        nome: cleanText(form.nome),
        marca: cleanText(form.marca) || undefined,
        modelo: cleanText(form.modelo) || undefined,
        descricao: cleanText(form.descricao) || undefined,
        mpn: cleanText(form.mpn) || undefined,
        gtin: cleanText(form.gtin) || undefined,
        imagemUrl: cleanText(form.imagemUrl) || undefined,
        imagemHoverUrl: cleanText(form.imagemHoverUrl) || undefined,
        metadados,
        publicado: draft ? false : Boolean(form.publicado),
        ativo: Boolean(form.ativo),
      }
      if (schema) body[schema.key] = normalizeSpec(schema, technical)

      // Rascunhos podem ser criados sem Hardware vinculado. Se houver uma oferta preenchida,
      // ela fica vinculada ao Produto rascunho e não será exibida como oferta pública até a publicação.
      const offerEntries = fromOfferSuggestion ? [] : buildOffersPayload()
      const firstNewOfferIndex = offerEntries.findIndex((entry) => !entry.id)
      const ofertaInicial = firstNewOfferIndex >= 0 ? offerEntries[firstNewOfferIndex].payload : null
      let saved
      let offerCreatedInProduct = false
      let targetProductId = editing ? Number(id) : selectedLinkedProductId

      if (editing) {
        saved = await adminService.products.update(id, body)
      } else if (selectedHardwareId && selectedLinkedProductId) {
        saved = await adminService.products.update(selectedLinkedProductId, {
          nome: body.nome || undefined,
          descricao: body.descricao,
          imagemUrl: body.imagemUrl,
          imagemHoverUrl: body.imagemHoverUrl,
          metadados: body.metadados,
          publicado: body.publicado,
          ativo: body.ativo,
        })
        targetProductId = selectedLinkedProductId
      } else if (selectedHardwareId) {
        const result = await createWithOptionalInitialOffer(
          (payload) => adminService.products.createFromHardware(selectedHardwareId, payload),
          {
            nome: body.nome || undefined,
            descricao: body.descricao,
            imagemUrl: body.imagemUrl,
            imagemHoverUrl: body.imagemHoverUrl,
            metadados: body.metadados,
            publicado: body.publicado,
            ativo: body.ativo,
          },
          ofertaInicial,
        )
        saved = result.saved
        offerCreatedInProduct = result.offerCreatedInProduct
        targetProductId = Number(saved?.id)
      } else {
        const result = await createWithOptionalInitialOffer(
          (payload) => adminService.products.create(payload),
          body,
          ofertaInicial,
        )
        saved = result.saved
        offerCreatedInProduct = result.offerCreatedInProduct
        targetProductId = Number(saved?.id)
      }

      if (offerEntries.length) {
        await saveOffersForProduct(
          targetProductId || saved?.id,
          offerEntries,
          offerCreatedInProduct ? firstNewOfferIndex : -1,
        )
      } else if (!includeOffer && offerRows.some((row) => row.id)) {
        // Desmarcar "Incluir ofertas" precisa persistir no backend; caso contrário
        // as ofertas antigas voltam no próximo carregamento da tela.
        await removeAllOffersForProduct()
      }

      setDirty(false)
      if (draft) toast.show('Produto salvo como rascunho.')
      else if (fromOfferSuggestion) toast.show('Produto criado. Agora aceite a sugestão para criar a Oferta.')
      else if (offerEntries.length) toast.show(`Produto e ${offerEntries.length} oferta${offerEntries.length === 1 ? '' : 's'} salvos. O item já pode aparecer em Busca de Ofertas.`)
      else toast.show('Produto salvo.')

      if (suggestionOriginId && !editing) {
        navigate(`/admin/sugestoes-ofertas/${suggestionOriginId}?produtoId=${encodeURIComponent(targetProductId || saved?.id)}`, { replace: true })
      } else {
        navigate('/admin/produtos', { replace: true })
      }
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLoading />
  if (error && !form.nome && editing) return <AdminError error={error} />

  return <>
    <AdminPageHeader
      title={editing ? 'Editar produto' : 'Cadastrar produto'}
      description={fromOfferSuggestion ? 'Cadastre somente o Produto. Depois crie a Oferta e use Aceitar Oferta para concluir a sugestão.' : 'Cadastre o Produto comercial e, se quiser, já inclua a oferta com link afiliado no mesmo fluxo.'}
    >
      <AdminBack to="/admin/produtos">Cancelar</AdminBack>
    </AdminPageHeader>

    <form className="admin-form-layout" noValidate onSubmit={submit}>
      <div className="admin-form-card">
        {!editing && role === 'ADMIN' && <section className="admin-form-section admin-import-section">
          <div className="admin-section-heading">
            <div><h2>Origem do cadastro</h2><p>Informe se este Produto está sendo criado diretamente pelo Admin ou a partir de uma sugestão enviada pela comunidade.</p></div>
            <span className="admin-import-badge">AUTORIA</span>
          </div>
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>Origem</label>
              <select className="admin-select" value={fromOfferSuggestion ? 'SUGESTAO' : originMode} disabled={fromOfferSuggestion} onChange={(event) => setOriginMode(event.target.value)}>
                <option value="ADMIN">Cadastro do Admin</option>
                <option value="SUGESTAO">Sugestão de usuário</option>
              </select>
            </div>
            {!fromOfferSuggestion && originMode === 'SUGESTAO' && <div className="admin-field full">
              <label>Pesquisar sugestão</label>
              <input className="admin-input" type="search" value={originSuggestionSearch} onChange={(event) => setOriginSuggestionSearch(event.target.value)} placeholder="Usuário, produto, link ou ID da sugestão" autoComplete="off" />
              <small className="admin-help">Selecione a própria sugestão para preservar corretamente quem enviou a oferta.</small>
              <div className="admin-suggestion-product-results" role="listbox" aria-label="Sugestões de ofertas em análise">
                {originSuggestionsLoading ? <div className="admin-suggestion-product-results__empty">Buscando sugestões...</div> : originSuggestions.length ? originSuggestions.map((suggestion) => <button
                  key={suggestion.id}
                  className="admin-suggestion-product-result"
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => chooseOriginSuggestion(suggestion)}
                >
                  <span className="admin-suggestion-product-result__image">#{suggestion.id}</span>
                  <span className="admin-suggestion-product-result__content"><strong>{suggestion.nome || `Sugestão #${suggestion.id}`}</strong><small>{suggestion.usuario?.nome || 'Usuário'} · {String(suggestion.categoria || '').replaceAll('_', ' ')}</small></span>
                  <span className="admin-suggestion-product-result__category">{Number(suggestion.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </button>) : <div className="admin-suggestion-product-results__empty">Nenhuma sugestão em análise encontrada.</div>}
              </div>
            </div>}
            {fromOfferSuggestion && suggestionPrefill && <div className="admin-field full"><div className="admin-suggestion-selected-product"><span>Sugestão selecionada</span><strong>#{suggestionPrefill.id} · {suggestionPrefill.nome}</strong><small>Enviada por {suggestionPrefill.usuario?.nome || 'usuário'}. A autoria será preservada quando a Oferta for aceita.</small></div></div>}
          </div>
        </section>}

        {canImportLink && <section className="admin-form-section admin-import-section">
          <div className="admin-section-heading">
            <div><h2>Cadastrar Produto com IA</h2><p>Cole o link do fabricante ou da loja. A IA analisa a página e preenche uma prévia editável; nada é salvo automaticamente.</p></div>
            <span className="admin-import-badge">Somente ADMIN</span>
          </div>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>URL do produto</label><input className="admin-input" type="url" value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="https://fabricante-ou-loja.com/produto" /></div>
            <div className="admin-field full admin-import-actions">
              <button className="btn btn-primario" type="button" disabled={importing || !cleanText(importUrl)} onClick={importData}>
                {importing ? `Analisando com IA... ${importElapsed}s` : 'Analisar e preencher Produto'}
              </button>
              {importing && <button className="btn btn-secundario" type="button" onClick={cancelImportData}>Cancelar análise</button>}
              {importing && <small className="admin-help">A análise será encerrada automaticamente se passar de 90 segundos sem resposta.</small>}
            </div>
          </div>
          {importPreview && <div className="admin-import-preview">
            <div className="admin-import-preview-head"><div><span className="admin-import-preview-status">{importPreview.status || 'PRÉVIA'}</span><h3>Prévia para revisão</h3></div><strong>{importPreview.destinoSugerido === 'HARDWARE' ? 'Hardware' : 'Produto'}</strong></div>
            {importPreview.avisoIa && <p className="admin-inline-warning">{importPreview.avisoIa}</p>}
            {importPreview.normalizacao?.textoExplicativo && <p className="admin-import-preview-copy">{importPreview.normalizacao.textoExplicativo}</p>}
            <div className="admin-import-preview-fields">
              {Object.entries(importPreview.normalizacao?.camposNormalizados || {}).filter(([key, value]) => key !== 'evidencias' && value !== null && value !== '' && typeof value !== 'object').slice(0, 12).map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}
            </div>
            <PreviewList title="Revisar" items={importPreview.normalizacao?.alertas} tone="warn" />
            <PreviewList title="Não encontrado" items={importPreview.normalizacao?.ausentes} tone="missing" />
            <AiImportContractInfo preview={importPreview} />
            <div className="admin-import-preview-actions">
              <button className="btn btn-secundario" type="button" onClick={() => { setImportPreview(null); setImportUrl('') }}>Descartar prévia</button>
              <button className="btn btn-primario" type="button" onClick={() => applySmartImportPreview()}>{importPreview.destinoSugerido === 'HARDWARE' ? (selectedHardwareId ? 'Aplicar ao Produto com Hardware existente' : 'Verificar Hardware e continuar') : 'Aplicar prévia ao Produto'}</button>
            </div>
            <small className="admin-help">A IA apenas preenche campos. Revise tudo e salve manualmente.</small>
          </div>}
        </section>}

        {suggestionPrefill && <section className="admin-form-section admin-suggestion-prefill">
          <div className="admin-section-heading">
            <div><h2>Produto a partir da Sugestão #{suggestionPrefill.id}</h2><p>O nome e os dados comerciais foram trazidos da sugestão. Nenhum Hardware ou Oferta será criado automaticamente nesta etapa.</p></div>
            <span className="admin-import-badge">EM ANÁLISE</span>
          </div>
          <div className="admin-suggestion-prefill-grid">
            <div><span>Categoria</span><strong>{String(suggestionPrefill.categoria || '').replaceAll('_', ' ')}</strong></div>
            <div><span>Preço sugerido</span><strong>{Number(suggestionPrefill.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
            <div className="full"><span>URL enviada</span><a href={suggestionPrefill.urlOriginal} target="_blank" rel="noopener noreferrer">{suggestionPrefill.urlOriginal} ↗</a></div>
            {Object.entries(suggestionPrefill.especificacoes || {}).map(([key, value]) => <div key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value)}</strong></div>)}
          </div>
          <div className="admin-info-box"><strong>Fluxo correto</strong><p>Crie somente o Produto aqui. Ao salvar, você volta para a sugestão, usa “Criar oferta” para cadastrar os dados comerciais e depois “Aceitar Oferta” para vincular a Oferta existente e marcar a sugestão como aprovada.</p></div>
        </section>}

        {!editing && <section className="admin-form-section admin-import-section">
          <div className="admin-section-heading">
            <div>
              <h2>Usar Hardware existente</h2>
              <p>Pesquise qualquer Hardware cadastrado. Se ele já possuir Produto, o cadastro comercial existente será reutilizado; se não possuir, um novo Produto será criado.</p>
            </div>
            <span className="admin-import-badge">Recomendado</span>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>Pesquisar Hardware</label>
              <input
                className="admin-input"
                type="search"
                value={hardwareSearch}
                onChange={(event) => setHardwareSearch(event.target.value)}
                placeholder="Ex.: RTX 5070, Ryzen 7, Kingston..."
                disabled={hardwareLoading && !hardwares.length}
              />
              <small className="admin-help">
                {hardwareLoading
                  ? 'Carregando Hardwares...'
                  : `${filteredHardwares.length} de ${hardwares.length} Hardware(s). ${hardwares.length - linkedCount} sem Produto · ${linkedCount} já vinculados.`}
              </small>

              {!hardwareLoading && hardwares.length > 0 && <div className="admin-hardware-picker-results" role="listbox" aria-label="Hardwares cadastrados">
                {filteredHardwares.slice(0, 30).map((hardware) => {
                  const productId = hardwareProductId(hardware)
                  return <button
                    className={`admin-hardware-picker-item ${Number(selectedHardwareId) === Number(hardware.id) ? 'is-selected' : ''}`}
                    type="button"
                    role="option"
                    aria-selected={Number(selectedHardwareId) === Number(hardware.id)}
                    key={hardware.id}
                    onClick={() => selectHardware(hardware.id)}
                  >
                    <span>
                      <strong>{hardware.nome || [hardware.marca, hardware.modelo].filter(Boolean).join(' ') || `Hardware #${hardware.id}`}</strong>
                      <small>#{hardware.id} · {String(hardware.categoria || 'HARDWARE').replaceAll('_', ' ')}</small>
                    </span>
                    <span>
                      <strong>{hardware.marca || '—'}</strong>
                      <small>{productId ? `Produto #${productId} já vinculado` : (hardware.modelo || hardware.mpn || 'Sem Produto')}</small>
                    </span>
                  </button>
                })}
                {!filteredHardwares.length && <div className="admin-hardware-picker-empty">Nenhum Hardware encontrado para esta pesquisa.</div>}
              </div>}
              {!hardwareLoading && !hardwares.length && !hardwareError && <div className="admin-hardware-picker-empty">Nenhum Hardware cadastrado.</div>}
            </div>

            <div className="admin-field full">
              <label>Hardware selecionado</label>
              <select
                className="admin-select"
                value={selectedHardwareId}
                onChange={(event) => selectHardware(event.target.value)}
                disabled={hardwareLoading && !hardwares.length}
              >
                <option value="">Cadastro manual — não usar Hardware</option>
                {hardwares.map((hardware) => <option key={hardware.id} value={hardware.id}>#{hardware.id} · {hardwareLabel(hardware)}</option>)}
              </select>
            </div>
          </div>

          {hardwareError && <p className="admin-inline-warning">{hardwareError}</p>}

          {selectedHardware && <div className="admin-import-preview">
            <div className="admin-import-preview-head">
              <div>
                <span className="admin-import-preview-status">HARDWARE #{selectedHardware.id}</span>
                <h3>{selectedHardware.nome || [selectedHardware.marca, selectedHardware.modelo].filter(Boolean).join(' ') || 'Hardware selecionado'}</h3>
              </div>
              <strong>{String(selectedHardware.categoria || 'Hardware').replaceAll('_', ' ')}</strong>
            </div>
            <p className="admin-import-preview-copy">
              {selectedLinkedProductId
                ? `Este Hardware já possui o Produto #${selectedLinkedProductId}. Ao salvar, esse Produto será atualizado e a oferta afiliada será associada a ele, sem criar duplicata.`
                : 'Este Hardware ainda não possui Produto. Ao salvar, o Produto comercial será criado e vinculado ao Hardware.'}
            </p>
            <div className="admin-import-preview-actions">
              <button className="btn btn-secundario" type="button" disabled={hardwareLoading} onClick={() => selectHardware(selectedHardware.id)}>
                {hardwareLoading ? 'Carregando...' : 'Preencher novamente'}
              </button>
            </div>
          </div>}
        </section>}

        <section className="admin-form-section">
          <h2>Identificação</h2>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>Nome</label><input className="admin-input" required value={form.nome} onChange={(event) => update('nome', event.target.value)} /></div>
            <div className="admin-field"><label>Categoria</label><select className="admin-select" required={!selectedHardwareId} disabled={Boolean(selectedHardwareId)} value={form.categoriaId} onChange={(event) => changeCategory(event.target.value)}><option value="">{selectedHardwareId ? 'Definida pelo Hardware' : 'Selecione'}</option>{categories.map((cat) => <option value={cat.id} key={cat.id}>{cat.nome || cat.slug || `Categoria ${cat.id}`}</option>)}</select></div>
            <div className="admin-field"><label>Marca</label><input className="admin-input" value={form.marca} readOnly={Boolean(selectedHardwareId)} onChange={(event) => update('marca', event.target.value)} /></div>
            <div className="admin-field"><label>Modelo</label><input className="admin-input" value={form.modelo} readOnly={Boolean(selectedHardwareId)} onChange={(event) => update('modelo', event.target.value)} /></div>
            <div className="admin-field"><label>MPN</label><input className="admin-input" value={form.mpn} readOnly={Boolean(selectedHardwareId)} onChange={(event) => update('mpn', event.target.value)} /></div>
            <div className="admin-field"><label>GTIN/EAN</label><input className="admin-input" aria-invalid={!selectedHardwareId && form.gtin && !validGtin(form.gtin) ? 'true' : 'false'} inputMode="numeric" value={form.gtin} readOnly={Boolean(selectedHardwareId)} onChange={(event) => update('gtin', normalizeGtin(event.target.value))} />{!selectedHardwareId && form.gtin && !validGtin(form.gtin) && <small className="admin-inline-warning">GTIN/EAN inválido.</small>}</div>
            <div className="admin-field full"><label>Descrição</label><textarea className="admin-textarea" value={form.descricao} onChange={(event) => update('descricao', event.target.value)} /></div>
          </div>
        </section>

        <section className="admin-form-section">
          {selectedHardwareId
            ? <div className="admin-info-box"><strong>Ficha técnica vinculada ao Hardware</strong><p>Categoria, marca, modelo, MPN, GTIN e especificações técnicas continuam pertencendo ao Hardware. O Produto guarda somente a parte comercial.</p></div>
            : <AdminTechnicalFields schema={schema} values={technical} onChange={updateTechnical} />}
        </section>

        {fromOfferSuggestion ? <section className="admin-form-section admin-suggestion-offer-locked">
          <div className="admin-info-box">
            <strong>Oferta será criada depois</strong>
            <p>Este cadastro veio de uma sugestão em análise. Aqui você cria somente o Produto. Depois volte à sugestão, clique em “Criar oferta” e, quando a Oferta existir, use “Aceitar Oferta” para vinculá-la e mudar o status para APROVADA.</p>
          </div>
        </section> : <>
        <section className="admin-form-section">
          <div className="admin-section-heading">
            <div>
              <h2>Ofertas afiliadas</h2>
              <p>Cadastre uma ou várias ofertas para o mesmo Produto. Cada oferta pode ter parceiro, preço e link afiliado próprios.</p>
            </div>
            <div className="admin-offer-heading-actions">
              <label className="admin-switch">
                <input type="checkbox" checked={includeOffer} onChange={(event) => { setIncludeOffer(event.target.checked); setDirty(true) }} />
                Incluir ofertas
              </label>
              <button className="btn btn-secundario" type="button" onClick={addOffer}>+ Oferta</button>
            </div>
          </div>

          {includeOffer && <div className="admin-offer-editors">
            {offerRows.map((row, index) => <div className="admin-offer-editor" key={row.id || `nova-oferta-${index}`}>
              <div className="admin-offer-editor-head">
                <div>
                  <strong>Oferta {index + 1}</strong>
                  <small>{row.id ? 'Oferta já cadastrada' : 'Nova oferta'}</small>
                </div>
                {(row.id || offerRows.length > 1) && <button className={row.id ? 'admin-action-button admin-action-button--danger' : 'admin-action-button'} type="button" onClick={() => removeOffer(index)}>{row.id ? 'Excluir Oferta' : 'Remover'}</button>}
              </div>
              <div className="admin-form-grid">
                <div className="admin-field">
                  <label>Parceiro</label>
                  <select className="admin-select" required value={row.parceiroId} onChange={(event) => updateOffer(index, 'parceiroId', event.target.value)}>
                    <option value="">Selecione</option>
                    {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.nome}</option>)}
                  </select>
                </div>
                <div className="admin-field"><label>Preço atual</label><input className="admin-input" type="number" min="0.01" step="0.01" required value={row.preco} onChange={(event) => updateOffer(index, 'preco', event.target.value)} placeholder="0,00" /></div>
                <div className="admin-field"><label>Preço anterior</label><input className="admin-input" type="number" min="0.01" step="0.01" value={row.precoAnterior} onChange={(event) => updateOffer(index, 'precoAnterior', event.target.value)} placeholder="Opcional" /></div>
                <div className="admin-field full"><label>URL original</label><input className="admin-input" type="url" required value={row.urlOriginal} onChange={(event) => updateOffer(index, 'urlOriginal', event.target.value)} placeholder="https://loja.com/produto" /></div>
                <div className="admin-field full"><label>URL afiliada</label><input className="admin-input" type="url" value={row.urlAfiliada} onChange={(event) => updateOffer(index, 'urlAfiliada', event.target.value)} placeholder="https://...link-afiliado..." /><small className="admin-help">Opcional. Sem link afiliado, o CriaByte usa a URL original da oferta.</small></div>
              </div>
            </div>)}
          </div>}
        </section>

        </>}

        <section className="admin-form-section">
          <h2>Imagens e metadados</h2>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>Imagem principal</label><input className="admin-input" value={form.imagemUrl} onChange={(event) => update('imagemUrl', event.target.value)} placeholder="https://..." /></div>
            <div className="admin-field full"><label>Imagem hover</label><input className="admin-input" value={form.imagemHoverUrl} onChange={(event) => update('imagemHoverUrl', event.target.value)} placeholder="https://..." /></div>
            <div className="admin-field full"><label>Metadados JSON</label><textarea className="admin-textarea admin-code-area" value={form.metadados} onChange={(event) => update('metadados', event.target.value)} /><small className="admin-help">Use para dados adicionais que ainda não possuem campo próprio.</small></div>
          </div>
        </section>

        {error && <div className="admin-form-section"><p className="admin-form-error">{error.message}</p></div>}

        <footer className="admin-form-footer">
          <span className={`admin-unsaved-state ${dirty ? 'is-dirty' : ''}`}>{dirty ? 'Alterações não salvas' : 'Tudo salvo'}</span>
          {!fromOfferSuggestion && <button className="btn btn-secundario" type="button" disabled={saving} onClick={(event) => submit(event, true)}>Salvar rascunho</button>}
          <button className="btn btn-primario" type="submit" disabled={saving}>{saving ? 'Salvando...' : (fromOfferSuggestion ? 'Criar Produto' : (includeOffer ? 'Salvar produto e ofertas' : 'Salvar produto'))}</button>
        </footer>
      </div>

      <aside className="admin-sticky-side">
        <div className="admin-card">
          <header className="admin-card-header"><h2>Pré-visualização</h2></header>
          <div className="admin-card-body">
            <article className="admin-preview-card">
              <div className="admin-preview-image">{form.imagemUrl ? <img src={form.imagemUrl} alt="" /> : <div className="admin-empty">Sem imagem</div>}</div>
              <div className="admin-preview-content">
                <span className="admin-status status-rascunho">{form.publicado ? 'PUBLICADO' : 'RASCUNHO'}</span>
                <h3>{form.nome || 'Nome do produto'}</h3>
                <p>{form.descricao || 'A descrição aparecerá aqui.'}</p>
                <strong className="admin-preview-price">{offerRows[0]?.preco ? `R$ ${Number(offerRows[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (selectedCategory?.nome || 'Categoria')}</strong>
                {includeOffer && offerRows.some((row) => cleanText(row.urlAfiliada)) && <small>✓ {offerRows.filter((row) => cleanText(row.urlAfiliada)).length} oferta(s) com link afiliado</small>}
              </div>
            </article>
          </div>
        </div>

        {editing && <div className="admin-card admin-ai-product-card">
          <header className="admin-card-header"><div><h2>IA administrativa</h2><p>Analisa os dados já cadastrados do Produto.</p></div><span className="admin-stat-icon">✦</span></header>
          <div className="admin-card-body">
            <div className="admin-ai-product-actions">
              <button className="btn btn-secundario" type="button" disabled={Boolean(aiBusy)} onClick={analyzeWithAi}>{aiBusy === 'analyze' ? 'Analisando...' : 'Analisar cadastro'}</button>
              {canWriteAi && <button className="btn btn-secundario" type="button" disabled={Boolean(aiBusy)} onClick={generateDescriptionWithAi}>{aiBusy === 'description' ? 'Gerando...' : 'Gerar descrição'}</button>}
            </div>
            {aiAnalysis && <div className="admin-ai-analysis">{aiAnalysis}</div>}
            <small className="admin-help">A IA não salva alterações automaticamente.</small>
          </div>
        </div>}

        <div className="admin-info-box">
          <label className="admin-switch"><input type="checkbox" checked={form.publicado} onChange={(event) => update('publicado', event.target.checked)} /> Publicado</label><br />
          <label className="admin-switch"><input type="checkbox" checked={form.ativo} onChange={(event) => update('ativo', event.target.checked)} /> Ativo</label>
        </div>
      </aside>
    </form>
  </>
}
