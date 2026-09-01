import { useEffect, useMemo, useState } from 'react'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, AdminStatus, EmptyRow, formatDate } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

const EMPTY = { nome: '', email: '', senha: '' }

export default function AdminUsers() {
  const toast = useAdminToast()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')

  async function load() {
    try { setItems(await adminService.users.list()); setError(null) } catch (err) { setError(err) }
  }

  useEffect(() => {
    let active = true
    adminService.users.list().then((result) => { if (active) { setItems(result); setError(null) } }).catch((err) => { if (active) setError(err) })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return items || []
    return (items || []).filter((item) => [item.nome, item.email, item.papel, item.id].join(' ').toLocaleLowerCase('pt-BR').includes(term))
  }, [items, search])

  async function create(event) {
    event.preventDefault()
    setCreating(true)
    try {
      await adminService.users.create({ nome: form.nome.trim(), email: form.email.trim(), senha: form.senha })
      toast.show('Usuário criado como USUARIO. Altere o papel na tabela se necessário.')
      setForm(EMPTY)
      await load()
    } catch (err) { toast.show(err.message, 'erro') } finally { setCreating(false) }
  }

  async function changeRole(item, papel) {
    try { await adminService.users.update(item.id, { papel }); toast.show('Papel atualizado.'); await load() } catch (err) { toast.show(err.message, 'erro') }
  }

  async function toggle(item) {
    try { await adminService.users.update(item.id, { ativo: item.ativo === false }); toast.show(item.ativo === false ? 'Usuário ativado.' : 'Usuário desativado.'); await load() } catch (err) { toast.show(err.message, 'erro') }
  }

  async function resetPassword(item) {
    const novaSenha = window.prompt(`Nova senha para ${item.email}:`)
    if (!novaSenha) return
    try { await adminService.users.resetPassword(item.id, novaSenha); toast.show('Senha redefinida.') } catch (err) { toast.show(err.message, 'erro') }
  }

  if (error) return <AdminError error={error} />
  if (!items) return <AdminLoading />

  return <>
    <AdminPageHeader title="Usuários e permissões" description="Gerencie papéis, status e redefinição de senha pelo backend." />
    <section className="admin-form-card" style={{ marginBottom: 18 }}><form onSubmit={create}><section className="admin-form-section"><h2>Novo usuário</h2><div className="admin-form-grid"><div className="admin-field"><label>Nome</label><input className="admin-input" required value={form.nome} onChange={(e) => setForm((current) => ({ ...current, nome: e.target.value }))} /></div><div className="admin-field"><label>E-mail</label><input className="admin-input" type="email" required value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} /></div><div className="admin-field"><label>Senha inicial</label><input className="admin-input" type="password" required minLength="8" value={form.senha} onChange={(e) => setForm((current) => ({ ...current, senha: e.target.value }))} /></div><div className="admin-field full"><small className="admin-help">Por regra do backend, toda conta nova nasce como USUARIO. Depois de criar, altere o papel na tabela abaixo se necessário.</small></div></div></section><footer className="admin-form-footer"><button className="btn btn-primario" type="submit" disabled={creating}>{creating ? 'Criando...' : 'Criar usuário'}</button></footer></form></section>

    <section className="admin-toolbar admin-toolbar--single"><label className="admin-toolbar-field"><span>Pesquisar usuários</span><input className="admin-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, e-mail, papel ou ID" /></label></section>

    <section className="admin-table-card mobile-cards"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Usuário</th><th>Papel</th><th>Status</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>{filtered.length ? filtered.map((item) => <tr key={item.id}><td data-label="Usuário"><strong>{item.nome}</strong><br /><small>{item.email}</small></td><td data-label="Papel"><select className="admin-select" value={item.papel} onChange={(e) => changeRole(item, e.target.value)}><option>USUARIO</option><option>REVISOR</option><option>EDITOR</option><option>ADMIN</option></select></td><td data-label="Status"><AdminStatus active={item.ativo} /></td><td data-label="Atualização">{formatDate(item.atualizadoEm || item.criadoEm)}</td><td data-label="Ações"><div className="admin-row-actions"><button className="admin-action-button" type="button" onClick={() => toggle(item)}>{item.ativo === false ? 'Ativar' : 'Desativar'}</button><button className="admin-action-button" type="button" onClick={() => resetPassword(item)}>Redefinir senha</button></div></td></tr>) : <EmptyRow columns={5} />}</tbody></table></div><div className="admin-list-footer"><span>{filtered.length} de {items.length} usuário(s)</span></div></section>
  </>
}
