import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { offerSuggestionsService } from '../../services/offerSuggestionsService'
import { getProductById } from '../../services/productsService'
import { formatCurrency } from '../../utils/display'
import { setDocumentMeta } from '../../utils/pageMeta'
import './OfferSuggestion.css'

const EMPTY_FORM = {
  nome: '',
  urlOriginal: '',
  categoria: '',
  preco: '',
  precoAnterior: '',
  observacao: '',
}

const STATUS_LABELS = {
  EM_ANALISE: 'Em análise',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
}

function prettyOption(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase('pt-BR'))
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function buildSpecs(fields, values) {
  const specs = {}
  fields.forEach((field) => {
    const raw = values[field.chave]
    if (raw === '' || raw === null || raw === undefined) return
    if (field.tipo === 'numero') {
      const value = Number(raw)
      if (Number.isFinite(value)) specs[field.chave] = value
      return
    }
    if (field.tipo === 'booleano') {
      if (raw === 'true' || raw === true) specs[field.chave] = true
      if (raw === 'false' || raw === false) specs[field.chave] = false
      return
    }
    specs[field.chave] = String(raw).trim()
  })
  return specs
}

const FIELD_PLACEHOLDERS = {
  nucleos: 'Ex.: 8',
  threads: 'Ex.: 16',
  frequenciaBaseGhz: 'Ex.: 3.8',
  frequenciaBoostGhz: 'Ex.: 5.4',
  tdpW: 'Ex.: 120',
  alturaMm: 'Ex.: 158',
  radiadorMm: 'Ex.: 240',
  slotsMemoria: 'Ex.: 4',
  capacidadeGb: 'Ex.: 1000',
  frequenciaMtS: 'Ex.: 6000',
  modulos: 'Ex.: 2',
  latenciaCl: 'Ex.: 30',
  vramGb: 'Ex.: 12',
  tgpW: 'Ex.: 250',
  comprimentoMm: 'Ex.: 304',
  leituraMbS: 'Ex.: 7450',
  escritaMbS: 'Ex.: 6900',
  potenciaW: 'Ex.: 850',
  gpuMaxMm: 'Ex.: 400',
  coolerMaxMm: 'Ex.: 180',
  radiadorMaxMm: 'Ex.: 360',
  tamanhoMm: 'Ex.: 120',
  rpmMax: 'Ex.: 1800',
}

function fieldPlaceholder(field) {
  return field.placeholder || FIELD_PLACEHOLDERS[field.chave] || (field.tipo === 'numero' ? 'Ex.: 100' : '')
}

function DynamicField({ field, value, onChange }) {
  const id = `sugestao-${field.chave}`
  const label = <>{field.rotulo}{field.unidade ? ` (${field.unidade})` : ''}{field.recomendado ? <span className="offer-suggestion-recommended"> recomendado</span> : null}</>

  if (field.tipo === 'booleano') {
    return <label className="offer-suggestion-field" htmlFor={id}><span>{label}</span><select id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select></label>
  }

  if (field.tipo === 'selecao') {
    return <label className="offer-suggestion-field" htmlFor={id}><span>{label}</span><select id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)}><option value="">Selecione</option>{(field.opcoes || []).map((option) => <option key={option} value={option}>{prettyOption(option)}</option>)}</select></label>
  }

  return <label className="offer-suggestion-field" htmlFor={id}><span>{label}</span><input id={id} type={field.tipo === 'numero' ? 'number' : 'text'} min={field.tipo === 'numero' ? field.minimo : undefined} max={field.tipo === 'numero' ? field.maximo : undefined} step={field.tipo === 'numero' ? 'any' : undefined} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={fieldPlaceholder(field)} /></label>
}

