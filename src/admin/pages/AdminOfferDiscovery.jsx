import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { adminService } from '../services/adminService'
import { storeAiImportPreview } from '../utils/aiImportTransfer'
import './AdminOfferDiscovery.css'

const CATEGORY_RULES = [
  ['PC_MONTADO', /\b(pc\s*gamer|pc\s*montado|computador\s*gamer|computador\s*completo|desktop|kit\s*upgrade)\b/i],
  ['NOTEBOOK', /\b(notebook|laptop)\b/i],
  ['PLACA_VIDEO', /\b(placa\s*(de\s*)?v[ií]deo|gpu|rtx\s*\d|gtx\s*\d|radeon|rx\s*\d)\b/i],
  ['PROCESSADOR', /\b(processador|cpu|ryzen\s*\d|core\s*i[3579]|intel\s*i[3579])\b/i],
  ['PLACA_MAE', /\b(placa\s*m[aã]e|motherboard|b[45678]\d{2}|x[45678]\d{2}|a[3456]\d{2}|h[4567]\d{2})\b/i],
  ['MEMORIA_RAM', /\b(mem[oó]ria\s*ram|ram\s*ddr|ddr[345])\b/i],
  ['ARMAZENAMENTO', /\b(ssd|nvme|m\.2|hd\b|hdd)\b/i],
  ['FONTE', /\b(fonte\s*(atx|gamer|pc)?|psu|\d{3,4}\s*w)\b/i],
  ['GABINETE', /\b(gabinete|case\s*(gamer|atx|pc))\b/i],
  ['COOLER', /\b(water\s*cooler|air\s*cooler|cooler\s*(cpu|processador))\b/i],
  ['VENTOINHA', /\b(ventoinha|fan\s*(120|140|pc|argb|rgb))\b/i],
]

const HARDWARE_CATEGORIES = new Set([
  'PROCESSADOR', 'PLACA_MAE', 'MEMORIA_RAM', 'PLACA_VIDEO', 'ARMAZENAMENTO',
  'FONTE', 'GABINETE', 'COOLER', 'VENTOINHA',
])

const CATEGORY_LABELS = {
  PC_MONTADO: 'PC montado / kit', NOTEBOOK: 'Notebook', PROCESSADOR: 'Processador',
  PLACA_MAE: 'Placa-mãe', MEMORIA_RAM: 'Memória RAM', PLACA_VIDEO: 'Placa de vídeo',
  ARMAZENAMENTO: 'Armazenamento', FONTE: 'Fonte', GABINETE: 'Gabinete',
  COOLER: 'Cooler', VENTOINHA: 'Ventoinha', PRODUTO: 'Produto',
}

function clean(value) {
  return String(value ?? '').trim()
}

