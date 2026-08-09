import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { AdminBack, AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { AdminTechnicalFields, normalizeSpec, productSchemaFor, readSpec } from '../components/AdminTechnicalFields'

const EMPTY = { categoriaId: '', nome: '', marca: '', modelo: '', descricao: '', mpn: '', gtin: '', imagemUrl: '', imagemHoverUrl: '', publicado: false, ativo: true, metadados: '{}' }

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


function normalizeToken(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function findCategoryFromPreview(categories, sourceCategory) {
  const target = normalizeToken(sourceCategory)
  if (!target) return null
  return categories.find((category) => {
    const candidates = [category?.nome, category?.slug, category?.codigo, category?.categoria].map(normalizeToken).filter(Boolean)
    return candidates.some((candidate) => candidate === target || candidate.includes(target) || target.includes(candidate))
  }) || null
}

function technicalFromPreview(schema, source = {}) {
  if (!schema) return {}
  return Object.fromEntries(schema.fields.flatMap(([key]) => source[key] !== undefined && source[key] !== null ? [[key, source[key]]] : []))
}

function consumeTransferredPreview(expectedDestination) {
  try {
    const raw = sessionStorage.getItem('criabyteAdminIaImportPreview')
    if (!raw) return null
    const preview = JSON.parse(raw)
    if (preview?.destinoSugerido !== expectedDestination) return null
    sessionStorage.removeItem('criabyteAdminIaImportPreview')
    return preview
  } catch {
    sessionStorage.removeItem('criabyteAdminIaImportPreview')
    return null
  }
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
  const toast = useAdminToast()
  const { user } = useAuth()
  const role = String(user?.papel || '').toUpperCase()
  const canWriteAi = role === 'ADMIN' || role === 'EDITOR'
  const canImportLink = role === 'ADMIN'
  const [transferredPreview] = useState(() => editing ? null : consumeTransferredPreview('PRODUTO'))
  const [form, setForm] = useState(EMPTY)
  const [technical, setTechnical] = useState({})
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importUrl, setImportUrl] = useState(() => transferredPreview?.urlOrigem || '')
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(transferredPreview)
  const [dirty, setDirty] = useState(false)
  const [aiBusy, setAiBusy] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState('')

  const selectedCategory = useMemo(() => categories.find((c) => Number(c.id) === Number(form.categoriaId)), [categories, form.categoriaId])
  const schema = useMemo(() => productSchemaFor(selectedCategory), [selectedCategory])

  useEffect(() => {
    let active = true
    Promise.all([adminService.products.categories(), editing ? adminService.products.get(id) : Promise.resolve(null)])
      .then(([cats, item]) => {
        if (!active) return
        setCategories(cats)
        if (item) {
          const next = { ...EMPTY, ...item, categoriaId: item.categoriaId || item.categoria?.id || '', metadados: JSON.stringify(item.metadados || {}, null, 2) }
          setForm(next)
          const cat = cats.find((c) => Number(c.id) === Number(next.categoriaId))
          setTechnical(readSpec(item, productSchemaFor(cat)))
          setDirty(false)
        } else if (transferredPreview) {
          const source = transferredPreview?.normalizacao?.camposNormalizados || {}
          const category = findCategoryFromPreview(cats, source.categoria)
          const importedSchema = productSchemaFor(category)
          const imagem = source.imagemUrl || transferredPreview?.coleta?.meta?.imagem || transferredPreview?.coleta?.meta?.ogImage || ''
          setForm((current) => ({ ...current, categoriaId: category?.id || current.categoriaId, nome: source.nome || current.nome, marca: source.marca || current.marca, modelo: source.modelo || current.modelo, descricao: source.descricao || current.descricao, mpn: source.mpn || current.mpn, gtin: normalizeGtin(source.gtin || source.ean || current.gtin), imagemUrl: imagem || current.imagemUrl }))
          if (importedSchema) setTechnical(technicalFromPreview(importedSchema, source))
          setDirty(true)
        } else {
          setDirty(false)
        }
      }).catch((err) => active && setError(err)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [id, editing, transferredPreview])

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

  function changeCategory(value) {
    setDirty(true)
    setForm((current) => ({ ...current, categoriaId: value }))
    setTechnical({})
  }

  function updateTechnical(key, value) {
    setDirty(true)
    setTechnical((current) => ({ ...current, [key]: value }))
  }

  async function importData() {
    if (!canImportLink || !importUrl.trim()) return
    setImporting(true)
    setImportPreview(null)
    try {
      const result = await adminService.ai.importLink(importUrl.trim())
      setImportPreview(result)
      if (result?.iaDisponivel === false) toast.show(result?.avisoIa || 'Página coletada, mas a IA não conseguiu normalizar os dados.', 'alerta')
      else toast.show('Prévia criada. Revise os dados antes de aplicá-los ao formulário.')
    } catch (err) {
      toast.show(err.message, 'erro')
    } finally {
      setImporting(false)
    }
  }

  function applyImportPreview() {
    const source = importPreview?.normalizacao?.camposNormalizados || {}
    if (!Object.keys(source).length) {
      toast.show('Não existem dados normalizados para aplicar. Faça o cadastro manualmente.', 'alerta')
      return
    }
    if (importPreview?.destinoSugerido === 'HARDWARE') {
      try { sessionStorage.setItem('criabyteAdminIaImportPreview', JSON.stringify(importPreview)) } catch { /* opcional */ }
      navigate('/admin/hardwares/novo?origem=ia-importacao')
      return
    }

    const category = findCategoryFromPreview(categories, source.categoria)
    const nextCategoryId = category?.id || form.categoriaId
    const importedSchema = productSchemaFor(category || selectedCategory)
    const imagem = source.imagemUrl || importPreview?.coleta?.meta?.imagem || importPreview?.coleta?.meta?.ogImage || ''
    setForm((current) => ({
      ...current,
      categoriaId: nextCategoryId,
      nome: source.nome || current.nome,
      marca: source.marca || current.marca,
      modelo: source.modelo || current.modelo,
      descricao: source.descricao || current.descricao,
      mpn: source.mpn || current.mpn,
      gtin: normalizeGtin(source.gtin || source.ean || current.gtin),
      imagemUrl: imagem || current.imagemUrl,
    }))
    if (importedSchema) setTechnical((current) => ({ ...current, ...technicalFromPreview(importedSchema, source) }))
    setDirty(true)
    toast.show('Prévia aplicada ao formulário. Revise tudo e salve somente quando estiver correto.')
  }

  async function analyzeWithAi() {
    if (!editing) return
    setAiBusy('analyze')
    try {
      const result = await adminService.ai.analyzeProduct(id)
      setAiAnalysis(result?.analise || 'A IA não retornou uma análise.')
    } catch (err) {
      toast.show(err.message, 'erro')
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
      toast.show('Descrição gerada. Revise e salve para aplicar.')
    } catch (err) {
      toast.show(err.message, 'erro')
    } finally {
      setAiBusy('')
    }
  }

  async function submit(event, draft = false) {
    event?.preventDefault()
    if (!validGtin(form.gtin)) {
      setError(new Error('GTIN/EAN inválido. Confira a quantidade de dígitos e o dígito verificador.'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      let metadados = {}
      try { metadados = form.metadados.trim() ? JSON.parse(form.metadados) : {} } catch { throw new Error('O JSON de metadados está inválido.') }
      const body = {
        categoriaId: Number(form.categoriaId), nome: form.nome.trim(), marca: form.marca.trim() || undefined, modelo: form.modelo.trim() || undefined,
        descricao: form.descricao.trim() || undefined, mpn: form.mpn.trim() || undefined, gtin: form.gtin.trim() || undefined,
        imagemUrl: form.imagemUrl.trim() || undefined, imagemHoverUrl: form.imagemHoverUrl.trim() || undefined,
        metadados, publicado: draft ? false : Boolean(form.publicado), ativo: Boolean(form.ativo),
      }
      if (schema) body[schema.key] = normalizeSpec(schema, technical)
      const saved = editing ? await adminService.products.update(id, body) : await adminService.products.create(body)
      setDirty(false)
      toast.show(draft ? 'Produto salvo como rascunho.' : 'Produto salvo.')
      navigate(`/admin/produtos/${saved?.id || id}`, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLoading />
  if (error && !form.nome && editing) return <AdminError error={error} />

  return <>
    <AdminPageHeader title={editing ? 'Editar produto' : 'Cadastrar produto'} description="Ficha comercial separada das ofertas afiliadas."><AdminBack to="/admin/produtos">Cancelar</AdminBack></AdminPageHeader>
    <form className="admin-form-layout" onSubmit={submit}>
      <div className="admin-form-card">
        {canImportLink && <section className="admin-form-section admin-import-section">
          <div className="admin-section-heading"><div><h2>Importar por link com IA</h2><p>O backend coleta e normaliza a página. Nenhum cadastro é criado até você revisar e salvar.</p></div><span className="admin-import-badge">Somente ADMIN</span></div>
          <div className="admin-form-grid"><div className="admin-field full"><label>URL original</label><input className="admin-input" type="url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://fabricante-ou-loja.com/produto" /></div><div className="admin-field full"><button className="btn btn-primario" type="button" disabled={importing || !importUrl.trim()} onClick={importData}>{importing ? 'Analisando página...' : 'Analisar produto'}</button></div></div>
          {importPreview && <div className="admin-import-preview">
            <div className="admin-import-preview-head"><div><span className="admin-import-preview-status">{importPreview.status || 'PRÉVIA'}</span><h3>Prévia para revisão</h3></div><strong>{importPreview.destinoSugerido === 'HARDWARE' ? 'Hardware' : 'Produto'}</strong></div>
            {importPreview.avisoIa && <p className="admin-inline-warning">{importPreview.avisoIa}</p>}
            {importPreview.normalizacao?.textoExplicativo && <p className="admin-import-preview-copy">{importPreview.normalizacao.textoExplicativo}</p>}
            <div className="admin-import-preview-fields">
              {Object.entries(importPreview.normalizacao?.camposNormalizados || {}).filter(([key, value]) => !['evidencias'].includes(key) && value !== null && value !== '' && typeof value !== 'object').slice(0, 12).map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}
            </div>
            <PreviewList title="Revisar" items={importPreview.normalizacao?.alertas} tone="warn" />
            <PreviewList title="Não encontrado" items={importPreview.normalizacao?.ausentes} tone="missing" />
            <div className="admin-import-preview-actions"><button className="btn btn-secundario" type="button" onClick={() => { setImportPreview(null); setImportUrl('') }}>Descartar prévia</button><button className="btn btn-primario" type="button" onClick={applyImportPreview}>{importPreview.destinoSugerido === 'HARDWARE' ? 'Continuar no cadastro de Hardware' : 'Aplicar prévia ao formulário'}</button></div>
            <small className="admin-help">A aplicação apenas preenche campos editáveis. O salvamento continua manual.</small>
          </div>}
        </section>}

        <section className="admin-form-section"><h2>Identificação</h2><div className="admin-form-grid">
          <div className="admin-field full"><label>Nome</label><input className="admin-input" required value={form.nome} onChange={(e) => update('nome', e.target.value)} /></div>
          <div className="admin-field"><label>Categoria</label><select className="admin-select" required value={form.categoriaId} onChange={(e) => changeCategory(e.target.value)}><option value="">Selecione</option>{categories.map((cat) => <option value={cat.id} key={cat.id}>{cat.nome || cat.slug || `Categoria ${cat.id}`}</option>)}</select></div>
          <div className="admin-field"><label>Marca</label><input className="admin-input" value={form.marca} onChange={(e) => update('marca', e.target.value)} /></div>
          <div className="admin-field"><label>Modelo</label><input className="admin-input" value={form.modelo} onChange={(e) => update('modelo', e.target.value)} /></div>
          <div className="admin-field"><label>MPN</label><input className="admin-input" value={form.mpn} onChange={(e) => update('mpn', e.target.value)} /></div>
          <div className="admin-field"><label>GTIN/EAN</label><input className="admin-input" aria-invalid={form.gtin && !validGtin(form.gtin) ? 'true' : 'false'} inputMode="numeric" value={form.gtin} onChange={(e) => update('gtin', normalizeGtin(e.target.value))} />{form.gtin && !validGtin(form.gtin) && <small className="admin-inline-warning">GTIN/EAN inválido.</small>}</div>
          <div className="admin-field full"><label>Descrição</label><textarea className="admin-textarea" value={form.descricao} onChange={(e) => update('descricao', e.target.value)} /></div>
        </div></section>

        <section className="admin-form-section"><AdminTechnicalFields schema={schema} values={technical} onChange={updateTechnical} /></section>

        <section className="admin-form-section"><h2>Imagens e metadados</h2><div className="admin-form-grid">
          <div className="admin-field full"><label>Imagem principal</label><input className="admin-input" value={form.imagemUrl} onChange={(e) => update('imagemUrl', e.target.value)} placeholder="https://..." /></div>
          <div className="admin-field full"><label>Imagem hover</label><input className="admin-input" value={form.imagemHoverUrl} onChange={(e) => update('imagemHoverUrl', e.target.value)} placeholder="https://..." /></div>
          <div className="admin-field full"><label>Metadados JSON</label><textarea className="admin-textarea admin-code-area" value={form.metadados} onChange={(e) => update('metadados', e.target.value)} /><small className="admin-help">Use para dados adicionais que ainda não possuem campo próprio.</small></div>
        </div></section>

        {error && <div className="admin-form-section"><p className="admin-form-error">{error.message}</p></div>}
        <footer className="admin-form-footer"><span className={`admin-unsaved-state ${dirty ? 'is-dirty' : ''}`}>{dirty ? 'Alterações não salvas' : 'Tudo salvo'}</span><button className="btn btn-secundario" type="button" disabled={saving} onClick={(e) => submit(e, true)}>Salvar rascunho</button><button className="btn btn-primario" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar produto'}</button></footer>
      </div>
      <aside className="admin-sticky-side">
        <div className="admin-card"><header className="admin-card-header"><h2>Pré-visualização</h2></header><div className="admin-card-body"><article className="admin-preview-card"><div className="admin-preview-image">{form.imagemUrl ? <img src={form.imagemUrl} alt="" /> : <div className="admin-empty">Sem imagem</div>}</div><div className="admin-preview-content"><span className="admin-status status-rascunho">{form.publicado ? 'PUBLICADO' : 'RASCUNHO'}</span><h3>{form.nome || 'Nome do produto'}</h3><p>{form.descricao || 'A descrição aparecerá aqui.'}</p><strong className="admin-preview-price">{selectedCategory?.nome || 'Categoria'}</strong></div></article></div></div>
        {editing && <div className="admin-card admin-ai-product-card"><header className="admin-card-header"><div><h2>IA administrativa</h2><p>Usa somente os dados já cadastrados no backend.</p></div><span className="admin-stat-icon">✦</span></header><div className="admin-card-body"><div className="admin-ai-product-actions"><button className="btn btn-secundario" type="button" disabled={Boolean(aiBusy)} onClick={analyzeWithAi}>{aiBusy === 'analyze' ? 'Analisando...' : 'Analisar cadastro'}</button>{canWriteAi && <button className="btn btn-secundario" type="button" disabled={Boolean(aiBusy)} onClick={generateDescriptionWithAi}>{aiBusy === 'description' ? 'Gerando...' : 'Gerar descrição'}</button>}</div>{aiAnalysis && <div className="admin-ai-analysis">{aiAnalysis}</div>}<small className="admin-help">A IA não salva alterações automaticamente.</small></div></div>}
        <div className="admin-info-box"><label className="admin-switch"><input type="checkbox" checked={form.publicado} onChange={(e) => update('publicado', e.target.checked)} /> Publicado</label><br /><label className="admin-switch"><input type="checkbox" checked={form.ativo} onChange={(e) => update('ativo', e.target.checked)} /> Ativo</label></div>
      </aside>
    </form>
  </>
}
