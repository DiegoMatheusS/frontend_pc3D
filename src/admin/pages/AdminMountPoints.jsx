import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/authContext'
import { AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { adminService } from '../services/adminService'

const EMPTY_POINT = {
  codigo: '', nome: '', categoriaAceita: 'PLACA_MAE', ordem: 0,
  posicaoX: 0, posicaoY: 0, posicaoZ: 0,
  rotacaoX: 0, rotacaoY: 0, rotacaoZ: 0,
  escalaX: 1, escalaY: 1, escalaZ: 1,
  obrigatorio: false, ativo: true, observacao: '',
}

const EMPTY_ADJUSTMENT = {
  hardwareFilhoId: '', posicaoX: 0, posicaoY: 0, posicaoZ: 0,
  rotacaoX: 0, rotacaoY: 0, rotacaoZ: 0,
  escalaX: 1, escalaY: 1, escalaZ: 1, observacao: '', revisado: false,
}

const CATEGORIES = [
  'PROCESSADOR', 'COOLER', 'PLACA_MAE', 'MEMORIA_RAM', 'PLACA_VIDEO',
  'ARMAZENAMENTO', 'FONTE', 'GABINETE', 'VENTOINHA',
]

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function VectorFields({ value, onChange, prefix, scale = false, disabled = false }) {
  const labels = scale ? ['X', 'Y', 'Z'] : ['X', 'Y', 'Z']
  const keys = scale ? [`${prefix}X`, `${prefix}Y`, `${prefix}Z`] : [`${prefix}X`, `${prefix}Y`, `${prefix}Z`]
  return (
    <div className="admin-vector-grid">
      {keys.map((key, index) => (
        <label className="admin-field" key={key}>
          <span>{labels[index]}</span>
          <input className="admin-input" type="number" step="0.01" disabled={disabled} value={value[key] ?? (scale ? 1 : 0)} onChange={(event) => onChange(key, event.target.value)} />
        </label>
      ))}
    </div>
  )
}

function PointForm({ value, onChange, onSubmit, onCancel, saving, editing, disabled }) {
  return (
    <form className="admin-card admin-mount-editor" onSubmit={onSubmit}>
      <header className="admin-card-header"><div><h2>{editing ? 'Editar ponto de encaixe' : 'Novo ponto de encaixe'}</h2><p>Define onde uma categoria pode ser instalada no hardware pai.</p></div></header>
      <div className="admin-card-body">
        <div className="admin-form-grid">
          <label className="admin-field"><span>Código</span><input className="admin-input" required disabled={disabled} value={value.codigo} onChange={(e) => onChange('codigo', e.target.value)} placeholder="placa-mae-principal" /></label>
          <label className="admin-field"><span>Nome</span><input className="admin-input" disabled={disabled} value={value.nome} onChange={(e) => onChange('nome', e.target.value)} placeholder="Placa-mãe principal" /></label>
          <label className="admin-field"><span>Categoria aceita</span><select className="admin-select" disabled={disabled} value={value.categoriaAceita} onChange={(e) => onChange('categoriaAceita', e.target.value)}>{CATEGORIES.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
          <label className="admin-field"><span>Ordem</span><input className="admin-input" type="number" min="0" disabled={disabled} value={value.ordem} onChange={(e) => onChange('ordem', e.target.value)} /></label>
          <label className="admin-field full"><span>Observação</span><textarea className="admin-textarea" disabled={disabled} value={value.observacao} onChange={(e) => onChange('observacao', e.target.value)} /></label>
        </div>
        <div className="admin-transform-grid">
          <fieldset><legend>Posição</legend><VectorFields value={value} prefix="posicao" disabled={disabled} onChange={onChange} /></fieldset>
          <fieldset><legend>Rotação</legend><VectorFields value={value} prefix="rotacao" disabled={disabled} onChange={onChange} /></fieldset>
          <fieldset><legend>Escala</legend><VectorFields value={value} prefix="escala" scale disabled={disabled} onChange={onChange} /></fieldset>
        </div>
        <div className="admin-inline-checks">
          <label><input type="checkbox" disabled={disabled} checked={Boolean(value.obrigatorio)} onChange={(e) => onChange('obrigatorio', e.target.checked)} /> Obrigatório</label>
          <label><input type="checkbox" disabled={disabled} checked={Boolean(value.ativo)} onChange={(e) => onChange('ativo', e.target.checked)} /> Ativo</label>
        </div>
      </div>
      {!disabled && <footer className="admin-form-footer"><button className="btn btn-secundario" type="button" onClick={onCancel}>Cancelar</button><button className="btn btn-primario" disabled={saving} type="submit">{saving ? 'Salvando...' : editing ? 'Salvar ponto' : 'Criar ponto'}</button></footer>}
    </form>
  )
}

function AdjustmentForm({ point, hardwares, onSaved, canEdit }) {
  const toast = useAdminToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_ADJUSTMENT)
  const [saving, setSaving] = useState(false)
  const candidates = useMemo(() => hardwares.filter((hardware) => hardware.categoria === point.categoriaAceita), [hardwares, point.categoriaAceita])
  if (!canEdit) return null

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  async function submit(event) {
    event.preventDefault()
    if (!form.hardwareFilhoId) return
    setSaving(true)
    try {
      await adminService.hardwares.createMountAdjustment(point.id, {
        hardwareFilhoId: Number(form.hardwareFilhoId),
        posicaoX: number(form.posicaoX), posicaoY: number(form.posicaoY), posicaoZ: number(form.posicaoZ),
        rotacaoX: number(form.rotacaoX), rotacaoY: number(form.rotacaoY), rotacaoZ: number(form.rotacaoZ),
        escalaX: number(form.escalaX, 1), escalaY: number(form.escalaY, 1), escalaZ: number(form.escalaZ, 1),
        observacao: form.observacao.trim() || undefined, revisado: Boolean(form.revisado),
      })
      toast.show('Ajuste específico criado.')
      setForm(EMPTY_ADJUSTMENT)
      setOpen(false)
      await onSaved()
    } catch (error) { toast.show(error.message, 'erro') } finally { setSaving(false) }
  }

  if (!open) return <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => setOpen(true)}>+ Ajuste específico</button>
  return (
    <form className="admin-inline-editor" onSubmit={submit}>
      <label className="admin-field full"><span>Hardware filho</span><select className="admin-select" required value={form.hardwareFilhoId} onChange={(e) => update('hardwareFilhoId', e.target.value)}><option value="">Selecione</option>{candidates.map((hardware) => <option key={hardware.id} value={hardware.id}>{hardware.nome}</option>)}</select></label>
      <div className="admin-transform-grid compact">
        <fieldset><legend>Posição</legend><VectorFields value={form} prefix="posicao" onChange={update} /></fieldset>
        <fieldset><legend>Rotação</legend><VectorFields value={form} prefix="rotacao" onChange={update} /></fieldset>
        <fieldset><legend>Escala</legend><VectorFields value={form} prefix="escala" scale onChange={update} /></fieldset>
      </div>
      <label className="admin-field full"><span>Observação</span><input className="admin-input" value={form.observacao} onChange={(e) => update('observacao', e.target.value)} /></label>
      <label className="admin-inline-checkbox"><input type="checkbox" checked={form.revisado} onChange={(e) => update('revisado', e.target.checked)} /> Revisado</label>
      <div className="admin-inline-actions"><button type="button" className="btn btn-secundario" onClick={() => setOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primario" disabled={saving}>{saving ? 'Criando...' : 'Criar ajuste'}</button></div>
    </form>
  )
}

export default function AdminMountPoints() {
  const { user } = useAuth()
  const toast = useAdminToast()
  const role = String(user?.papel || '').toUpperCase()
  const canEdit = role === 'ADMIN' || role === 'EDITOR'
  const [hardwares, setHardwares] = useState([])
  const [hardwareId, setHardwareId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pointsLoading, setPointsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_POINT)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    adminService.hardwares.list().then((items) => {
      if (!active) return
      setHardwares(items.filter((item) => item.ativo !== false && CATEGORIES.includes(item.categoria)))
    }).catch((err) => active && setError(err)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  async function loadPoints(id = hardwareId) {
    if (!id) { setData(null); return }
    setPointsLoading(true)
    setError(null)
    try { setData(await adminService.hardwares.mountPoints(id)) }
    catch (err) { setError(err); setData(null) }
    finally { setPointsLoading(false) }
  }

  async function chooseHardware(id) {
    setHardwareId(id)
    setFormOpen(false)
    setEditingId(null)
    await loadPoints(id)
  }

  function updateForm(key, value) { setForm((current) => ({ ...current, [key]: value })) }
  function newPoint() { setEditingId(null); setForm(EMPTY_POINT); setFormOpen(true) }
  function editPoint(point) {
    setEditingId(point.id)
    setForm({ ...EMPTY_POINT, ...point, observacao: point.observacao || '' })
    setFormOpen(true)
  }

  async function savePoint(event) {
    event.preventDefault()
    if (!hardwareId || !canEdit) return
    setSaving(true)
    try {
      const body = {
        codigo: form.codigo.trim(), nome: form.nome.trim() || undefined, categoriaAceita: form.categoriaAceita,
        ordem: number(form.ordem), posicaoX: number(form.posicaoX), posicaoY: number(form.posicaoY), posicaoZ: number(form.posicaoZ),
        rotacaoX: number(form.rotacaoX), rotacaoY: number(form.rotacaoY), rotacaoZ: number(form.rotacaoZ),
        escalaX: number(form.escalaX, 1), escalaY: number(form.escalaY, 1), escalaZ: number(form.escalaZ, 1),
        obrigatorio: Boolean(form.obrigatorio), ativo: Boolean(form.ativo), observacao: form.observacao.trim() || undefined,
      }
      if (editingId) await adminService.hardwares.updateMountPoint(editingId, body)
      else await adminService.hardwares.createMountPoint(hardwareId, body)
      toast.show(editingId ? 'Ponto de encaixe atualizado.' : 'Ponto de encaixe criado.')
      setFormOpen(false)
      setEditingId(null)
      await loadPoints()
    } catch (err) { toast.show(err.message, 'erro') } finally { setSaving(false) }
  }

  async function toggleAdjustment(adjustment) {
    if (!canEdit) return
    try {
      await adminService.hardwares.updateMountAdjustment(adjustment.id, { revisado: !adjustment.revisado })
      toast.show(!adjustment.revisado ? 'Ajuste marcado como revisado.' : 'Revisão removida.')
      await loadPoints()
    } catch (err) { toast.show(err.message, 'erro') }
  }

  if (loading) return <AdminLoading />

  return (
    <>
      <AdminPageHeader title="Encaixes 3D" description="Pontos físicos e ajustes específicos usados para posicionar componentes no montador." />
      <section className="admin-card admin-mount-selector">
        <div className="admin-card-body admin-form-grid">
          <label className="admin-field full"><span>Hardware pai</span><select className="admin-select" value={hardwareId} onChange={(e) => chooseHardware(e.target.value)}><option value="">Selecione um hardware</option>{hardwares.map((hardware) => <option value={hardware.id} key={hardware.id}>{hardware.nome} — {hardware.categoria}</option>)}</select></label>
        </div>
      </section>

      {error && <AdminError error={error} />}
      {pointsLoading && <AdminLoading />}

      {hardwareId && !pointsLoading && data && (
        <>
          <div className="admin-section-toolbar"><div><strong>{data.hardwarePai?.nome}</strong><small>{data.total || 0} ponto(s) de encaixe</small></div>{canEdit && <button className="btn btn-primario" type="button" onClick={newPoint}>+ Novo ponto</button>}</div>
          {formOpen && <PointForm value={form} onChange={updateForm} onSubmit={savePoint} onCancel={() => setFormOpen(false)} saving={saving} editing={Boolean(editingId)} disabled={!canEdit} />}
          <section className="admin-mount-list">
            {(data.pontosEncaixe || []).map((point) => (
              <article className="admin-card admin-mount-point" key={point.id}>
                <header className="admin-card-header">
                  <div><div className="admin-mount-title-line"><h2>{point.nome || point.codigo}</h2><span className={`admin-status ${point.ativo === false ? 'status-inativo' : 'status-publicado'}`}>{point.ativo === false ? 'INATIVO' : 'ATIVO'}</span>{point.obrigatorio && <span className="admin-status status-pendente">OBRIGATÓRIO</span>}</div><p><code>{point.codigo}</code> · aceita {point.categoriaAceita}</p></div>
                  {canEdit && <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => editPoint(point)}>Editar</button>}
                </header>
                <div className="admin-card-body">
                  <div className="admin-transform-summary"><span><strong>Posição</strong>{number(point.posicaoX)} / {number(point.posicaoY)} / {number(point.posicaoZ)}</span><span><strong>Rotação</strong>{number(point.rotacaoX)} / {number(point.rotacaoY)} / {number(point.rotacaoZ)}</span><span><strong>Escala</strong>{number(point.escalaX, 1)} / {number(point.escalaY, 1)} / {number(point.escalaZ, 1)}</span></div>
                  {point.observacao && <p className="admin-muted">{point.observacao}</p>}
                  <div className="admin-adjustments-header"><strong>Ajustes específicos</strong><span>{point.ajustesEspecificos?.length || 0}</span></div>
                  <div className="admin-adjustment-list">
                    {(point.ajustesEspecificos || []).map((adjustment) => (
                      <div className="admin-adjustment-row" key={adjustment.id}>
                        <div><strong>{adjustment.hardwareFilho?.nome || `Hardware #${adjustment.hardwareFilhoId}`}</strong><small>Pos. {number(adjustment.posicaoX)} / {number(adjustment.posicaoY)} / {number(adjustment.posicaoZ)} · Rot. {number(adjustment.rotacaoX)} / {number(adjustment.rotacaoY)} / {number(adjustment.rotacaoZ)}</small></div>
                        <button type="button" className={`admin-status-button ${adjustment.revisado ? 'is-reviewed' : ''}`} disabled={!canEdit} onClick={() => toggleAdjustment(adjustment)}>{adjustment.revisado ? 'Revisado' : 'Pendente'}</button>
                      </div>
                    ))}
                    {!point.ajustesEspecificos?.length && <div className="admin-empty compact">Nenhum ajuste específico.</div>}
                  </div>
                  <AdjustmentForm point={point} hardwares={hardwares} canEdit={canEdit} onSaved={loadPoints} />
                </div>
              </article>
            ))}
            {!data.pontosEncaixe?.length && <div className="admin-card"><div className="admin-card-body admin-empty">Este hardware ainda não possui pontos de encaixe.</div></div>}
          </section>
        </>
      )}
    </>
  )
}
