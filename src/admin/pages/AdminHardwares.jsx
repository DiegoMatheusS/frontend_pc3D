import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, AdminStatus, EmptyRow, formatDate } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { useAdminPermissions } from '../components/AdminAccess'
import AdminPermanentHardwareDelete from '../components/AdminPermanentHardwareDelete'
import { archiveWasConfirmed } from '../utils/hardwareArchive'

const PAGE_SIZE = 10
const CATEGORIES = ['PROCESSADOR','COOLER','PLACA_MAE','MEMORIA_RAM','PLACA_VIDEO','ARMAZENAMENTO','FONTE','GABINETE','VENTOINHA']
const categoryOf = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^COOLERS$/, 'COOLER')

export default function AdminHardwares() {
  const toast = useAdminToast()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`
  const { canWriteCatalog, canCreateHardware, canDeleteCatalog } = useAdminPermissions()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [deleting, setDeleting] = useState(null)

  async function load() {
    const result = await adminService.hardwares.list()
    setItems(result)
    setError(null)
    return result
  }
  useEffect(() => {
    let active = true
    adminService.hardwares.list().then((result) => { if (active) { setItems(result); setError(null) } }).catch((err) => { if (active) setError(err) })
    return () => { active = false }
  }, [])

  const categories = useMemo(() => [...new Set([...CATEGORIES, ...(items || []).map((item) => categoryOf(item.categoria)).filter(Boolean)])], [items])
  const filtered = useMemo(() => (items || []).filter((item) => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const text = [item.nome, item.marca, item.modelo, item.mpn, item.gtin, item.categoria].join(' ').toLocaleLowerCase('pt-BR')
    return (includeArchived || item.ativo !== false) && (!term || text.includes(term)) && (!category || categoryOf(item.categoria) === category)
  }), [items, search, category, includeArchived])
  const visibleItems = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length
  const archivedCount = (items || []).filter((item) => item.ativo === false).length

  async function togglePublished(item) {
    try {
      const publicado = !item.publicado
      await adminService.hardwares.update(item.id, { publicado })
      setItems((current) => (current || []).map((entry) => entry.id === item.id ? { ...entry, publicado } : entry))
      toast.show(publicado ? 'Hardware publicado.' : 'Hardware despublicado.')
    } catch (err) { toast.show(err.message, 'erro') }
  }

  async function remove(item) {
    if (!window.confirm(`Arquivar “${item.nome}”? O registro e seus vínculos continuarão no banco.`)) return
    setDeleting(item.id)
    try {
      await adminService.hardwares.remove(item.id)
      const refreshed = await load()
      toast.show(archiveWasConfirmed(refreshed, item.id) ? 'Hardware arquivado com sucesso.' : 'Hardware permanece ativo após a operação. Verifique o backend.', archiveWasConfirmed(refreshed, item.id) ? 'info' : 'erro')
    } catch (err) { toast.show(err.message, 'erro') }
    finally { setDeleting(null) }
  }

  if (error) return <AdminError error={error} />
  if (!items) return <AdminLoading />
  return <>
    <AdminPageHeader title="Hardwares" description="Catálogo técnico. Arquivar mantém o registro e os vínculos; exclusão definitiva é uma ação separada.">{canCreateHardware && <><Link className="btn btn-secundario" to="/admin/hardwares/descobrir">Descobrir com IA</Link><Link className="btn btn-primario" to="/admin/hardwares/novo" state={{ returnTo }}>+ Cadastrar hardware</Link></>}</AdminPageHeader>
    <section className="admin-toolbar admin-toolbar--2">
      <label className="admin-toolbar-field"><span>Pesquisar</span><input className="admin-input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE) }} placeholder="Nome, marca, modelo, MPN, GTIN ou categoria" /></label>
      <label className="admin-toolbar-field"><span>Categoria</span><select className="admin-select" value={category} onChange={(e) => { setCategory(e.target.value); setVisibleCount(PAGE_SIZE) }}><option value="">Todas</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
      <label className="admin-toolbar-field"><span>Registros arquivados: {archivedCount}</span><span><input type="checkbox" checked={includeArchived} onChange={(e) => { setIncludeArchived(e.target.checked); setVisibleCount(PAGE_SIZE) }} /> Mostrar arquivados</span></label>
    </section>
    <section className="admin-table-card mobile-cards"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Hardware</th><th>Categoria</th><th>Marca</th><th>Status</th><th>3D</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>
      {visibleItems.length ? visibleItems.map((item) => <tr key={item.id}><td data-label="Hardware"><div className="admin-product-cell"><img className="admin-product-thumb" src={item.imagemUrl || '/admin-assets/placeholder-produto.svg'} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} /><span><strong>{item.nome}</strong><small>#{item.id} · {item.modelo || 'Sem modelo'}</small></span></div></td><td data-label="Categoria">{categoryOf(item.categoria)}</td><td data-label="Marca">{item.marca || '—'}</td><td data-label="Status">{item.ativo === false ? 'Arquivado' : <AdminStatus published={item.publicado} active={item.ativo} />}</td><td data-label="3D">{item.modelo3D || item.modelos3D?.length ? 'Sim' : '—'}</td><td data-label="Atualização">{formatDate(item.atualizadoEm)}</td><td data-label="Ações"><div className="admin-row-actions">{canWriteCatalog && <Link className="admin-action-button" to={`/admin/hardwares/${item.id}`} state={{ returnTo }}>Editar</Link>}{canWriteCatalog && item.ativo !== false && <button className="admin-action-button" type="button" onClick={() => togglePublished(item)}>{item.publicado ? 'Despublicar' : 'Publicar'}</button>}{canWriteCatalog && <Link className="admin-action-button" to="/admin/produtos/novo" state={{ returnTo }}>+ Produto</Link>}{canDeleteCatalog && item.ativo !== false && <button className="admin-action-button" type="button" disabled={deleting !== null} onClick={() => remove(item)}>{deleting === item.id ? 'Arquivando...' : 'Arquivar'}</button>}{canDeleteCatalog && item.ativo === false && <AdminPermanentHardwareDelete hardware={item} onRefresh={load} />}{!canWriteCatalog && !canDeleteCatalog && <span className="admin-muted">Somente leitura</span>}</div></td></tr>) : <EmptyRow columns={7} />}
    </tbody></table></div><div className="admin-list-footer"><span>Mostrando {visibleItems.length} de {filtered.length} hardware(s)</span>{hasMore && <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Ver mais</button>}</div></section>
  </>
}
