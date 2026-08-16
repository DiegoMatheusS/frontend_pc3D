import { useEffect, useState } from 'react'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { useAdminPermissions } from '../components/AdminAccess'

const EMPTY = { id: null, nome: '', logoUrl: '', site: '', dominio: '', programaAfiliados: true, observacao: '', ativo: true }

export default function AdminPartners() {
  const toast = useAdminToast()
  const { canWriteCatalog } = useAdminPermissions()
  const [items, setItems] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    try { setItems(await adminService.offers.partners()); setError(null) } catch (err) { setError(err) }
  }

  useEffect(() => {
    let active = true
    adminService.offers.partners()
      .then((result) => { if (active) { setItems(result); setError(null) } })
      .catch((err) => { if (active) setError(err) })
    return () => { active = false }
  }, [])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(event) {
    event.preventDefault()
    if (!canWriteCatalog) return
    setSaving(true)
    try {
      const body = {
        nome: form.nome.trim(),
        logoUrl: form.logoUrl.trim() || (form.id ? null : undefined),
        site: form.site.trim() || (form.id ? null : undefined),
        dominio: form.dominio.trim() || (form.id ? null : undefined),
        programaAfiliados: Boolean(form.programaAfiliados),
        observacao: form.observacao.trim() || (form.id ? null : undefined),
        ...(form.id ? { ativo: Boolean(form.ativo) } : {}),
      }
      if (form.id) await adminService.offers.updatePartner(form.id, body)
      else await adminService.offers.createPartner(body)
      toast.show('Parceiro salvo.')
      setForm(EMPTY)
      await load()
    } catch (err) {
      toast.show(err.message, 'erro')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <AdminError error={error} />
  if (!items) return <AdminLoading />

  return <>
    <AdminPageHeader title="Parceiros afiliados" description={canWriteCatalog ? 'Cadastre e mantenha as lojas e marketplaces usados nas ofertas.' : 'Consulta das lojas e marketplaces usados nas ofertas.'} />
    {canWriteCatalog && <section className="admin-form-card" style={{ marginBottom: 18 }}><form onSubmit={submit}><section className="admin-form-section"><h2>{form.id ? 'Editar parceiro' : 'Novo parceiro'}</h2><div className="admin-form-grid"><div className="admin-field"><label>Nome</label><input className="admin-input" required value={form.nome} onChange={(e) => update('nome', e.target.value)} /></div><div className="admin-field"><label>Domínio</label><input className="admin-input" value={form.dominio} onChange={(e) => update('dominio', e.target.value)} placeholder="kabum.com.br" /></div><div className="admin-field"><label>Site</label><input className="admin-input" type="url" value={form.site} onChange={(e) => update('site', e.target.value)} /></div><div className="admin-field"><label>Logo URL</label><input className="admin-input" type="url" value={form.logoUrl} onChange={(e) => update('logoUrl', e.target.value)} /></div><div className="admin-field full"><label>Observação</label><textarea className="admin-textarea" value={form.observacao} onChange={(e) => update('observacao', e.target.value)} /></div><div className="admin-field"><label className="admin-switch"><input type="checkbox" checked={form.programaAfiliados} onChange={(e) => update('programaAfiliados', e.target.checked)} /> Programa de afiliados</label></div>{form.id && <div className="admin-field"><label className="admin-switch"><input type="checkbox" checked={form.ativo} onChange={(e) => update('ativo', e.target.checked)} /> Ativo</label></div>}</div></section><footer className="admin-form-footer"><button className="btn btn-secundario" type="button" onClick={() => setForm(EMPTY)}>Limpar</button><button className="btn btn-primario" disabled={saving} type="submit">{saving ? 'Salvando...' : 'Salvar parceiro'}</button></footer></form></section>}
    <section className="admin-partner-grid">{items.map((item) => <article className="admin-partner-card" key={item.id}><span className="admin-partner-logo">{String(item.nome || 'CB').slice(0, 2).toUpperCase()}</span><h2>{item.nome}</h2><p>{item.dominio || item.site || 'Sem domínio cadastrado'}</p><div className="admin-inline"><span className={`admin-status ${item.ativo === false ? 'status-inativo' : 'status-ativo'}`}>{item.ativo === false ? 'INATIVO' : 'ATIVO'}</span>{item.programaAfiliados && <span className="admin-status status-publicado">AFILIADO</span>}</div>{canWriteCatalog && <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => setForm({ ...EMPTY, ...item })}>Editar</button>}</article>)}</section>
  </>
}