export default function OfferSuggestion() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const productId = searchParams.get('produtoId')
  const [schema, setSchema] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [specs, setSpecs] = useState({})
  const [history, setHistory] = useState([])
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedCategory = useMemo(() => schema?.categorias?.find((item) => item.categoria === form.categoria) || null, [schema, form.categoria])

  useEffect(() => {
    setDocumentMeta({
      title: 'Enviar oferta — CriaByte',
      description: 'Envie uma oferta encontrada para análise da equipe CriaByte.',
    })
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      offerSuggestionsService.fields(),
      offerSuggestionsService.mine().catch(() => ({ sugestoes: [] })),
      productId ? getProductById(productId).catch(() => null) : Promise.resolve(null),
    ]).then(([fields, mine, linkedProduct]) => {
      if (!active) return
      setSchema(fields)
      setHistory(mine.sugestoes || [])
      setProduct(linkedProduct)
      setLoading(false)
    }).catch((err) => {
      if (!active) return
      setError(err?.message || 'Não foi possível carregar o formulário.')
      setLoading(false)
    })
    return () => { active = false }
  }, [productId])

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    if (key === 'categoria') setSpecs({})
    setError('')
    setSuccess('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!selectedCategory) {
      setError('Escolha a categoria do produto.')
      return
    }
    const price = Number(form.preco)
    if (!Number.isFinite(price) || price <= 0) {
      setError('Informe um preço válido.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const body = {
        nome: form.nome.trim(),
        urlOriginal: form.urlOriginal.trim(),
        categoria: form.categoria,
        preco: price,
        especificacoes: buildSpecs(selectedCategory.campos || [], specs),
        ...(form.precoAnterior !== '' ? { precoAnterior: Number(form.precoAnterior) } : {}),
        ...(productId ? { produtoId: Number(productId) } : {}),
        ...(form.observacao.trim() ? { observacao: form.observacao.trim() } : {}),
      }
      await offerSuggestionsService.create(body)
      const mine = await offerSuggestionsService.mine().catch(() => ({ sugestoes: [] }))
      setHistory(mine.sugestoes || [])
      setForm({ ...EMPTY_FORM, categoria: form.categoria })
      setSpecs({})
      setSuccess('Sugestão enviada. Ela ficará em análise antes de virar uma oferta publicada.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err?.message || 'Não foi possível enviar a sugestão.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page-container offer-suggestion-state">Carregando formulário...</div>

  return <main className="offer-suggestion-page">
    <section className="page-container offer-suggestion-hero">
      <div>
        <span className="eyebrow">Comunidade CriaByte</span>
        <h1>Encontrou uma oferta?</h1>
        <p>Envie o link e os dados principais. A sugestão entra como <strong>Em análise</strong> e só vira uma oferta do site depois da aprovação do Admin.</p>
      </div>
      <div className="offer-suggestion-limit"><span>Limite</span><strong>{schema?.limiteSugestoesPor24h ?? 10}</strong><small>sugestões a cada 24 horas</small></div>
    </section>

    <section className="page-container offer-suggestion-layout">
      <form className="offer-suggestion-card" onSubmit={submit}>
        <header><div><span className="eyebrow">Nova sugestão</span><h2>Dados da oferta</h2></div><span className="offer-suggestion-status status-review">EM ANÁLISE</span></header>

        {productId && <div className="offer-suggestion-linked-product"><strong>Produto relacionado</strong><span>{product?.name || product?.nome || `Produto #${productId}`}</span><small>O Admin ainda confere se o link realmente corresponde a este Produto.</small></div>}

        <div className="offer-suggestion-grid">
          <label className="offer-suggestion-field full"><span>Link da oferta *</span><input type="url" required value={form.urlOriginal} onChange={(event) => updateForm('urlOriginal', event.target.value)} placeholder="https://loja.com/produto" /></label>
          <label className="offer-suggestion-field full"><span>Nome do produto *</span><input required maxLength="200" value={form.nome} onChange={(event) => updateForm('nome', event.target.value)} placeholder="Ex.: Kingston Fury Beast 32GB DDR5 6000" /></label>
          <label className="offer-suggestion-field"><span>Categoria *</span><select required value={form.categoria} onChange={(event) => updateForm('categoria', event.target.value)}><option value="">Selecione</option>{(schema?.categorias || []).map((category) => <option key={category.categoria} value={category.categoria}>{category.rotulo}</option>)}</select></label>
          <label className="offer-suggestion-field"><span>Preço atual *</span><input required type="number" min="0.01" step="0.01" value={form.preco} onChange={(event) => updateForm('preco', event.target.value)} placeholder="0,00" /></label>
          <label className="offer-suggestion-field"><span>Preço anterior</span><input type="number" min="0.01" step="0.01" value={form.precoAnterior} onChange={(event) => updateForm('precoAnterior', event.target.value)} placeholder="Opcional" /></label>
        </div>

        {selectedCategory && <section className="offer-suggestion-tech">
          <div className="offer-suggestion-tech__heading"><div><h3>{selectedCategory.rotulo}</h3><p>Preencha o que conseguir confirmar no anúncio. Esses dados ajudam o Admin a identificar a peça; eles não criam Hardware automaticamente.</p></div><span>{selectedCategory.campos?.length || 0} campos</span></div>
          <div className="offer-suggestion-grid">{(selectedCategory.campos || []).map((field) => <DynamicField key={field.chave} field={field} value={specs[field.chave]} onChange={(value) => setSpecs((current) => ({ ...current, [field.chave]: value }))} />)}</div>
        </section>}

        <label className="offer-suggestion-field full offer-suggestion-observation"><span>Observação</span><textarea maxLength="1000" value={form.observacao} onChange={(event) => updateForm('observacao', event.target.value)} placeholder="Ex.: promoção encontrada hoje, cupom, detalhes do anúncio..." /></label>

        {error && <p className="offer-suggestion-message error">{error}</p>}
        {success && <p className="offer-suggestion-message success">{success}</p>}

        <footer><small>Enviado por {user?.nome || 'sua conta'}. A oferta não é publicada automaticamente.</small><button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Enviando...' : 'Enviar para análise'}</button></footer>
      </form>

      <aside className="offer-suggestion-history">
        <div className="offer-suggestion-history__heading"><div><span className="eyebrow">Acompanhamento</span><h2>Minhas sugestões</h2></div><span>{history.length}</span></div>
        {!history.length ? <div className="offer-suggestion-empty"><strong>Nenhuma sugestão ainda.</strong><p>Depois do primeiro envio, o status aparece aqui.</p></div> : <div className="offer-suggestion-history__list">{history.map((item) => <article key={item.id} className="offer-suggestion-history__item">
          <div className="offer-suggestion-history__top"><span className={`offer-suggestion-status status-${String(item.status || '').toLowerCase().replaceAll('_', '-')}`}>{STATUS_LABELS[item.status] || item.status}</span><small>{formatDate(item.criadoEm)}</small></div>
          <h3>{item.nome}</h3>
          <p>{prettyOption(item.categoria)} · {formatCurrency(item.preco)}</p>
          {item.produto?.nome && <small>Produto: {item.produto.nome}</small>}
          {item.status === 'REJEITADA' && item.analise?.motivo && <div className="offer-suggestion-rejection"><strong>Motivo</strong><span>{item.analise.motivo}</span></div>}
          {item.status === 'APROVADA' && <div className="offer-suggestion-approved"><span>Oferta #{item.ofertaId || 'criada'}</span>{item.ofertaUrlAfiliada && <a href={item.ofertaUrlAfiliada} target="_blank" rel="sponsored noopener noreferrer">Abrir oferta</a>}</div>}
          <a className="offer-suggestion-source" href={item.urlOriginal} target="_blank" rel="noopener noreferrer">Ver link enviado ↗</a>
        </article>)}</div>}
      </aside>
    </section>
  </main>
}
