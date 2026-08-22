import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { AdminBack, AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

const EMPTY = {
  nome: '', marca: '', modelo: '', descricao: '', mpn: '', gtin: '', imagemUrl: '', imagemHoverUrl: '',
  publicado: true, ativo: true, especificacao: '{}',
}

const NOTEBOOK_SPEC_FIELDS = new Set([
  'processadorNome', 'processadorMarca', 'processadorGeracao', 'nucleos', 'threads', 'clockBaseMhz', 'clockTurboMhz', 'tdpWatts',
  'gpuNome', 'gpuIntegrada', 'gpuDedicada', 'vramGb', 'tgpWatts',
  'ramInstaladaGb', 'tipoMemoria', 'frequenciaMhz', 'ramSoldadaGb', 'slotsRamTotal', 'slotsRamLivres', 'ramMaximaGb', 'upgradeRam',
  'armazenamentoGb', 'tipoArmazenamento', 'slotsM2Total', 'slotsM2Livres', 'upgradeArmazenamento',
  'tamanhoTelaPolegadas', 'resolucaoLargura', 'resolucaoAltura', 'taxaAtualizacaoHz', 'tipoPainel', 'brilhoNits', 'touch',
  'bateriaWh', 'autonomiaInformadaHoras', 'potenciaCarregadorWatts',
  'pesoKg', 'larguraMm', 'alturaMm', 'profundidadeMm',
  'wifi', 'bluetooth', 'usbA', 'usbC', 'thunderbolt', 'hdmi', 'displayPort', 'ethernet', 'leitorCartao',
  'sistemaOperacional', 'webcam', 'resolucaoWebcam', 'tecladoIluminado', 'tecladoNumerico', 'leitorDigital',
])

function cleanText(value) {
  return String(value ?? '').trim()
}

function sanitizeNotebookSpec(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([key, fieldValue]) => NOTEBOOK_SPEC_FIELDS.has(key) && fieldValue !== undefined),
  )
}

function optionalString(value, editing) {
  const clean = cleanText(value)
  return clean || (editing ? null : undefined)
}

function normalizedNotebookForm(item = {}) {
  const specification = sanitizeNotebookSpec(item.especificacao || item.especificacoes || {})
  return {
    ...EMPTY,
    ...item,
    nome: String(item.nome ?? ''),
    marca: String(item.marca ?? ''),
    modelo: String(item.modelo ?? ''),
    descricao: String(item.descricao ?? ''),
    mpn: String(item.mpn ?? ''),
    gtin: String(item.gtin ?? ''),
    imagemUrl: String(item.imagemUrl ?? ''),
    imagemHoverUrl: String(item.imagemHoverUrl ?? ''),
    publicado: Boolean(item.publicado),
    ativo: typeof item.ativo === 'boolean' ? item.ativo : true,
    especificacao: JSON.stringify(specification, null, 2),
  }
}

function previewFields(preview) {
  return Object.entries(preview?.normalizacao?.camposNormalizados || {})
    .filter(([key, value]) => key !== 'evidencias' && value !== null && value !== '' && typeof value !== 'object')
    .slice(0, 12)
}

function notebookSpecFromAi(source = {}) {
  const direct = sanitizeNotebookSpec(source)
  const aliases = {
    processadorNome: source.processadorNome ?? source.processador ?? source.cpuNome ?? source.cpu,
    gpuNome: source.gpuNome ?? source.gpu ?? source.placaVideo,
    ramInstaladaGb: source.ramInstaladaGb ?? source.memoriaRamGb ?? source.ramGb,
    armazenamentoGb: source.armazenamentoGb ?? source.ssdGb,
    tamanhoTelaPolegadas: source.tamanhoTelaPolegadas ?? source.telaPolegadas,
    sistemaOperacional: source.sistemaOperacional ?? source.sistema,
    pesoKg: source.pesoKg,
  }
  return {
    ...direct,
    ...Object.fromEntries(Object.entries(aliases).filter(([, value]) => value !== undefined && value !== null && value !== '')),
  }
}

