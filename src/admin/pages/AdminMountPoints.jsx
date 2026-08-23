import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/authContext'
import { AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { adminService } from '../services/adminService'

const PARENT_CATEGORY = 'PLACA_MAE'

const CATEGORIES = [
  'PROCESSADOR', 'COOLER', 'PLACA_MAE', 'MEMORIA_RAM', 'PLACA_VIDEO',
  'ARMAZENAMENTO', 'FONTE', 'GABINETE', 'VENTOINHA',
]

const POINT_CATEGORIES = CATEGORIES.filter((category) => category !== PARENT_CATEGORY)

const EMPTY_POINT = {
  codigo: '', nome: '', categoriaAceita: 'PROCESSADOR', ordem: 0,
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

function number(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeSearch(value) {
  return String(value ?? '').trim().toLowerCase()
}

function hardwareMatches(hardware, term) {
  if (!term) return true
  return [hardware.id, hardware.nome, hardware.marca, hardware.modelo, hardware.categoria]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(term)
}

function preferredModel3D(models = []) {
  return models.find((model) => model?.ativo !== false && model?.aprovado === true)
    || models.find((model) => model?.ativo !== false)
    || models[0]
    || null
}

function transformFromModel3D(model) {
  if (!model) return {}
  return {
    posicaoX: number(model.posicaoCorrecaoX),
    posicaoY: number(model.posicaoCorrecaoY),
    posicaoZ: number(model.posicaoCorrecaoZ),
    rotacaoX: number(model.rotacaoCorrecaoX),
    rotacaoY: number(model.rotacaoCorrecaoY),
    rotacaoZ: number(model.rotacaoCorrecaoZ),
    escalaX: number(model.escalaCorrecaoX, 1),
    escalaY: number(model.escalaCorrecaoY, 1),
    escalaZ: number(model.escalaCorrecaoZ, 1),
  }
}

function VectorFields({ value, onChange, prefix, scale = false, disabled = false }) {
  const keys = [`${prefix}X`, `${prefix}Y`, `${prefix}Z`]
  return (
    <div className="admin-vector-grid">
      {keys.map((key, index) => (
        <label className="admin-field" key={key}>
          <span>{['X', 'Y', 'Z'][index]}</span>
          <input
            className="admin-input"
            type="number"
            step="0.00001"
            disabled={disabled}
            value={value[key] ?? (scale ? 1 : 0)}
            onChange={(event) => onChange(key, event.target.value)}
          />
        </label>
      ))}
    </div>
  )
}

function PointForm({ value, onChange, onSubmit, onCancel, saving, editing, disabled }) {
  return (
    <form className="admin-card admin-mount-editor" onSubmit={onSubmit}>
      <header className="admin-card-header">
        <div>
          <h2>{editing ? 'Editar ponto de encaixe' : 'Novo ponto de encaixe'}</h2>
          <p>A placa-mãe já é o Hardware pai. Este ponto define onde um componente filho encaixa nela.</p>
        </div>
      </header>
      <div className="admin-card-body">
        <div className="admin-form-grid">
          <label className="admin-field">
            <span>Código</span>
            <input className="admin-input" required disabled={disabled} value={value.codigo} onChange={(e) => onChange('codigo', e.target.value)} placeholder="cpu-socket-principal" />
          </label>
          <label className="admin-field">
            <span>Nome</span>
            <input className="admin-input" disabled={disabled} value={value.nome} onChange={(e) => onChange('nome', e.target.value)} placeholder="Socket do processador" />
          </label>
          <label className="admin-field">
            <span>Tipo de Hardware que encaixa aqui</span>
            <select className="admin-select" disabled={disabled} value={value.categoriaAceita} onChange={(e) => onChange('categoriaAceita', e.target.value)}>
              {value.categoriaAceita === PARENT_CATEGORY && <option value={PARENT_CATEGORY} disabled>PLACA_MAE — ponto antigo, altere a categoria</option>}
              {POINT_CATEGORIES.map((category) => <option value={category} key={category}>{category}</option>)}
            </select>
            <small className="admin-help">PLACA_MAE não aparece aqui porque ela é somente o Hardware pai.</small>
          </label>
          <label className="admin-field">
            <span>Ordem</span>
            <input className="admin-input" type="number" min="0" disabled={disabled} value={value.ordem} onChange={(e) => onChange('ordem', e.target.value)} />
          </label>
          <label className="admin-field full">
            <span>Observação</span>
            <textarea className="admin-textarea" disabled={disabled} value={value.observacao} onChange={(e) => onChange('observacao', e.target.value)} />
          </label>
        </div>
        <div className="admin-transform-grid">
          <fieldset><legend>Posição do ponto</legend><VectorFields value={value} prefix="posicao" disabled={disabled} onChange={onChange} /></fieldset>
          <fieldset><legend>Rotação do ponto</legend><VectorFields value={value} prefix="rotacao" disabled={disabled} onChange={onChange} /></fieldset>
          <fieldset><legend>Escala do ponto</legend><VectorFields value={value} prefix="escala" scale disabled={disabled} onChange={onChange} /></fieldset>
        </div>
        <div className="admin-inline-checks">
          <label><input type="checkbox" disabled={disabled} checked={Boolean(value.obrigatorio)} onChange={(e) => onChange('obrigatorio', e.target.checked)} /> Obrigatório</label>
          <label><input type="checkbox" disabled={disabled} checked={Boolean(value.ativo)} onChange={(e) => onChange('ativo', e.target.checked)} /> Ativo</label>
        </div>
      </div>
      {!disabled && (
        <footer className="admin-form-footer">
          <button className="btn btn-secundario" type="button" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primario" disabled={saving} type="submit">{saving ? 'Salvando...' : editing ? 'Salvar ponto' : 'Criar ponto'}</button>
        </footer>
      )}
    </form>
  )
}

function AdjustmentForm({ point, hardwares, onSaved, canEdit }) {
  const toast = useAdminToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_ADJUSTMENT)
  const [saving, setSaving] = useState(false)
  const [loadingModel, setLoadingModel] = useState(false)
  const [childSearch, setChildSearch] = useState('')
  const [childSearchOpen, setChildSearchOpen] = useState(false)

  const candidates = useMemo(
    () => hardwares.filter((hardware) => hardware.ativo !== false && point.categoriaAceita !== PARENT_CATEGORY && hardware.categoria === point.categoriaAceita),
    [hardwares, point.categoriaAceita],
  )

  const filteredCandidates = useMemo(() => {
    const term = normalizeSearch(childSearch)
    return candidates.filter((hardware) => hardwareMatches(hardware, term)).slice(0, 12)
  }, [candidates, childSearch])

  if (!canEdit || point.ativo === false) return null
  if (point.categoriaAceita === PARENT_CATEGORY) {
    return <p className="admin-help">Este é um ponto antigo configurado como PLACA_MAE. Edite a categoria ou exclua o ponto; a placa-mãe agora é somente o Hardware pai.</p>
  }

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  async function selectChildHardware(value) {
    const id = String(value || '')
    const selected = candidates.find((hardware) => String(hardware.id) === id)
    setChildSearch(selected?.nome || '')
    setChildSearchOpen(false)
    setForm({ ...EMPTY_ADJUSTMENT, hardwareFilhoId: id })
    if (!id) return

    setLoadingModel(true)
    try {
      const models = await adminService.hardwares.models(Number(id))
      const model = preferredModel3D(models)
      if (model) {
        setForm((current) => ({ ...current, ...transformFromModel3D(model), hardwareFilhoId: id }))
      }
    } catch {
      // O ponto base continua válido mesmo se o Hardware filho ainda não possuir GLB.
    } finally {
      setLoadingModel(false)
    }
  }

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
      toast.show('Hardware associado ao ponto de encaixe.')
      setForm(EMPTY_ADJUSTMENT)
      setChildSearch('')
      setChildSearchOpen(false)
      setOpen(false)
      await onSaved()
    } catch (error) {
      toast.show(error.message, 'erro')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => setOpen(true)}>+ Associar Hardware</button>

  return (
    <form className="admin-inline-editor" onSubmit={submit}>
      <div className="admin-field full admin-mount-search-wrap">
        <span>Pesquisar Hardware filho — {point.categoriaAceita}</span>
        <input
          className="admin-input"
          value={childSearch}
          placeholder={`Pesquise ${point.categoriaAceita} por nome, marca, modelo ou ID`}
          onFocus={() => setChildSearchOpen(true)}
          onChange={(event) => {
            setChildSearch(event.target.value)
            setChildSearchOpen(true)
            if (form.hardwareFilhoId) setForm((current) => ({ ...current, hardwareFilhoId: '' }))
          }}
        />
        {childSearchOpen && (
          <div className="admin-mount-search-results admin-mount-child-results">
            {filteredCandidates.map((hardware) => (
              <button
                type="button"
                className={`admin-mount-search-result ${String(hardware.id) === String(form.hardwareFilhoId) ? 'is-selected' : ''}`}
                key={hardware.id}
                onClick={() => selectChildHardware(hardware.id)}
              >
                <strong>{hardware.nome}</strong>
                <small>{[hardware.marca, hardware.modelo, hardware.categoria, `#${hardware.id}`].filter(Boolean).join(' · ')}</small>
              </button>
            ))}
            {!filteredCandidates.length && <div className="admin-mount-search-empty">Nenhum Hardware {point.categoriaAceita} encontrado.</div>}
          </div>
        )}
        <small className="admin-help">
          {loadingModel
            ? 'Carregando transformação do GLB...'
            : form.hardwareFilhoId
              ? 'Hardware selecionado. Os valores do GLB foram carregados quando disponíveis.'
              : 'O ponto já sabe onde este tipo de peça encaixa. Escolha apenas o modelo específico.'}
        </small>
      </div>

      <label className="admin-field full">
        <span>Hardware filho selecionado</span>
        <select className="admin-select" required value={form.hardwareFilhoId} onChange={(e) => selectChildHardware(e.target.value)}>
          <option value="">Selecione</option>
          {candidates.map((hardware) => <option key={hardware.id} value={hardware.id}>{hardware.nome}</option>)}
        </select>
      </label>

      <div className="admin-transform-grid compact">
        <fieldset><legend>Correção de posição</legend><VectorFields value={form} prefix="posicao" onChange={update} /></fieldset>
        <fieldset><legend>Correção de rotação</legend><VectorFields value={form} prefix="rotacao" onChange={update} /></fieldset>
        <fieldset><legend>Correção de escala</legend><VectorFields value={form} prefix="escala" scale onChange={update} /></fieldset>
      </div>
      <label className="admin-field full"><span>Observação</span><input className="admin-input" value={form.observacao} onChange={(e) => update('observacao', e.target.value)} /></label>
      <label className="admin-inline-checkbox"><input type="checkbox" checked={form.revisado} onChange={(e) => update('revisado', e.target.checked)} /> Revisado</label>
      <div className="admin-inline-actions">
        <button type="button" className="btn btn-secundario" onClick={() => { setOpen(false); setChildSearchOpen(false) }}>Cancelar</button>
        <button type="submit" className="btn btn-primario" disabled={saving || !form.hardwareFilhoId}>{saving ? 'Criando...' : 'Associar ao ponto'}</button>
      </div>
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
  const [hardwareSearch, setHardwareSearch] = useState('')
  const [hardwareSearchOpen, setHardwareSearchOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pointsLoading, setPointsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_POINT)
  const [saving, setSaving] = useState(false)
  const [selectedModel3D, setSelectedModel3D] = useState(null)
  const [model3DLoading, setModel3DLoading] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const motherboards = useMemo(
    () => hardwares.filter((hardware) => hardware.ativo !== false && hardware.categoria === PARENT_CATEGORY),
    [hardwares],
  )

  const filteredMotherboards = useMemo(() => {
    const term = normalizeSearch(hardwareSearch)
    return motherboards.filter((hardware) => hardwareMatches(hardware, term)).slice(0, 12)
  }, [motherboards, hardwareSearch])

  const visiblePoints = useMemo(() => {
    const points = data?.pontosEncaixe || []
    return showInactive ? points : points.filter((point) => point.ativo !== false)
  }, [data, showInactive])

  const inactiveCount = useMemo(
    () => (data?.pontosEncaixe || []).filter((point) => point.ativo === false).length,
    [data],
  )

  useEffect(() => {
    let active = true
    adminService.hardwares.list().then((items) => {
      if (!active) return
      setHardwares(items.filter((item) => item.ativo !== false && CATEGORIES.includes(item.categoria)))
    }).catch((err) => active && setError(err)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  async function loadPoints(id = hardwareId) {
    if (!id) {
      setData(null)
      return
    }
    setPointsLoading(true)
    setError(null)
    try {
      setData(await adminService.hardwares.mountPoints(id))
    } catch (err) {
      setError(err)
      setData(null)
    } finally {
      setPointsLoading(false)
    }
  }

  async function loadSelectedModel3D(id) {
    if (!id) {
      setSelectedModel3D(null)
      return null
    }
    setModel3DLoading(true)
    try {
      const models = await adminService.hardwares.models(Number(id))
      const model = preferredModel3D(models)
      setSelectedModel3D(model)
      return model
    } catch {
      setSelectedModel3D(null)
      return null
    } finally {
      setModel3DLoading(false)
    }
  }

  async function chooseHardware(id) {
    const selected = motherboards.find((hardware) => String(hardware.id) === String(id))
    const normalizedId = selected ? String(selected.id) : ''
    setHardwareId(normalizedId)
    setHardwareSearch(selected?.nome || '')
    setHardwareSearchOpen(false)
    setFormOpen(false)
    setEditingId(null)
    setSelectedModel3D(null)
    setShowInactive(false)
    if (!normalizedId) {
      setData(null)
      return
    }
    await Promise.all([loadPoints(normalizedId), loadSelectedModel3D(normalizedId)])
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function newPoint() {
    setEditingId(null)
    const existing = data?.pontosEncaixe || []
    const nextOrder = existing.length ? Math.max(...existing.map((point) => number(point.ordem))) + 1 : 0
    setForm({ ...EMPTY_POINT, ordem: nextOrder })
    setFormOpen(true)
  }

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
        codigo: form.codigo.trim(),
        nome: form.nome.trim() || undefined,
        categoriaAceita: form.categoriaAceita,
        ordem: number(form.ordem),
        posicaoX: number(form.posicaoX), posicaoY: number(form.posicaoY), posicaoZ: number(form.posicaoZ),
        rotacaoX: number(form.rotacaoX), rotacaoY: number(form.rotacaoY), rotacaoZ: number(form.rotacaoZ),
        escalaX: number(form.escalaX, 1), escalaY: number(form.escalaY, 1), escalaZ: number(form.escalaZ, 1),
        obrigatorio: Boolean(form.obrigatorio),
        ativo: Boolean(form.ativo),
        observacao: form.observacao.trim() || undefined,
      }
      if (editingId) await adminService.hardwares.updateMountPoint(editingId, body)
      else await adminService.hardwares.createMountPoint(hardwareId, body)
      toast.show(editingId ? 'Ponto de encaixe atualizado.' : 'Ponto de encaixe criado para esta placa-mãe.')
      setFormOpen(false)
      setEditingId(null)
      await loadPoints()
    } catch (err) {
      toast.show(err.message, 'erro')
    } finally {
      setSaving(false)
    }
  }

  async function excludePoint(point) {
    if (!canEdit || point.ativo === false) return
    const confirmed = window.confirm(`Excluir o ponto "${point.nome || point.codigo}" desta placa-mãe?\n\nEle será desativado e deixará de ser usado pelo PC 3D. Você poderá restaurá-lo depois.`)
    if (!confirmed) return
    setDeletingId(point.id)
    try {
      await adminService.hardwares.updateMountPoint(point.id, { ativo: false })
      toast.show('Ponto de encaixe excluído do PC 3D.')
      if (Number(editingId) === Number(point.id)) {
        setEditingId(null)
        setFormOpen(false)
      }
      await loadPoints()
    } catch (err) {
      toast.show(err.message, 'erro')
    } finally {
      setDeletingId(null)
    }
  }

  async function restorePoint(point) {
    if (!canEdit || point.ativo !== false) return
    setDeletingId(point.id)
    try {
      await adminService.hardwares.updateMountPoint(point.id, { ativo: true })
      toast.show('Ponto de encaixe restaurado.')
      await loadPoints()
    } catch (err) {
      toast.show(err.message, 'erro')
    } finally {
      setDeletingId(null)
    }
  }

  async function toggleAdjustment(adjustment) {
    if (!canEdit) return
    try {
      await adminService.hardwares.updateMountAdjustment(adjustment.id, { revisado: !adjustment.revisado })
      toast.show(!adjustment.revisado ? 'Ajuste marcado como revisado.' : 'Revisão removida.')
      await loadPoints()
    } catch (err) {
      toast.show(err.message, 'erro')
    }
  }

  if (loading) return <AdminLoading />

  return (
    <>
      <AdminPageHeader
        title="Encaixes 3D"
        description="Selecione uma placa-mãe. Os pontos abaixo dizem onde CPU, GPU, RAM, SSD e outros Hardwares devem encaixar no PC 3D."
      />

      <section className="admin-card admin-mount-selector">
        <div className="admin-card-body admin-form-grid">
          <div className="admin-field full admin-mount-search-wrap">
            <span>Pesquisar placa-mãe</span>
            <input
              className="admin-input"
              value={hardwareSearch}
              placeholder="Pesquise a placa-mãe por nome, marca, modelo ou ID"
              onFocus={() => setHardwareSearchOpen(true)}
              onChange={(event) => {
                setHardwareSearch(event.target.value)
                setHardwareSearchOpen(true)
                if (hardwareId) {
                  setHardwareId('')
                  setData(null)
                }
              }}
            />
            {hardwareSearchOpen && (
              <div className="admin-mount-search-results">
                {filteredMotherboards.map((hardware) => (
                  <button
                    type="button"
                    className={`admin-mount-search-result ${String(hardware.id) === String(hardwareId) ? 'is-selected' : ''}`}
                    key={hardware.id}
                    onClick={() => chooseHardware(hardware.id)}
                  >
                    <strong>{hardware.nome}</strong>
                    <small>{[hardware.marca, hardware.modelo, 'PLACA_MAE', `#${hardware.id}`].filter(Boolean).join(' · ')}</small>
                  </button>
                ))}
                {!filteredMotherboards.length && <div className="admin-mount-search-empty">Nenhuma placa-mãe encontrada.</div>}
              </div>
            )}
          </div>

          <label className="admin-field full">
            <span>Hardware pai — somente placa-mãe</span>
            <select className="admin-select" value={hardwareId} onChange={(e) => chooseHardware(e.target.value)}>
              <option value="">Selecione uma placa-mãe</option>
              {motherboards.map((hardware) => <option value={hardware.id} key={hardware.id}>{hardware.nome}</option>)}
            </select>
            <small className="admin-help">Os demais Hardwares são associados aos pontos específicos desta placa-mãe.</small>
          </label>
        </div>
      </section>

      {error && <AdminError error={error} />}
      {pointsLoading && <AdminLoading />}

      {hardwareId && !pointsLoading && data && (
        <>
          <div className="admin-section-toolbar admin-mount-map-toolbar">
            <div>
              <strong>{data.hardwarePai?.nome}</strong>
              <small>
                {(data.pontosEncaixe || []).filter((point) => point.ativo !== false).length} ponto(s) ativo(s)
                {model3DLoading ? ' · carregando GLB...' : selectedModel3D ? ` · GLB: ${selectedModel3D.nome || `#${selectedModel3D.id}`}` : ' · sem GLB cadastrado'}
              </small>
            </div>
            <div className="admin-mount-toolbar-actions">
              {inactiveCount > 0 && (
                <label className="admin-mount-show-inactive">
                  <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
                  Mostrar excluídos ({inactiveCount})
                </label>
              )}
              {canEdit && <button className="btn btn-primario" type="button" onClick={newPoint}>+ Novo ponto</button>}
            </div>
          </div>

          {formOpen && (
            <PointForm
              value={form}
              onChange={updateForm}
              onSubmit={savePoint}
              onCancel={() => { setFormOpen(false); setEditingId(null) }}
              saving={saving}
              editing={Boolean(editingId)}
              disabled={!canEdit}
            />
          )}

          <section className="admin-mount-list">
            {visiblePoints.map((point) => (
              <article className={`admin-card admin-mount-point ${point.ativo === false ? 'is-deleted' : ''}`} key={point.id}>
                <header className="admin-card-header">
                  <div>
                    <div className="admin-mount-title-line">
                      <h2>{point.nome || point.codigo}</h2>
                      <span className={`admin-status ${point.ativo === false ? 'status-inativo' : 'status-publicado'}`}>{point.ativo === false ? 'EXCLUÍDO' : point.categoriaAceita}</span>
                      {point.obrigatorio && <span className="admin-status status-pendente">OBRIGATÓRIO</span>}
                    </div>
                    <p><code>{point.codigo}</code> · ponto de {point.categoriaAceita} nesta placa-mãe</p>
                  </div>

                  {canEdit && (
                    <div className="admin-mount-point-actions">
                      {point.ativo === false ? (
                        <button className="btn btn-secundario btn-pequeno" disabled={deletingId === point.id} type="button" onClick={() => restorePoint(point)}>{deletingId === point.id ? 'Restaurando...' : 'Restaurar'}</button>
                      ) : (
                        <>
                          <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => editPoint(point)}>Editar</button>
                          <button className="btn btn-perigo btn-pequeno" disabled={deletingId === point.id} type="button" onClick={() => excludePoint(point)}>{deletingId === point.id ? 'Excluindo...' : 'Excluir'}</button>
                        </>
                      )}
                    </div>
                  )}
                </header>

                <div className="admin-card-body">
                  <div className="admin-transform-summary">
                    <span><strong>Posição do ponto</strong>{number(point.posicaoX)} / {number(point.posicaoY)} / {number(point.posicaoZ)}</span>
                    <span><strong>Rotação</strong>{number(point.rotacaoX)} / {number(point.rotacaoY)} / {number(point.rotacaoZ)}</span>
                    <span><strong>Escala</strong>{number(point.escalaX, 1)} / {number(point.escalaY, 1)} / {number(point.escalaZ, 1)}</span>
                  </div>

                  {point.observacao && <p className="admin-muted">{point.observacao}</p>}

                  <div className="admin-adjustments-header">
                    <strong>Hardwares {point.categoriaAceita} associados a este ponto</strong>
                    <span>{point.ajustesEspecificos?.length || 0}</span>
                  </div>

                  <div className="admin-adjustment-list">
                    {(point.ajustesEspecificos || []).map((adjustment) => (
                      <div className="admin-adjustment-row" key={adjustment.id}>
                        <div>
                          <strong>{adjustment.hardwareFilho?.nome || `Hardware #${adjustment.hardwareFilhoId}`}</strong>
                          <small>Pos. {number(adjustment.posicaoX)} / {number(adjustment.posicaoY)} / {number(adjustment.posicaoZ)} · Rot. {number(adjustment.rotacaoX)} / {number(adjustment.rotacaoY)} / {number(adjustment.rotacaoZ)}</small>
                        </div>
                        <button type="button" className={`admin-status-button ${adjustment.revisado ? 'is-reviewed' : ''}`} disabled={!canEdit || point.ativo === false} onClick={() => toggleAdjustment(adjustment)}>{adjustment.revisado ? 'Revisado' : 'Pendente'}</button>
                      </div>
                    ))}
                    {!point.ajustesEspecificos?.length && <div className="admin-empty compact">Nenhum Hardware específico associado. O ponto base já pode ser usado pela categoria {point.categoriaAceita}.</div>}
                  </div>

                  <AdjustmentForm point={point} hardwares={hardwares} canEdit={canEdit} onSaved={loadPoints} />
                </div>
              </article>
            ))}

            {!visiblePoints.length && (
              <div className="admin-card">
                <div className="admin-card-body admin-empty">
                  {inactiveCount > 0 && !showInactive
                    ? 'Não há pontos ativos. Ative “Mostrar excluídos” para restaurar um ponto.'
                    : 'Esta placa-mãe ainda não possui pontos de encaixe. Crie pontos para PROCESSADOR, PLACA_VIDEO, MEMORIA_RAM, ARMAZENAMENTO e os demais componentes necessários.'}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
