import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, EmptyRow, formatDate } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

const R2_PUBLIC_BASE_URL = 'https://pub-f75dfbdc12814aea925f2615df4d32a5.r2.dev/'
const HOME_MODEL_STORAGE_KEY = 'criabyte:home-modelo3d:v1'

const EMPTY = {
  id: null, hardwareId: '', nome: '', arquivoUrl: '', formato: 'GLB', versao: '',
  alturaRealMm: '', larguraRealMm: '', profundidadeRealMm: '', tamanhoBytes: '',
  posicaoCorrecaoX: 0, posicaoCorrecaoY: 0, posicaoCorrecaoZ: 0,
  rotacaoCorrecaoX: 0, rotacaoCorrecaoY: 0, rotacaoCorrecaoZ: 0,
  escalaCorrecaoX: 1, escalaCorrecaoY: 1, escalaCorrecaoZ: 1,
}

const NUMERIC = ['alturaRealMm','larguraRealMm','profundidadeRealMm','tamanhoBytes','posicaoCorrecaoX','posicaoCorrecaoY','posicaoCorrecaoZ','rotacaoCorrecaoX','rotacaoCorrecaoY','rotacaoCorrecaoZ','escalaCorrecaoX','escalaCorrecaoY','escalaCorrecaoZ']


function parseNumeroFormulario(value) {
  if (value === '' || value === null || value === undefined) return undefined
  const normalizado = String(value).trim().replace(',', '.')
  if (!normalizado) return undefined
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : undefined
}