function money(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'Preço não informado'
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function inferCategory(item) {
  const text = `${clean(item?.nome)} ${clean(item?.loja)}`
  return CATEGORY_RULES.find(([, pattern]) => pattern.test(text))?.[0] || 'PRODUTO'
}

function expectedDestination(category) {
  if (category === 'PC_MONTADO') return 'PC_MONTADO'
  if (category === 'NOTEBOOK') return 'NOTEBOOK'
  if (HARDWARE_CATEGORIES.has(category)) return 'HARDWARE'
  return 'PRODUTO'
}

function destinationRoute(destination) {
  if (destination === 'PC_MONTADO') return '/admin/montados/novo'
  if (destination === 'NOTEBOOK') return '/admin/notebooks/novo'
  if (destination === 'HARDWARE') return '/admin/hardwares/novo'
  return '/admin/produtos/novo'
}

function fallbackPreview(item, category) {
  const destination = expectedDestination(category)
  return {
    status: 'PREVIA_DESCOBERTA',
    destinoSugerido: destination,
    categoriaDetectada: category,
    urlOrigem: clean(item?.urlOriginal || item?.urlAfiliada),
    normalizacao: {
      camposNormalizados: {
        nome: clean(item?.nome),
        ...(HARDWARE_CATEGORIES.has(category) ? { categoria: category } : {}),
        imagemUrl: clean(item?.imagemUrl),
        descricao: '',
      },
      alertas: ['Dados vieram da busca de ofertas. Revise a ficha antes de salvar.'],
    },
    ofertaColetada: {
      preco: Number(item?.preco ?? item?.precoMin) || undefined,
      urlOriginal: clean(item?.urlOriginal || item?.urlAfiliada),
      urlAfiliada: clean(item?.urlAfiliada),
      parceiroNome: 'Shopee',
      codigoMarketplace: clean(item?.itemId),
      vendedorNome: clean(item?.loja),
      disponivel: true,
    },
  }
}

function componentSuggestions(analysis) {
  if (!analysis || typeof analysis !== 'object') return []
  const candidates = [
    analysis.componentes,
    analysis.componentesSugeridos,
    analysis.vinculosSugeridos,
    analysis.hardwaresVinculados,
    analysis.itens,
  ].find(Array.isArray) || []
  return candidates.map((item) => ({
    id: Number(item?.hardwareId ?? item?.hardware?.id ?? item?.id) || null,
    nome: clean(item?.nome ?? item?.hardware?.nome ?? item?.modelo ?? item?.hardware?.modelo),
    categoria: clean(item?.categoria ?? item?.hardware?.categoria),
    confianca: item?.confianca ?? item?.score ?? null,
  })).filter((item) => item.id || item.nome)
}

export default function AdminOfferDiscovery() {
  const navigate = useNavigate()
  const toast = useAdminToast()
  const [query, setQuery] = useState('')
  const [onlyPromotions, setOnlyPromotions] = useState(false)
  const [limit, setLimit] = useState(24)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [analyzingId, setAnalyzingId] = useState(null)
  const [analyses, setAnalyses] = useState({})

  useEffect(() => {
    let active = true
    adminService.discovery.shopeeStatus()
      .then((value) => { if (active) setStatus(value) })
      .catch(() => { if (active) setStatus(null) })
    return () => { active = false }
  }, [])

  const normalizedResults = useMemo(() => results.map((item, index) => ({
    ...item,
    _key: `${item?.shopId || 'shop'}-${item?.itemId || index}`,
    _category: inferCategory(item),
  })), [results])

  async function search(event) {
    event?.preventDefault()
    const term = clean(query)
    if (term.length < 2) {
      setError('Digite pelo menos 2 caracteres para pesquisar.')
      return
    }
    setLoading(true)
    setError('')
    setAnalyses({})
    try {
      const payload = await adminService.discovery.searchShopee({
        consulta: term,
        limite: Number(limit) || 24,
        somentePromocoes: onlyPromotions,
      })
      const items = Array.isArray(payload?.itens) ? payload.itens : []
      setResults(items)
      if (!items.length) toast.show('Nenhuma oferta encontrada para essa pesquisa.', 'alerta')
    } catch (cause) {
      setResults([])
      setError(cause?.message || 'Não foi possível consultar a Shopee.')
    } finally {
      setLoading(false)
    }
  }

  async function analyze(item) {
    const key = item._key
    const category = item._category
    const destination = expectedDestination(category)
    const url = clean(item.urlOriginal || item.urlAfiliada)
    setAnalyzingId(key)
    setError('')
    try {
      let preview
      try {
        preview = url
          ? await adminService.ai.importLink(url, destination === 'PRODUTO' ? undefined : destination)
          : fallbackPreview(item, category)
      } catch {
        preview = fallbackPreview(item, category)
      }

      let buildAnalysis = null
      let buildWarning = ''
      if (destination === 'PC_MONTADO') {
        try {
          buildAnalysis = await adminService.builds.analyzeListing({ titulo: clean(item.nome), descricao: '' })
        } catch (cause) {
          buildWarning = cause?.message || 'Não foi possível sugerir vínculos de componentes.'
        }
      }

      const mergedPreview = {
        ...fallbackPreview(item, category),
        ...preview,
        destinoSugerido: preview?.destinoSugerido || destination,
      }
      setAnalyses((current) => ({
        ...current,
        [key]: { preview: mergedPreview, buildAnalysis, buildWarning },
      }))
    } catch (cause) {
      setError(cause?.message || 'Não foi possível analisar esta oferta.')
    } finally {
      setAnalyzingId(null)
    }
  }

  async function register(item) {
    let analysis = analyses[item._key]
    if (!analysis?.preview) {
      await analyze(item)
      analysis = null
    }
    const latest = analysis?.preview || analyses[item._key]?.preview || fallbackPreview(item, item._category)
    const destination = clean(latest?.destinoSugerido).toUpperCase() || expectedDestination(item._category)
    const stored = storeAiImportPreview(latest)
    if (!stored) {
      setError('Não foi possível transferir a prévia para o formulário de cadastro.')
      return
    }
    navigate(destinationRoute(destination))
  }

  return <>
    <AdminPageHeader
      title="Descobrir Ofertas"
      description="Pesquise produtos de informática na Shopee, analise o anúncio e envie a prévia para o cadastro correto do CriaByte."
    />

    <section className="admin-discovery-search admin-card">
      <form onSubmit={search}>
        <label className="admin-field admin-discovery-query"><span>Pesquisar na Shopee</span><input className="admin-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: pc gamer, computador, kit upgrade, RTX 4060, Ryzen 5600G..." /></label>
        <label className="admin-field"><span>Resultados</span><select className="admin-select" value={limit} onChange={(event) => setLimit(Number(event.target.value))}><option value={12}>12</option><option value={24}>24</option><option value={40}>40</option><option value={60}>60</option></select></label>
        <label className="admin-discovery-check"><input type="checkbox" checked={onlyPromotions} onChange={(event) => setOnlyPromotions(event.target.checked)} /> Somente promoções</label>
        <button className="btn btn-primario" type="submit" disabled={loading}>{loading ? 'Pesquisando...' : 'Pesquisar'}</button>
      </form>
      <div className="admin-discovery-status">
        <strong>Shopee Affiliate API</strong>
        <span>{status?.projetoIaConfigurado ? 'Integração pronta para consulta.' : 'A busca precisa do ProjetoIA configurado no backend.'}</span>
      </div>
    </section>

    {error && <div className="admin-form-error admin-discovery-error">{error}</div>}

    <section className="admin-discovery-summary">
      <strong>{normalizedResults.length} resultado(s)</strong>
      <span>A classificação inicial só direciona o cadastro. Nenhum produto é salvo sem revisão.</span>
    </section>

    <section className="admin-discovery-grid">
      {normalizedResults.map((item) => {
        const analysis = analyses[item._key]
        const suggestions = componentSuggestions(analysis?.buildAnalysis)
        const destination = clean(analysis?.preview?.destinoSugerido).toUpperCase() || expectedDestination(item._category)
        return <article className="admin-discovery-card" key={item._key}>
          <div className="admin-discovery-image">
            {item.imagemUrl ? <img src={item.imagemUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <span>Sem imagem</span>}
          </div>
          <div className="admin-discovery-body">
            <div className="admin-discovery-tags"><span>Shopee</span><span>{CATEGORY_LABELS[item._category] || 'Produto'}</span>{item.emPromocao && <span>Promoção</span>}</div>
            <h2>{item.nome || 'Produto sem nome'}</h2>
            <p className="admin-discovery-store">{item.loja || 'Loja não informada'}{item.vendas != null ? ` · ${item.vendas} venda(s)` : ''}{item.avaliacao != null ? ` · ★ ${item.avaliacao}` : ''}</p>
            <strong className="admin-discovery-price">{money(item.preco ?? item.precoMin)}</strong>
            <div className="admin-discovery-actions">
              {(item.urlAfiliada || item.urlOriginal) && <a className="btn btn-secundario btn-pequeno" href={item.urlAfiliada || item.urlOriginal} target="_blank" rel="noopener noreferrer">Ver anúncio</a>}
              <button className="btn btn-secundario btn-pequeno" type="button" disabled={analyzingId !== null} onClick={() => analyze(item)}>{analyzingId === item._key ? 'Analisando...' : analysis ? 'Analisar novamente' : 'Analisar'}</button>
              <button className="btn btn-primario btn-pequeno" type="button" onClick={() => register(item)}>Cadastrar</button>
            </div>

            {analysis && <div className="admin-discovery-analysis">
              <div><span>Destino sugerido</span><strong>{CATEGORY_LABELS[item._category] || destination}</strong></div>
              {destination === 'PC_MONTADO' && <>
                <div><span>Catálogo consultado</span><strong>{analysis.buildAnalysis?.catalogoConsultado ?? '—'}</strong></div>
                {suggestions.length > 0
                  ? <div className="admin-discovery-components"><span>Peças encontradas no CriaByte</span>{suggestions.map((part, index) => <small key={`${part.id || part.nome}-${index}`}>{part.categoria ? `${part.categoria}: ` : ''}{part.nome || `Hardware #${part.id}`}{part.id ? ` (#${part.id})` : ''}</small>)}</div>
                  : <small>Se alguma peça não puder ser confirmada, ela continuará apenas na descrição do PC/kit.</small>}
                {analysis.buildWarning && <small className="admin-inline-warning">{analysis.buildWarning}</small>}
              </>}
              {destination !== 'PC_MONTADO' && <small>A prévia será enviada para o cadastro correspondente para revisão antes de salvar.</small>}
            </div>}
          </div>
        </article>
      })}
      {!loading && !normalizedResults.length && <div className="admin-discovery-empty"><strong>Pesquise qualquer produto de informática.</strong><span>“pc”, “computador”, “kit upgrade”, “RTX 4060”, “SSD NVMe”, “monitor” e outros termos podem ser usados.</span></div>}
    </section>
  </>
}
