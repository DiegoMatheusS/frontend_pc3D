import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, AdminStatus, EmptyRow, formatDate } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { useAdminPermissions } from '../components/AdminAccess'

export default function AdminMounted() {
  const toast = useAdminToast()
  const { canWriteCatalog, canDeleteCatalog } = useAdminPermissions()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  async function load() {
    try {
      setItems(await adminService.builds.list())
      setError(null)
    } catch (err) {
      setError(err)
    }
  }

  useEffect(() => {
    let active = true
    adminService.builds.list()
      .then((result) => {
        if (active) {
          setItems(result)
          setError(null)
        }
      })
      .catch((err) => {
        if (active) setError(err)
      })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => (items || []).filter((item) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [item.nome, item.marca, item.modelo, item.categoria, item.finalidade, item.id]
      .join(' ')
      .toLowerCase()
      .includes(term)
  }), [items, search])

  async function togglePublished(item) {
    try {
      const publicado = !item.publicado
      await adminService.builds.update(item.id, { publicado })
      setItems((current) => (current || []).map((entry) => entry.id === item.id
        ? {
            ...entry,
            publicado,
            produto: { ...(entry.produto || {}), publicado },
          }
        : entry))
      toast.show(publicado ? 'PC publicado.' : 'PC despublicado.')
      await load()
    } catch (err) {
      toast.show(err.message, 'erro')
    }
  }

  async function archive(item) {
    if (!window.confirm(`Arquivar “${item.nome}”? O PC deixará de aparecer no site.`)) return
    try {
      await adminService.builds.remove(item.id)
      setItems((current) => (current || []).map((entry) => entry.id === item.id
        ? {
            ...entry,
            ativo: false,
            publicado: false,
            produto: { ...(entry.produto || {}), ativo: false, publicado: false },
          }
        : entry))
      toast.show('PC montado arquivado.')
      await load()
    } catch (err) {
      toast.show(err.message, 'erro')
    }
  }

  async function reactivate(item) {
    try {
      await adminService.builds.update(item.id, { ativo: true, publicado: false })
      setItems((current) => (current || []).map((entry) => entry.id === item.id
        ? {
            ...entry,
            ativo: true,
            publicado: false,
            produto: { ...(entry.produto || {}), ativo: true, publicado: false },
          }
        : entry))
      toast.show('PC montado reativado. Revise os dados e publique quando estiver pronto.')
      await load()
    } catch (err) {
      toast.show(err.message, 'erro')
    }
  }

  if (error) return <AdminError error={error} />
  if (!items) return <AdminLoading />

  const archivedCount = items.filter((item) => item.ativo === false).length

  return <>
    <AdminPageHeader title="PCs Montados" description="Builds comerciais/recomendadas exibidas na área Montados.">
      {canWriteCatalog && <Link className="btn btn-primario" to="/admin/montados/novo">+ Novo PC montado</Link>}
    </AdminPageHeader>

    <section className="admin-toolbar admin-toolbar--2">
      <label className="admin-toolbar-field"><span>Pesquisar</span><input className="admin-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, categoria ou finalidade" /></label>
    </section>

    <section className="admin-table-card mobile-cards">
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>PC</th><th>Categoria</th><th>Componentes</th><th>Status</th><th>Atualização</th><th>Ações</th></tr></thead>
        <tbody>{filtered.length ? filtered.map((item) => <tr key={item.id}>
          <td data-label="PC"><strong>{item.nome || `PC #${item.id}`}</strong><br /><small>{item.marca || ''} {item.modelo || ''}</small></td>
          <td data-label="Categoria">{item.categoria || item.finalidade || '—'}</td>
          <td data-label="Componentes">{item.componentes?.length ?? '—'}</td>
          <td data-label="Status"><AdminStatus value={item.ativo === false ? 'ARQUIVADO' : undefined} published={item.publicado} active={item.ativo} /></td>
          <td data-label="Atualização">{formatDate(item.produto?.atualizadoEm || item.atualizadoEm)}</td>
          <td data-label="Ações"><div className="admin-row-actions">
            {canWriteCatalog && <Link className="admin-action-button" to={`/admin/montados/${item.id}`}>Editar</Link>}
            {canWriteCatalog && item.ativo !== false && <button className="admin-action-button" onClick={() => togglePublished(item)} type="button">{item.publicado ? 'Despublicar' : 'Publicar'}</button>}
            {canWriteCatalog && item.ativo === false && <button className="admin-action-button admin-action-button--success" onClick={() => reactivate(item)} type="button">Reativar</button>}
            {canDeleteCatalog && item.ativo !== false && <button className="admin-action-button" onClick={() => archive(item)} type="button">Arquivar</button>}
            {!canWriteCatalog && !canDeleteCatalog && <span className="admin-muted">Somente leitura</span>}
          </div></td>
        </tr>) : <EmptyRow columns={6} />}</tbody>
      </table></div>
      <div className="admin-filter-summary"><span>{filtered.length} PC(s) exibido(s)</span><span>{items.length - archivedCount} ativo(s) · {archivedCount} arquivado(s)</span></div>
    </section>
  </>
}