function montarUrlR2(value) {
  const path = String(value ?? '').trim()
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${R2_PUBLIC_BASE_URL}${path.replace(/^\/+/, '')}`
}

export default function AdminModels3D() {
  const { user } = useAuth()
  const role = String(user?.papel || '').toUpperCase()
  const canEdit = ['ADMIN', 'EDITOR'].includes(role)
  const canReview = ['ADMIN', 'REVISOR'].includes(role)
  const canDelete = role === 'ADMIN'
  const toast = useAdminToast()
  const [hardwares, setHardwares] = useState(null)
  const [models, setModels] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [hardwareSearch, setHardwareSearch] = useState('')
  const [hardwareSearchOpen, setHardwareSearchOpen] = useState(false)
  const [error, setError] = useState(null)
  const [loadingModels, setLoadingModels] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingModelId, setDeletingModelId] = useState(null)
  const [homeModelId, setHomeModelId] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(HOME_MODEL_STORAGE_KEY) || 'null')
      return saved?.modelId ? String(saved.modelId) : ''
    } catch {
      return ''
    }
  })

  useEffect(() => { adminService.hardwares.list().then(setHardwares).catch(setError) }, [])
  useEffect(() => {
    if (!hardwares) return
    let active = true
    Promise.all(hardwares.map(async (hardware) => {
      try { return (await adminService.hardwares.models(hardware.id)).map((model) => ({ ...model, hardwareId: hardware.id, hardwareNome: hardware.nome })) } catch { return [] }
    })).then((groups) => active && setModels(groups.flat())).finally(() => active && setLoadingModels(false))
    return () => { active = false }
  }, [hardwares])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const hardwareMap = useMemo(() => new Map((hardwares || []).map((hardware) => [Number(hardware.id), hardware.nome])), [hardwares])
  const hardwareById = useMemo(() => new Map((hardwares || []).map((hardware) => [Number(hardware.id), hardware])), [hardwares])
  const filteredHardwares = useMemo(() => {
    const term = hardwareSearch.trim().toLocaleLowerCase('pt-BR')
    if (!term) return hardwares || []
    return (hardwares || []).filter((hardware) => [hardware.nome, hardware.marca, hardware.modelo, hardware.categoria, hardware.id]
      .filter((value) => value !== undefined && value !== null)
      .join(' ')
      .toLocaleLowerCase('pt-BR')
      .includes(term))
  }, [hardwares, hardwareSearch])
  const arquivoUrlFinal = useMemo(() => montarUrlR2(form.arquivoUrl), [form.arquivoUrl])

  async function reloadHardware(hardwareId) {
    const updated = (await adminService.hardwares.models(Number(hardwareId))).map((model) => ({ ...model, hardwareId: Number(hardwareId), hardwareNome: hardwareMap.get(Number(hardwareId)) }))
    setModels((current) => [...current.filter((model) => Number(model.hardwareId) !== Number(hardwareId)), ...updated])
  }

  function clearForm() {
    setForm(EMPTY)
    setHardwareSearch('')
    setHardwareSearchOpen(false)
  }

  function selectHardware(hardware) {
    if (!hardware || form.id) return
    update('hardwareId', String(hardware.id))
    setHardwareSearch(hardware.nome || hardware.modelo || String(hardware.id))
    setHardwareSearchOpen(false)
  }

  function edit(model) {
    setForm({
      ...EMPTY,
      ...model,
      id: model.id,
      hardwareId: model.hardwareId,
      nome: model.nome ?? '',
      arquivoUrl: model.arquivoUrl ?? '',
      formato: model.formato ?? 'GLB',
      versao: model.versao ?? '',
    })
    setHardwareSearch(model.hardwareNome || hardwareMap.get(Number(model.hardwareId)) || '')
    setHardwareSearchOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(event) {
    event.preventDefault()
    if (!canEdit) return
    setSaving(true)
    try {
      const body = {
        nome: String(form.nome ?? '').trim() || undefined,
        arquivoUrl: montarUrlR2(form.arquivoUrl),
        formato: String(form.formato ?? 'GLB'),
        versao: String(form.versao ?? '').trim() || undefined,
      }
      NUMERIC.forEach((key) => { const numero = parseNumeroFormulario(form[key]); if (numero !== undefined) body[key] = numero })
      if (form.id) await adminService.hardwares.updateModel(form.id, body)
      else await adminService.hardwares.createModel(Number(form.hardwareId), body)
      if (form.id && String(homeModelId) === String(form.id)) {
        try {
          const saved = JSON.parse(window.localStorage.getItem(HOME_MODEL_STORAGE_KEY) || '{}')
          window.localStorage.setItem(HOME_MODEL_STORAGE_KEY, JSON.stringify({
            ...saved,
            modelId: form.id,
            hardwareId: form.hardwareId,
            arquivoUrl: body.arquivoUrl,
            nome: body.nome || '',
          }))
        } catch { /* seleção local da Home não bloqueia a edição */ }
      }
      toast.show(form.id ? 'Modelo 3D atualizado.' : (canReview ? 'Modelo 3D cadastrado como PENDENTE. Clique em Aprovar para liberar no 3D público.' : 'Modelo 3D cadastrado e enviado para aprovação.'))
      const hardwareId = form.hardwareId
      clearForm()
      await reloadHardware(hardwareId)
    } catch (err) { toast.show(err.message, 'erro') } finally { setSaving(false) }
  }

  async function approve(model) {
    try { await adminService.hardwares.approveModel(model.id); toast.show('Modelo 3D aprovado.'); await reloadHardware(model.hardwareId) } catch (err) { toast.show(err.message, 'erro') }
  }

  async function toggle(model) {
    try {
      await adminService.hardwares.setModelStatus(model.id, model.ativo === false)
      if (model.ativo !== false && String(homeModelId) === String(model.id)) {
        window.localStorage.removeItem(HOME_MODEL_STORAGE_KEY)
        setHomeModelId('')
      }
      toast.show(model.ativo === false ? 'Modelo ativado.' : 'Modelo desativado.')
      await reloadHardware(model.hardwareId)
    } catch (err) { toast.show(err.message, 'erro') }
  }

  async function removeModel(model) {
    if (!canDelete || deletingModelId) return

    const nomeModelo = model.nome || model.arquivoUrl || `Modelo #${model.id}`
    const confirmed = window.confirm(
      `Excluir permanentemente "${nomeModelo}"?\n\nO cadastro será removido e, quando o arquivo for gerenciado pelo CriaByte, o backend também tentará apagá-lo do Cloudflare R2. Esta ação não pode ser desfeita.`
    )
    if (!confirmed) return

    setDeletingModelId(model.id)
    try {
      await adminService.hardwares.removeModel(model.id)

      if (String(homeModelId) === String(model.id)) {
        try { window.localStorage.removeItem(HOME_MODEL_STORAGE_KEY) } catch { /* noop */ }
        setHomeModelId('')
      }

      if (String(form.id) === String(model.id)) clearForm()
      toast.show('Modelo 3D excluído permanentemente.')
      await reloadHardware(model.hardwareId)
    } catch (err) {
      toast.show(err.message, 'erro')
    } finally {
      setDeletingModelId(null)
    }
  }

  function isGpuModel(model) {
    const hardware = hardwareById.get(Number(model.hardwareId))
    return String(hardware?.categoria || '').toUpperCase() === 'PLACA_VIDEO'
  }

  function setAsHomeModel(model) {
    if (!isGpuModel(model)) {
      toast.show('A Home usa um modelo de placa de vídeo.', 'erro')
      return
    }
    if (model.ativo === false || !model.aprovado) {
      toast.show('Ative e aprove o modelo antes de colocá-lo na Home.', 'erro')
      return
    }

    try {
      const isCurrent = String(homeModelId) === String(model.id)
      if (isCurrent) {
        window.localStorage.removeItem(HOME_MODEL_STORAGE_KEY)
        setHomeModelId('')
        toast.show('Seleção da Home removida. A Home voltará à escolha automática.')
        return
      }

      window.localStorage.setItem(HOME_MODEL_STORAGE_KEY, JSON.stringify({
        modelId: model.id,
        hardwareId: model.hardwareId,
        arquivoUrl: montarUrlR2(model.arquivoUrl),
        nome: model.nome || '',
      }))
      setHomeModelId(String(model.id))
      toast.show('Modelo selecionado para a Home neste navegador.')
    } catch {
      toast.show('Não foi possível salvar a seleção da Home neste navegador.', 'erro')
    }
  }

  if (error) return <AdminError error={error} />
  if (!hardwares) return <AdminLoading />

  return <>
    <AdminPageHeader title="Modelos 3D" description="Gerencie GLB/GLTF, dimensões, transformação e aprovação dos modelos ligados ao Hardware." />
    {canEdit && <section className="admin-form-card" style={{ marginBottom: 18 }}><form onSubmit={submit}><section className="admin-form-section">
      <div className="admin-section-heading"><div><h2>{form.id ? 'Editar modelo 3D' : 'Cadastrar modelo 3D'}</h2><p>Escala, rotação e posição são independentes por eixo.</p></div>{form.id && <button className="btn btn-secundario btn-pequeno" type="button" onClick={clearForm}>Cancelar edição</button>}</div>
      <div className="admin-form-grid">
        <div className="admin-field admin-hardware-search-field">
          <label>Pesquisar Hardware</label>
          <div className="admin-hardware-search-wrap">
            <input
              className="admin-input"
              type="search"
              disabled={Boolean(form.id)}
              value={hardwareSearch}
              onFocus={() => !form.id && setHardwareSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setHardwareSearchOpen(false), 120)}
              onChange={(e) => {
                setHardwareSearch(e.target.value)
                setHardwareSearchOpen(true)
                if (form.hardwareId) update('hardwareId', '')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setHardwareSearchOpen(false)
                if (e.key === 'Enter' && hardwareSearchOpen && filteredHardwares.length === 1) {
                  e.preventDefault()
                  selectHardware(filteredHardwares[0])
                }
              }}
              placeholder="Nome, modelo, marca ou ID"
              autoComplete="off"
            />
            {hardwareSearchOpen && !form.id && hardwareSearch.trim() && (
              <div className="admin-hardware-search-results" role="listbox" aria-label="Resultados da busca de Hardware">
                {filteredHardwares.length ? filteredHardwares.slice(0, 12).map((hardware) => (
                  <button
                    key={hardware.id}
                    type="button"
                    className={`admin-hardware-search-result${Number(form.hardwareId) === Number(hardware.id) ? ' is-selected' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectHardware(hardware)}
                    role="option"
                    aria-selected={Number(form.hardwareId) === Number(hardware.id)}
                  >
                    <span>
                      <strong>{hardware.nome || hardware.modelo || `Hardware #${hardware.id}`}</strong>
                      <small>{[hardware.marca, hardware.modelo].filter(Boolean).join(' · ') || `ID ${hardware.id}`}</small>
                    </span>
                    <em>{String(hardware.categoria || 'Hardware').replaceAll('_', ' ')}</em>
                  </button>
                )) : <div className="admin-hardware-search-empty">Nenhum Hardware encontrado para “{hardwareSearch.trim()}”.</div>}
                {filteredHardwares.length > 12 && <div className="admin-hardware-search-more">Mostrando 12 de {filteredHardwares.length} resultados. Refine a pesquisa para encontrar mais rápido.</div>}
              </div>
            )}
          </div>
          <small className="admin-help">{hardwareSearch.trim() ? `${filteredHardwares.length} resultado(s)` : `${hardwares.length} hardware(s) disponíveis`}</small>
        </div>
        <div className="admin-field"><label>Hardware</label><select className="admin-select" required disabled={Boolean(form.id)} value={form.hardwareId} onChange={(e) => { const selected = (hardwares || []).find((hardware) => Number(hardware.id) === Number(e.target.value)); update('hardwareId', e.target.value); if (selected) setHardwareSearch(selected.nome || selected.modelo || String(selected.id)); setHardwareSearchOpen(false) }}><option value="">Selecione</option>{filteredHardwares.map((hardware) => <option key={hardware.id} value={hardware.id}>{hardware.nome}{hardware.modelo ? ` · ${hardware.modelo}` : ''}</option>)}</select></div>
        <div className="admin-field"><label>Nome do modelo</label><input className="admin-input" value={form.nome ?? ''} onChange={(e) => update('nome', e.target.value)} /></div>
        <div className="admin-field full"><label>Caminho do arquivo no Cloudflare R2</label><input className="admin-input" required value={form.arquivoUrl ?? ''} onChange={(e) => update('arquivoUrl', e.target.value)} placeholder="modelos/cpu/processador_generico.glb" /><small className="admin-help">Você pode informar só o caminho. O frontend envia a URL completa do R2 automaticamente.{arquivoUrlFinal ? <> URL final: <strong>{arquivoUrlFinal}</strong></> : null}</small></div>
        <div className="admin-field"><label>Formato</label><select className="admin-select" value={form.formato ?? 'GLB'} onChange={(e) => update('formato', e.target.value)}><option>GLB</option><option>GLTF</option><option>FBX</option><option>OBJ</option></select></div>
        <div className="admin-field"><label>Versão</label><input className="admin-input" value={form.versao ?? ''} onChange={(e) => update('versao', e.target.value)} /></div>
        <div className="admin-vector-group full"><strong>Dimensões reais (mm)</strong>{[['alturaRealMm','Altura'],['larguraRealMm','Largura'],['profundidadeRealMm','Profund.']].map(([key,label]) => <label key={key}>{label}<input className="admin-input" type="number" inputMode="decimal" min="0" step="any" value={form[key] ?? ''} onChange={(e) => update(key, e.target.value)} /></label>)}</div>
        <div className="admin-vector-group full"><strong>Escala</strong>{['X','Y','Z'].map((axis) => <label key={axis}>{axis}<input className="admin-input" type="number" inputMode="decimal" step="any" value={form[`escalaCorrecao${axis}`] ?? ''} onChange={(e) => update(`escalaCorrecao${axis}`, e.target.value)} /></label>)}</div>
        <div className="admin-vector-group full"><strong>Rotação (graus)</strong>{['X','Y','Z'].map((axis) => <label key={axis}>{axis}<input className="admin-input" type="number" inputMode="decimal" step="any" value={form[`rotacaoCorrecao${axis}`] ?? ''} onChange={(e) => update(`rotacaoCorrecao${axis}`, e.target.value)} /></label>)}</div>
        <div className="admin-vector-group full"><strong>Posição</strong>{['X','Y','Z'].map((axis) => <label key={axis}>{axis}<input className="admin-input" type="number" inputMode="decimal" step="any" value={form[`posicaoCorrecao${axis}`] ?? ''} onChange={(e) => update(`posicaoCorrecao${axis}`, e.target.value)} /></label>)}</div>
        <div className="admin-field full"><small className="admin-help">Dimensões definem o tamanho físico do GLB. Escala X/Y/Z é aplicada depois como correção final. Rotação usa graus. Posição é somada ao ponto de encaixe.</small></div>
      </div>
    </section><footer className="admin-form-footer"><button className="btn btn-primario" type="submit" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Cadastrar modelo'}</button></footer></form></section>}

    <section className="admin-table-card mobile-cards"><div className="admin-table-wrap admin-models3d-table-wrap"><table className="admin-table admin-models3d-table"><thead><tr><th>Hardware</th><th>Modelo</th><th>Formato</th><th>Escala</th><th>Aprovação</th><th>Status</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>
      {loadingModels ? <EmptyRow columns={8} text="Carregando modelos..." /> : models.length ? models.map((model) => <tr key={`${model.hardwareId}-${model.id}`}>
        <td data-label="Hardware">{model.hardwareNome || hardwareMap.get(Number(model.hardwareId))}</td>
        <td data-label="Modelo" className="admin-models3d-model-cell"><strong>{model.nome || model.arquivoUrl}</strong><br/><small>{model.arquivoUrl}</small></td>
        <td data-label="Formato">{model.formato}</td><td data-label="Escala">{[model.escalaCorrecaoX,model.escalaCorrecaoY,model.escalaCorrecaoZ].map((value) => value ?? 1).join(' / ')}</td>
        <td data-label="Aprovação"><span className={`admin-status ${model.aprovado ? 'status-publicado' : 'status-rascunho'}`}>{model.aprovado ? 'APROVADO' : 'PENDENTE · NÃO APARECE NO 3D'}</span></td>
        <td data-label="Status"><span className={`admin-status ${model.ativo === false ? 'status-inativo' : 'status-ativo'}`}>{model.ativo === false ? 'INATIVO' : 'ATIVO'}</span></td>
        <td data-label="Atualização">{formatDate(model.atualizadoEm)}</td>
        <td data-label="Ações"><div className="admin-row-actions admin-models3d-actions">{canEdit && <button className="admin-action-button" type="button" onClick={() => edit(model)}>Editar</button>}{canReview && !model.aprovado && <button className="admin-action-button" type="button" onClick={() => approve(model)}>Aprovar</button>}{isGpuModel(model) && <button className={`admin-action-button${String(homeModelId) === String(model.id) ? ' is-home-model' : ''}`} type="button" disabled={model.ativo === false || !model.aprovado} onClick={() => setAsHomeModel(model)}>{String(homeModelId) === String(model.id) ? 'Na Home' : 'Home'}</button>}{canReview && <button className="admin-action-button" type="button" onClick={() => toggle(model)}>{model.ativo === false ? 'Ativar' : 'Desativar'}</button>}{canDelete && <button className="admin-action-button admin-action-button--danger" type="button" disabled={deletingModelId !== null} onClick={() => removeModel(model)}>{String(deletingModelId) === String(model.id) ? 'Excluindo...' : 'Excluir'}</button>}</div></td>
      </tr>) : <EmptyRow columns={8} />}
    </tbody></table></div></section>
  </>
}