export default function AdminNotebookForm() {
  const { id } = useParams()
  const editing = Boolean(id && id !== 'novo')
  const navigate = useNavigate()
  const toast = useAdminToast()
  const { user } = useAuth()
  const canImportLink = String(user?.papel || '').toUpperCase() === 'ADMIN'
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(editing)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)

  useEffect(() => {
    if (!editing) return undefined
    let active = true
    adminService.notebooks.get(id)
      .then((item) => {
        if (!active) return
        setForm(normalizedNotebookForm(item))
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [editing, id])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  function applyImportPreview(preview = importPreview, notify = true) {
    const source = preview?.normalizacao?.camposNormalizados || {}
    if (!Object.keys(source).length) {
      toast.show('A IA não retornou campos para preencher. Faça o cadastro manualmente.', 'alerta')
      return
    }

    const image = source.imagemUrl || preview?.coleta?.meta?.imagem || preview?.coleta?.meta?.ogImage || ''
    let currentSpec = {}
    try { currentSpec = sanitizeNotebookSpec(JSON.parse(form.especificacao || '{}')) } catch { currentSpec = {} }
    const aiSpec = notebookSpecFromAi(source)

    setForm((current) => ({
      ...current,
      nome: source.nome || current.nome,
      marca: source.marca || current.marca,
      modelo: source.modelo || current.modelo,
      descricao: source.descricao || current.descricao,
      mpn: source.mpn || current.mpn,
      gtin: source.gtin || source.ean || current.gtin,
      imagemUrl: image || current.imagemUrl,
      imagemHoverUrl: source.imagemHoverUrl || current.imagemHoverUrl,
      especificacao: JSON.stringify({ ...currentSpec, ...aiSpec }, null, 2),
    }))

    if (notify) toast.show('Dados da IA aplicados ao Notebook. Revise tudo antes de salvar.')
  }

  async function importData() {
    const url = cleanText(importUrl)
    if (!canImportLink || !url) return
    setImporting(true)
    setImportPreview(null)
    try {
      const result = await adminService.ai.importLink(url)
      setImportPreview(result)
      if (result?.iaDisponivel === false) {
        toast.show(result?.avisoIa || 'A página foi coletada, mas a IA não conseguiu normalizar os dados.', 'alerta')
        return
      }
      applyImportPreview(result, false)
      toast.show('Dados encontrados pela IA foram preenchidos no Notebook. Revise antes de salvar.')
    } catch (err) {
      toast.show(err?.message || 'Não foi possível analisar o link com a IA.', 'erro')
    } finally {
      setImporting(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let specification
      try {
        specification = sanitizeNotebookSpec(JSON.parse(form.especificacao || '{}'))
      } catch {
        throw new Error('O JSON de especificação está inválido.')
      }

      const body = {
        nome: cleanText(form.nome),
        marca: cleanText(form.marca),
        modelo: cleanText(form.modelo),
        descricao: optionalString(form.descricao, editing),
        mpn: optionalString(form.mpn, editing),
        gtin: optionalString(form.gtin, editing),
        imagemUrl: optionalString(form.imagemUrl, editing),
        imagemHoverUrl: optionalString(form.imagemHoverUrl, editing),
        publicado: Boolean(form.publicado),
        ativo: Boolean(form.ativo),
        especificacao: specification,
      }

      const saved = editing
        ? await adminService.notebooks.update(id, body)
        : await adminService.notebooks.create(body)

      const produtoId = saved?.produtoId ?? saved?.produto?.id
      if (produtoId) {
        await adminService.products.update(produtoId, {
          nome: body.nome,
          marca: body.marca,
          modelo: body.modelo,
          descricao: body.descricao,
          mpn: body.mpn,
          gtin: body.gtin,
          imagemUrl: body.imagemUrl,
          imagemHoverUrl: body.imagemHoverUrl,
          publicado: body.publicado,
          ativo: body.ativo,
        })
      }

      toast.show(body.publicado && body.ativo ? 'Notebook salvo e publicado.' : 'Notebook salvo.')
      navigate(`/admin/notebooks/${saved?.id || id}`, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLoading />
  if (error && editing && !form.nome) return <AdminError error={error} />

  return <>
    <AdminPageHeader title={editing ? 'Editar notebook' : 'Novo notebook'} description="Cadastre manualmente ou use a IA para preencher uma prévia. O tipo permanece Notebook.">
      <AdminBack to="/admin/notebooks">Cancelar</AdminBack>
    </AdminPageHeader>
    <form className="admin-form-layout" onSubmit={submit}>
      <div className="admin-form-card">
        {canImportLink && <section className="admin-form-section admin-import-section">
          <div className="admin-section-heading">
            <div><h2>Cadastrar Notebook com IA</h2><p>Cole o link do fabricante ou da loja. A IA preenche uma prévia editável e nunca salva automaticamente.</p></div>
            <span className="admin-import-badge">Somente ADMIN</span>
          </div>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>URL do notebook</label><input className="admin-input" type="url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://loja.com/notebook/asus-vivobook-15" /></div>
            <div className="admin-field full"><button className="btn btn-primario" type="button" disabled={importing || !cleanText(importUrl)} onClick={importData}>{importing ? 'Analisando com IA...' : 'Analisar e preencher Notebook'}</button></div>
          </div>
          {importPreview && <div className="admin-import-preview">
            <div className="admin-import-preview-head"><div><span className="admin-import-preview-status">{importPreview.status || 'PRÉVIA'}</span><h3>Prévia para revisão</h3></div><strong>Notebook</strong></div>
            {importPreview.avisoIa && <p className="admin-inline-warning">{importPreview.avisoIa}</p>}
            {importPreview.normalizacao?.textoExplicativo && <p className="admin-import-preview-copy">{importPreview.normalizacao.textoExplicativo}</p>}
            <div className="admin-import-preview-fields">{previewFields(importPreview).map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}</div>
            <div className="admin-import-preview-actions">
              <button className="btn btn-secundario" type="button" onClick={() => { setImportPreview(null); setImportUrl('') }}>Descartar prévia</button>
              <button className="btn btn-primario" type="button" onClick={() => applyImportPreview()}>Aplicar prévia ao Notebook</button>
            </div>
            <small className="admin-help">Mesmo que o anúncio cite processador, GPU ou RAM, este formulário continua sendo Notebook. Revise os dados antes de salvar.</small>
          </div>}
        </section>}

        <section className="admin-form-section">
          <h2>Identificação</h2>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>Nome</label><input className="admin-input" required value={form.nome} onChange={(e) => update('nome', e.target.value)} placeholder="ASUS Vivobook 15" /></div>
            <div className="admin-field"><label>Marca</label><input className="admin-input" required value={form.marca} onChange={(e) => update('marca', e.target.value)} placeholder="ASUS" /></div>
            <div className="admin-field"><label>Modelo</label><input className="admin-input" required value={form.modelo} onChange={(e) => update('modelo', e.target.value)} placeholder="X1504VA" /></div>
            <div className="admin-field"><label>MPN</label><input className="admin-input" value={form.mpn} onChange={(e) => update('mpn', e.target.value)} placeholder="X1504VA-NJ1745W" /></div>
            <div className="admin-field"><label>GTIN</label><input className="admin-input" value={form.gtin} onChange={(e) => update('gtin', e.target.value.replace(/\D/g, ''))} placeholder="7891234567890" /></div>
            <div className="admin-field full"><label>Descrição</label><textarea className="admin-textarea" value={form.descricao} onChange={(e) => update('descricao', e.target.value)} placeholder="Notebook de 15,6 polegadas para trabalho, estudos e uso diário." /></div>
            <div className="admin-field full"><label>Imagem</label><input className="admin-input" type="url" value={form.imagemUrl} onChange={(e) => update('imagemUrl', e.target.value)} placeholder="https://cdn.exemplo.com/notebook-frente.jpg" /></div>
            <div className="admin-field full"><label>Imagem secundária/hover</label><input className="admin-input" type="url" value={form.imagemHoverUrl} onChange={(e) => update('imagemHoverUrl', e.target.value)} placeholder="https://cdn.exemplo.com/notebook-aberto.jpg" /></div>
          </div>
        </section>
        <section className="admin-form-section">
          <h2>Especificação técnica</h2>
          <div className="admin-field">
            <label>JSON da especificação</label>
            <textarea className="admin-textarea admin-code-area" value={form.especificacao} onChange={(e) => update('especificacao', e.target.value)} placeholder={'{\n  "processadorNome": "Intel Core i5-1235U",\n  "ramInstaladaGb": 16,\n  "armazenamentoGb": 512,\n  "tamanhoTelaPolegadas": 15.6\n}'} />
            <small className="admin-help">CPU, GPU, RAM, armazenamento, tela, mobilidade e conectividade. Campos internos do banco são descartados antes do envio.</small>
          </div>
        </section>
        {error && <div className="admin-form-section"><p className="admin-form-error">{error.message}</p></div>}
        <footer className="admin-form-footer"><button className="btn btn-primario" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar notebook'}</button></footer>
      </div>
      <aside className="admin-sticky-side"><div className="admin-card"><div className="admin-card-body">
        <label className="admin-switch"><input type="checkbox" checked={form.publicado} onChange={(e) => update('publicado', e.target.checked)} /> Publicado</label><br /><br />
        <label className="admin-switch"><input type="checkbox" checked={form.ativo} onChange={(e) => update('ativo', e.target.checked)} /> Ativo</label>
      </div></div></aside>
    </form>
  </>
}
