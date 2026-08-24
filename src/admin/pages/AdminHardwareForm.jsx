import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { AdminBack, AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { AdminTechnicalFields, hardwareSchemaFor, normalizeSpec, readSpec } from '../components/AdminTechnicalFields'

const CATEGORIES = ['PROCESSADOR','COOLER','PLACA_MAE','MEMORIA_RAM','PLACA_VIDEO','ARMAZENAMENTO','FONTE','GABINETE','VENTOINHA','MONITOR','MOUSE','TECLADO','FONE','MICROFONE']
const EMPTY = { nome:'', categoria:'PROCESSADOR', marca:'', modelo:'', descricao:'', mpn:'', gtin:'', imagemUrl:'', imagemHoverUrl:'', especificacoes:'{}', publicado:false, ativo:true }

function cleanText(value) {
  return String(value ?? '').trim()
}

function normalizeHardwareForm(item = {}) {
  return {
    ...EMPTY,
    ...item,
    nome: String(item.nome ?? ''),
    categoria: normalizeHardwareCategory(item.categoria),
    marca: String(item.marca ?? ''),
    modelo: String(item.modelo ?? ''),
    descricao: String(item.descricao ?? ''),
    mpn: String(item.mpn ?? ''),
    gtin: normalizeGtin(item.gtin),
    imagemUrl: String(item.imagemUrl ?? ''),
    imagemHoverUrl: String(item.imagemHoverUrl ?? ''),
    especificacoes: JSON.stringify(item.especificacoes || {}, null, 2),
    publicado: Boolean(item.publicado),
    ativo: typeof item.ativo === 'boolean' ? item.ativo : true,
  }
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


function normalizeHardwareCategory(value, fallback = EMPTY.categoria) {
  const raw = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  const token = raw.replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (CATEGORIES.includes(token)) return token
  const compact = token.replaceAll('_', '')
  const aliases = {
    PLACAMAE: 'PLACA_MAE',
    MOTHERBOARD: 'PLACA_MAE',
    MEMORIARAM: 'MEMORIA_RAM',
    RAM: 'MEMORIA_RAM',
    PLACAVIDEO: 'PLACA_VIDEO',
    GPU: 'PLACA_VIDEO',
    PROCESSADOR: 'PROCESSADOR',
    CPU: 'PROCESSADOR',
    COOLERCPU: 'COOLER',
    AIRCOOLER: 'COOLER',
    WATERCOOLER: 'COOLER',
    REFRIGERACAO: 'COOLER',
    SSD: 'ARMAZENAMENTO',
    HDD: 'ARMAZENAMENTO',
    STORAGE: 'ARMAZENAMENTO',
    PSU: 'FONTE',
    POWER: 'FONTE',
    CASE: 'GABINETE',
    FAN: 'VENTOINHA',
  }
  return aliases[compact] || fallback
}


function technicalFromPreview(schema, source = {}) {
  if (!schema) return {}
  const keys = [...schema.fields.map(([key]) => key), ...(schema.repeaters || []).map((item) => item.key)]
  return Object.fromEntries(keys.flatMap((key) => source[key] !== undefined && source[key] !== null ? [[key, source[key]]] : []))
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

function hardwareInitialFromPreview(preview) {
  if (!preview) return EMPTY
  const source = preview?.normalizacao?.camposNormalizados || {}
  const categoria = normalizeHardwareCategory(source.categoria)
  const imagem = source.imagemUrl || preview?.coleta?.meta?.imagem || preview?.coleta?.meta?.ogImage || ''
  const identityKeys = new Set(['categoria','nome','marca','modelo','descricao','mpn','gtin','ean','imagemUrl','preco','evidencias'])
  const extras = Object.fromEntries(Object.entries(source).filter(([key, value]) => !identityKeys.has(key) && value !== null && value !== ''))
  return { ...EMPTY, categoria, nome: source.nome || '', marca: source.marca || '', modelo: source.modelo || '', descricao: source.descricao || '', mpn: source.mpn || '', gtin: normalizeGtin(source.gtin || source.ean || ''), imagemUrl: imagem || '', especificacoes: JSON.stringify({ ...(source.evidencias ? { evidencias: source.evidencias } : {}), ...extras }, null, 2) }
}

function PreviewList({ title, items = [], tone = '' }) {
  const clean = (Array.isArray(items) ? items : []).filter(Boolean)
  if (!clean.length) return null
  return <div className={`admin-import-preview-list ${tone}`}><strong>{title}</strong><ul>{clean.map((item, index) => <li key={`${title}-${index}`}>{String(item)}</li>)}</ul></div>
}

export default function AdminHardwareForm() {
  const { id } = useParams()
  const editing = id && id !== 'novo'
  const navigate = useNavigate()
  const toast = useAdminToast()
  const { user } = useAuth()
  const canImportLink = String(user?.papel || '').toUpperCase() === 'ADMIN'
  const [transferredPreview] = useState(() => editing ? null : consumeTransferredPreview('HARDWARE'))
  const [form, setForm] = useState(() => hardwareInitialFromPreview(transferredPreview))
  const [technical, setTechnical] = useState(() => {
    const source = transferredPreview?.normalizacao?.camposNormalizados || {}
    const category = normalizeHardwareCategory(source.categoria)
    return technicalFromPreview(hardwareSchemaFor(category), source)
  })
  const [loading, setLoading] = useState(Boolean(editing))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importUrl, setImportUrl] = useState(() => transferredPreview?.urlOrigem || '')
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(transferredPreview)
  const [dirty, setDirty] = useState(Boolean(transferredPreview))
  const originalFormRef = useRef(null)
  const originalTechnicalRef = useRef(null)
  const originalSpecsRef = useRef({})

  const schema = useMemo(() => hardwareSchemaFor(form.categoria), [form.categoria])

  useEffect(() => {
    if (!editing) return
    let active = true
    adminService.hardwares.get(id).then((item) => {
      if (!active) return
      const next = normalizeHardwareForm(item)
      const nextTechnical = readSpec(item, hardwareSchemaFor(next.categoria))
      setForm(next)
      setTechnical(nextTechnical)
      originalFormRef.current = structuredClone(next)
      originalTechnicalRef.current = structuredClone(nextTechnical)
      originalSpecsRef.current = structuredClone(item.especificacoes || {})
      setDirty(false)
    }).catch((err) => active && setError(err)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [editing, id])

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
    setForm((current) => ({ ...current, categoria: value }))
    setTechnical({})
  }

  function updateTechnical(key, value) {
    setDirty(true)
    setTechnical((current) => ({ ...current, [key]: value }))
  }

  function applyImportPreview(preview = importPreview, notify = true) {
    const source = preview?.normalizacao?.camposNormalizados || {}
    if (!Object.keys(source).length) {
      toast.show('Não existem dados normalizados para aplicar. Faça o cadastro manualmente.', 'alerta')
      return
    }
    if (preview?.destinoSugerido === 'PRODUTO') {
      try { sessionStorage.setItem('criabyteAdminIaImportPreview', JSON.stringify(preview)) } catch { /* opcional */ }
      navigate('/admin/produtos/novo?origem=ia-importacao')
      return
    }
    const importedCategory = normalizeHardwareCategory(source.categoria, form.categoria)
    const importedSchema = hardwareSchemaFor(importedCategory)
    const imagem = source.imagemUrl || preview?.coleta?.meta?.imagem || preview?.coleta?.meta?.ogImage || ''
    const identityKeys = new Set(['categoria','nome','marca','modelo','descricao','mpn','gtin','ean','imagemUrl','preco','evidencias'])
    const extras = Object.fromEntries(Object.entries(source).filter(([key, value]) => !identityKeys.has(key) && value !== null && value !== ''))
    setForm((current) => ({
      ...current,
      categoria: importedCategory,
      nome: source.nome || current.nome,
      marca: source.marca || current.marca,
      modelo: source.modelo || current.modelo,
      descricao: source.descricao || current.descricao,
      mpn: source.mpn || current.mpn,
      gtin: normalizeGtin(source.gtin || source.ean || current.gtin),
      imagemUrl: imagem || current.imagemUrl,
      especificacoes: JSON.stringify({ ...(source.evidencias ? { evidencias: source.evidencias } : {}), ...extras }, null, 2),
    }))
    if (importedSchema) setTechnical((current) => ({ ...current, ...technicalFromPreview(importedSchema, source) }))
    setDirty(true)
    if (notify) toast.show('Prévia aplicada. Revise a ficha técnica e salve somente quando estiver correto.')
  }

  async function importData() {
    if (!canImportLink || !importUrl.trim()) return
    setImporting(true)
    setImportPreview(null)
    try {
      const result = await adminService.ai.importLink(importUrl.trim())
      setImportPreview(result)
      if (result?.iaDisponivel === false) {
        toast.show(result?.avisoIa || 'Página coletada, mas a IA não conseguiu normalizar os dados.', 'alerta')
      } else if (result?.destinoSugerido === 'HARDWARE') {
        applyImportPreview(result, false)
        toast.show('Dados encontrados no fabricante/loja foram preenchidos. Revise antes de salvar.')
      } else {
        toast.show('A página parece ser um Produto. Use a ação abaixo para continuar no cadastro correto.', 'alerta')
      }
    } catch (err) {
      toast.show(err.message, 'erro')
    } finally {
      setImporting(false)
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
      let specs = {}
      try { specs = cleanText(form.especificacoes) ? JSON.parse(cleanText(form.especificacoes)) : {} } catch { throw new Error('O JSON de especificações adicionais está inválido.') }
      const fullBody = {
        nome: cleanText(form.nome), categoria: form.categoria, marca: cleanText(form.marca), modelo: cleanText(form.modelo),
        descricao: cleanText(form.descricao) || undefined, mpn: cleanText(form.mpn) || undefined, gtin: cleanText(form.gtin) || undefined,
        imagemUrl: cleanText(form.imagemUrl) || undefined, imagemHoverUrl: cleanText(form.imagemHoverUrl) || undefined,
        especificacoes: specs, publicado: draft ? false : Boolean(form.publicado), ativo: Boolean(form.ativo),
      }
      if (schema) fullBody[schema.key] = normalizeSpec(schema, technical)

      let body = fullBody
      if (editing) {
        const original = originalFormRef.current || {}
        body = {}
        const currentText = {
          nome: cleanText(form.nome),
          marca: cleanText(form.marca),
          modelo: cleanText(form.modelo),
          descricao: cleanText(form.descricao),
          mpn: cleanText(form.mpn),
          gtin: cleanText(form.gtin),
          imagemUrl: cleanText(form.imagemUrl),
          imagemHoverUrl: cleanText(form.imagemHoverUrl),
        }
        const originalText = {
          nome: cleanText(original.nome),
          marca: cleanText(original.marca),
          modelo: cleanText(original.modelo),
          descricao: cleanText(original.descricao),
          mpn: cleanText(original.mpn),
          gtin: cleanText(original.gtin),
          imagemUrl: cleanText(original.imagemUrl),
          imagemHoverUrl: cleanText(original.imagemHoverUrl),
        }
        for (const key of ['nome', 'marca', 'modelo', 'descricao', 'mpn', 'gtin']) {
          if (currentText[key] !== originalText[key]) body[key] = currentText[key]
        }
        for (const key of ['imagemUrl', 'imagemHoverUrl']) {
          if (currentText[key] !== originalText[key] && currentText[key]) body[key] = currentText[key]
        }
        if (JSON.stringify(specs) !== JSON.stringify(originalSpecsRef.current || {})) body.especificacoes = specs

        const nextPublished = draft ? false : Boolean(form.publicado)
        if (nextPublished !== Boolean(original.publicado)) body.publicado = nextPublished
        if (Boolean(form.ativo) !== Boolean(original.ativo)) body.ativo = Boolean(form.ativo)

        if (schema) {
          const currentTechnical = normalizeSpec(schema, technical)
          const originalTechnical = normalizeSpec(schema, originalTechnicalRef.current || {})
          if (JSON.stringify(currentTechnical) !== JSON.stringify(originalTechnical)) body[schema.key] = currentTechnical
        }

        if (!Object.keys(body).length) {
          setDirty(false)
          toast.show('Nenhuma alteração para salvar.')
          return
        }
      }

      const saved = editing ? await adminService.hardwares.update(id, body) : await adminService.hardwares.create(body)
      if (editing) {
        const nextPublished = draft ? false : Boolean(form.publicado)
        const nextForm = { ...form, publicado: nextPublished }
        setForm(nextForm)
        originalFormRef.current = structuredClone(nextForm)
        originalTechnicalRef.current = structuredClone(technical)
        originalSpecsRef.current = structuredClone(specs)
      }
      setDirty(false)
      toast.show(draft ? 'Hardware salvo como rascunho.' : 'Hardware salvo.')
      if (editing) navigate(`/admin/hardwares/${saved?.id || id}`, { replace: true })
      else navigate('/admin/hardwares', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLoading />
  if (error && editing && !form.nome) return <AdminError error={error} />

  return <>
    <AdminPageHeader title={editing ? 'Editar hardware' : 'Cadastrar hardware'} description="Cadastro completo alinhado aos DTOs técnicos do backend, incluindo compatibilidade, dimensões, energia, conectividade e refrigeração."><AdminBack to="/admin/hardwares">Cancelar</AdminBack></AdminPageHeader>
    <form className="admin-form-layout" onSubmit={submit}>
      <div className="admin-form-card">
        {canImportLink && <section className="admin-form-section admin-import-section">
          <div className="admin-section-heading"><div><h2>Importar por link com IA</h2><p>A URL é analisada no backend e vira uma prévia editável. Nada é salvo automaticamente.</p></div><span className="admin-import-badge">Somente ADMIN</span></div>
          <div className="admin-form-grid"><div className="admin-field full"><label>URL original</label><input className="admin-input" type="url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://fabricante-ou-loja.com/produto" /></div><div className="admin-field full"><button className="btn btn-primario" type="button" disabled={importing || !importUrl.trim()} onClick={importData}>{importing ? 'Analisando página...' : 'Analisar produto'}</button></div></div>
          {importPreview && <div className="admin-import-preview">
            <div className="admin-import-preview-head"><div><span className="admin-import-preview-status">{importPreview.status || 'PRÉVIA'}</span><h3>Prévia para revisão</h3></div><strong>{importPreview.destinoSugerido === 'PRODUTO' ? 'Produto' : 'Hardware'}</strong></div>
            {importPreview.avisoIa && <p className="admin-inline-warning">{importPreview.avisoIa}</p>}
            {importPreview.normalizacao?.textoExplicativo && <p className="admin-import-preview-copy">{importPreview.normalizacao.textoExplicativo}</p>}
            <div className="admin-import-preview-fields">{Object.entries(importPreview.normalizacao?.camposNormalizados || {}).filter(([key, value]) => !['evidencias'].includes(key) && value !== null && value !== '' && typeof value !== 'object').slice(0, 12).map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}</div>
            <PreviewList title="Revisar" items={importPreview.normalizacao?.alertas} tone="warn" />
            <PreviewList title="Não encontrado" items={importPreview.normalizacao?.ausentes} tone="missing" />
            <div className="admin-import-preview-actions"><button className="btn btn-secundario" type="button" onClick={() => { setImportPreview(null); setImportUrl('') }}>Descartar prévia</button><button className="btn btn-primario" type="button" onClick={() => applyImportPreview()}>{importPreview.destinoSugerido === 'PRODUTO' ? 'Continuar no cadastro de Produto' : 'Aplicar prévia ao formulário'}</button></div>
            <small className="admin-help">Revise os campos marcados antes de confirmar o cadastro.</small>
          </div>}
        </section>}

        <section className="admin-form-section"><h2>Identificação</h2><div className="admin-form-grid">
          <div className="admin-field full"><label>Nome</label><input className="admin-input" required value={form.nome} onChange={(e) => update('nome', e.target.value)} /></div>
          <div className="admin-field"><label>Categoria</label><select className="admin-select" value={form.categoria} disabled={Boolean(editing)} onChange={(e) => changeCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>{editing && <small className="admin-help">A categoria não pode ser alterada depois do cadastro.</small>}</div>
          <div className="admin-field"><label>Marca</label><input className="admin-input" required value={form.marca} onChange={(e) => update('marca', e.target.value)} /></div>
          <div className="admin-field"><label>Modelo</label><input className="admin-input" required value={form.modelo} onChange={(e) => update('modelo', e.target.value)} /></div>
          <div className="admin-field"><label>MPN</label><input className="admin-input" value={form.mpn} onChange={(e) => update('mpn', e.target.value)} /></div>
          <div className="admin-field"><label>GTIN/EAN</label><input className="admin-input" aria-invalid={form.gtin && !validGtin(form.gtin) ? 'true' : 'false'} inputMode="numeric" value={form.gtin} onChange={(e) => update('gtin', normalizeGtin(e.target.value))} />{form.gtin && !validGtin(form.gtin) && <small className="admin-inline-warning">GTIN/EAN inválido.</small>}</div>
          <div className="admin-field full"><label>Descrição</label><textarea className="admin-textarea" value={form.descricao} onChange={(e) => update('descricao', e.target.value)} /></div>
        </div></section>

        <section className="admin-form-section"><AdminTechnicalFields schema={schema} values={technical} onChange={updateTechnical} /></section>

        <section className="admin-form-section"><h2>Imagens e dados adicionais</h2><div className="admin-form-grid">
          <div className="admin-field full"><label>Imagem principal</label><input className="admin-input" value={form.imagemUrl} onChange={(e) => update('imagemUrl', e.target.value)} placeholder="https://..." /></div>
          <div className="admin-field full"><label>Imagem hover</label><input className="admin-input" value={form.imagemHoverUrl} onChange={(e) => update('imagemHoverUrl', e.target.value)} placeholder="https://..." /></div>
          <div className="admin-field full"><label>Especificações adicionais (JSON)</label><textarea className="admin-textarea admin-code-area" value={form.especificacoes} onChange={(e) => update('especificacoes', e.target.value)} /><small className="admin-help">Use apenas para campos extras. A ficha principal acima é enviada nos objetos técnicos oficiais do backend.</small></div>
        </div></section>

        {error && <div className="admin-form-section"><p className="admin-form-error">{error.message}</p></div>}
        <footer className="admin-form-footer"><span className={`admin-unsaved-state ${dirty ? 'is-dirty' : ''}`}>{dirty ? 'Alterações não salvas' : 'Tudo salvo'}</span><button className="btn btn-secundario" type="button" disabled={saving} onClick={(e) => submit(e, true)}>Salvar rascunho</button><button className="btn btn-primario" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar hardware'}</button></footer>
      </div>
      <aside className="admin-sticky-side"><div className="admin-card"><header className="admin-card-header"><h2>Estado</h2></header><div className="admin-card-body"><label className="admin-switch"><input type="checkbox" checked={form.publicado} onChange={(e) => update('publicado', e.target.checked)} /> Publicado</label><br/><br/><label className="admin-switch"><input type="checkbox" checked={form.ativo} onChange={(e) => update('ativo', e.target.checked)} /> Ativo</label></div></div>{editing && <div className="admin-info-box">Modelos 3D deste hardware podem ser gerenciados em <strong>Modelos 3D</strong>.</div>}</aside>
    </form>
  </>
}
