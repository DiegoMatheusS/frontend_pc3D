import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminBack, AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

const EMPTY = {
  nome: '', marca: '', modelo: '', descricao: '', imagemUrl: '', imagemHoverUrl: '', categoria: '', finalidade: '', resolucaoRecomendada: '',
  publicado: false, ativo: true, componentes: '[]', configuracao3D: '{}',
}

function optionalString(value, editing) {
  const clean = String(value || '').trim()
  return clean || (editing ? null : undefined)
}

function sanitizeComponents(value) {
  if (!Array.isArray(value)) throw new Error('Componentes deve ser uma lista JSON.')
  return value.map((item, index) => {
    const hardwareId = Number(item?.hardwareId ?? item?.hardware?.id)
    const categoria = String(item?.categoria ?? item?.hardware?.categoria ?? '').trim().toUpperCase()
    if (!Number.isInteger(hardwareId) || hardwareId < 1 || !categoria) {
      throw new Error(`Componente ${index + 1}: informe hardwareId válido e categoria.`)
    }
    const quantidade = Number(item?.quantidade)
    const ordem = Number(item?.ordem)
    const posicao = String(item?.posicao || '').trim()
    return {
      hardwareId,
      categoria,
      ...(Number.isInteger(quantidade) && quantidade >= 1 ? { quantidade } : {}),
      ...(posicao ? { posicao: posicao.slice(0, 100) } : {}),
      ...(Number.isInteger(ordem) && ordem >= 0 ? { ordem } : { ordem: index }),
    }
  })
}

function safeConfiguration(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuração 3D deve ser um objeto JSON.')
  return value
}

export default function AdminMountedForm() {
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
    adminService.builds.get(id)
      .then((item) => {
        if (!active) return
        const cleanComponents = sanitizeComponents(item.componentes || [])
        setForm({
          ...EMPTY,
          ...item,
          componentes: JSON.stringify(cleanComponents, null, 2),
          configuracao3D: JSON.stringify(item.configuracao3D || {}, null, 2),
        })
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
      let parsedComponents
      let parsedConfiguration
      try {
        parsedComponents = JSON.parse(form.componentes || '[]')
        parsedConfiguration = JSON.parse(form.configuracao3D || '{}')
      } catch {
        throw new Error('Revise os campos JSON da build.')
      }

      const componentes = sanitizeComponents(parsedComponents)
      if (!componentes.length) throw new Error('Cadastre pelo menos um componente no PC montado.')
      const configuracao3D = safeConfiguration(parsedConfiguration)

      const body = {
        nome: form.nome.trim(),
        marca: optionalString(form.marca, editing),
        modelo: optionalString(form.modelo, editing),
        descricao: optionalString(form.descricao, editing),
        imagemUrl: optionalString(form.imagemUrl, editing),
        imagemHoverUrl: optionalString(form.imagemHoverUrl, editing),
        categoria: optionalString(form.categoria, editing),
        finalidade: optionalString(form.finalidade, editing),
        resolucaoRecomendada: optionalString(form.resolucaoRecomendada, editing),
        publicado: Boolean(form.publicado),
        ativo: Boolean(form.ativo),
        componentes,
        configuracao3D,
      }
      const saved = editing
        ? await adminService.builds.update(id, body)
        : await adminService.builds.create(body)
      toast.show('PC montado salvo.')
      navigate(`/admin/montados/${saved?.id || id}`, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLoading />
  if (error && editing && !form.nome) return <AdminError error={error} />

  return <>
    <AdminPageHeader title={editing ? 'Editar PC montado' : 'Novo PC montado'} description="Os componentes usam Hardware existente e são enviados apenas com os campos aceitos pelo backend.">
      <AdminBack to="/admin/montados">Cancelar</AdminBack>
    </AdminPageHeader>
    <form className="admin-form-layout" onSubmit={submit}>
      <div className="admin-form-card">
        <section className="admin-form-section"><h2>Identificação</h2><div className="admin-form-grid">
          <div className="admin-field full"><label>Nome</label><input className="admin-input" required value={form.nome} onChange={(e) => update('nome', e.target.value)} /></div>
          <div className="admin-field"><label>Marca</label><input className="admin-input" value={form.marca} onChange={(e) => update('marca', e.target.value)} /></div>
          <div className="admin-field"><label>Modelo</label><input className="admin-input" value={form.modelo} onChange={(e) => update('modelo', e.target.value)} /></div>
          <div className="admin-field"><label>Categoria</label><input className="admin-input" value={form.categoria} onChange={(e) => update('categoria', e.target.value)} /></div>
          <div className="admin-field"><label>Finalidade</label><input className="admin-input" value={form.finalidade} onChange={(e) => update('finalidade', e.target.value)} /></div>
          <div className="admin-field"><label>Resolução recomendada</label><input className="admin-input" value={form.resolucaoRecomendada} onChange={(e) => update('resolucaoRecomendada', e.target.value)} /></div>
          <div className="admin-field full"><label>Descrição</label><textarea className="admin-textarea" value={form.descricao} onChange={(e) => update('descricao', e.target.value)} /></div>
          <div className="admin-field full"><label>Imagem</label><input className="admin-input" type="url" value={form.imagemUrl} onChange={(e) => update('imagemUrl', e.target.value)} /></div>
          <div className="admin-field full"><label>Imagem secundária/hover</label><input className="admin-input" type="url" value={form.imagemHoverUrl} onChange={(e) => update('imagemHoverUrl', e.target.value)} /></div>
        </div></section>
        <section className="admin-form-section"><h2>Componentes</h2><div className="admin-field"><label>Componentes JSON</label><textarea className="admin-textarea admin-code-area" value={form.componentes} onChange={(e) => update('componentes', e.target.value)} /><small className="admin-help">Formato aceito: [{`{ "hardwareId": 1, "categoria": "PROCESSADOR", "quantidade": 1, "ordem": 0 }`}]. Dados internos retornados pelo banco são removidos automaticamente.</small></div></section>
        <section className="admin-form-section"><h2>Configuração 3D</h2><textarea className="admin-textarea admin-code-area" value={form.configuracao3D} onChange={(e) => update('configuracao3D', e.target.value)} /></section>
        {error && <section className="admin-form-section"><p className="admin-form-error">{error.message}</p></section>}
        <footer className="admin-form-footer"><button className="btn btn-primario" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar PC montado'}</button></footer>
      </div>
      <aside className="admin-sticky-side"><div className="admin-card"><div className="admin-card-body">
        <label className="admin-switch"><input type="checkbox" checked={form.publicado} onChange={(e) => update('publicado', e.target.checked)} /> Publicado</label><br /><br />
        <label className="admin-switch"><input type="checkbox" checked={form.ativo} onChange={(e) => update('ativo', e.target.checked)} /> Ativo</label>
      </div></div></aside>
    </form>
  </>
}
