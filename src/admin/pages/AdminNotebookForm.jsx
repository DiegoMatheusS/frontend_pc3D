import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminBack, AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

const EMPTY = {
  nome: '', marca: '', modelo: '', descricao: '', mpn: '', gtin: '', imagemUrl: '', imagemHoverUrl: '',
  publicado: false, ativo: true, especificacao: '{}',
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

function sanitizeNotebookSpec(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([key, fieldValue]) => NOTEBOOK_SPEC_FIELDS.has(key) && fieldValue !== undefined),
  )
}

function optionalString(value, editing) {
  const clean = String(value || '').trim()
  return clean || (editing ? null : undefined)
}

export default function AdminNotebookForm() {
  const { id } = useParams()
  const editing = Boolean(id && id !== 'novo')
  const navigate = useNavigate()
  const toast = useAdminToast()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(editing)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) return undefined
    let active = true
    adminService.notebooks.get(id)
      .then((item) => {
        if (!active) return
        const specification = sanitizeNotebookSpec(item.especificacao || item.especificacoes || {})
        setForm({ ...EMPTY, ...item, especificacao: JSON.stringify(specification, null, 2) })
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [editing, id])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

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
        nome: form.nome.trim(),
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
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
      toast.show('Notebook salvo.')
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
    <AdminPageHeader title={editing ? 'Editar notebook' : 'Novo notebook'} description="A especificação completa segue o contrato atual do backend.">
      <AdminBack to="/admin/notebooks">Cancelar</AdminBack>
    </AdminPageHeader>
    <form className="admin-form-layout" onSubmit={submit}>
      <div className="admin-form-card">
        <section className="admin-form-section">
          <h2>Identificação</h2>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>Nome</label><input className="admin-input" required value={form.nome} onChange={(e) => update('nome', e.target.value)} /></div>
            <div className="admin-field"><label>Marca</label><input className="admin-input" required value={form.marca} onChange={(e) => update('marca', e.target.value)} /></div>
            <div className="admin-field"><label>Modelo</label><input className="admin-input" required value={form.modelo} onChange={(e) => update('modelo', e.target.value)} /></div>
            <div className="admin-field"><label>MPN</label><input className="admin-input" value={form.mpn} onChange={(e) => update('mpn', e.target.value)} /></div>
            <div className="admin-field"><label>GTIN</label><input className="admin-input" value={form.gtin} onChange={(e) => update('gtin', e.target.value.replace(/\D/g, ''))} /></div>
            <div className="admin-field full"><label>Descrição</label><textarea className="admin-textarea" value={form.descricao} onChange={(e) => update('descricao', e.target.value)} /></div>
            <div className="admin-field full"><label>Imagem</label><input className="admin-input" type="url" value={form.imagemUrl} onChange={(e) => update('imagemUrl', e.target.value)} /></div>
            <div className="admin-field full"><label>Imagem secundária/hover</label><input className="admin-input" type="url" value={form.imagemHoverUrl} onChange={(e) => update('imagemHoverUrl', e.target.value)} /></div>
          </div>
        </section>
        <section className="admin-form-section">
          <h2>Especificação técnica</h2>
          <div className="admin-field">
            <label>JSON da especificação</label>
            <textarea className="admin-textarea admin-code-area" value={form.especificacao} onChange={(e) => update('especificacao', e.target.value)} />
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
