import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, AdminStatus, EmptyRow, formatDate } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { useAdminPermissions } from '../components/AdminAccess'

const PAGE_SIZE = 10
const ALL_HARDWARE_CATEGORIES = ['PROCESSADOR','COOLER','PLACA_MAE','MEMORIA_RAM','PLACA_VIDEO','ARMAZENAMENTO','FONTE','GABINETE','VENTOINHA','MONITOR','MOUSE','TECLADO','FONE','MICROFONE']

function canonicalHardwareCategory(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')
  if (raw === 'COOLERS') return 'COOLER'
  return raw
}

export default function AdminHardwares() {
  const toast = useAdminToast()
  const { canWriteCatalog, canCreateHardware, canDeleteCatalog } = useAdminPermissions()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  async function load() {
    try { setItems(await adminService.hardwares.list()); setError(null) } catch (err) { setError(err) }
  }
  useEffect(() => {
    let active = true
    adminService.hardwares.list().then((result) => { if (active) { setItems(result); setError(null) } }).catch((err) => { if (active) setError(err) })
    return () => { active = false }
  }, [])

  const categories = useMemo(() => [...new Set([...ALL_HARDWARE_CATEGORIES, ...(items || []).map((item) => canonicalHardwareCategory(item.categoria)).filter(Boolean)])], [items])
  const filtered = useMemo(() => (items || []).filter((item) => {
    const text = [item.nome, item.marca, item.modelo, item.mpn, item.gtin, item.categoria].join(' ').toLocaleLowerCase('pt-BR')
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return (!term || text.includes(term)) && (!category || canonicalHardwareCategory(item.categoria) === category)
  }), [items, search, category])
  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const hasMore = visibleCount < filtered.length

  async function togglePublished(item) {
    try {
      const publicado = !item.publicado
      await adminService.hardwares.update(item.id, { publicado })
      setItems((current) => (current || []).map((entry) => entry.id === item.id ? { ...entry, publicado } : entry))
      toast.show(publicado ? 'Hardware publicado.' : 'Hardware despublicado.')
    } catch (err) {
      toast.show(err.message, 'erro')
    }
  }

  async function remove(item) {
    if (!window.confirm(`Arquivar/excluir “${item.nome}”?`)) return
    try { await adminService.hardwares.remove(item.id); toast.show('Hardware removido.'); await load() } catch (err) { toast.show(err.message, 'erro') }
  }

  if (error) return <AdminError error={error} />
  if (!items) return <AdminLoading />
  return <>
    <AdminPageHeader title="Hardwares" description="Catálogo técnico usado pelo montador e pela compatibilidade. Para vender um Hardware, crie o Produto comercial a partir dele.">{canCreateHardware && <><Link className="btn btn-secundario" to="/admin/hardwares/descobrir">Descobrir com IA</Link><Link className="btn btn-primario" to="/admin/hardwares/novo">+ Cadastrar hardware</Link></>}</AdminPageHeader>
    <section className="admin-toolbar admin-toolbar--2"><label className="admin-toolbar-field"><span>Pesquisar</span><input className="admin-input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE) }} placeholder="Nome, marca, modelo, MPN, GTIN ou categoria" /></label><label className="admin-toolbar-field"><span>Categoria</span><select className="admin-select" value={category} onChange={(e) => { setCategory(e.target.value); setVisibleCount(PAGE_SIZE) }}><option value="">Todas</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label></section>
    <section className="admin-table-card mobile-cards"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Hardware</th><th>Categoria</th><th>Marca</th><th>Status</th><th>3D</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>
      {visibleItems.length ? visibleItems.map((item) => <tr key={item.id}><td data-label="Hardware"><div className="admin-product-cell"><img className="admin-product-thumb" src={item.imagemUrl || '/admin-assets/placeholder-produto.svg'} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} /><span><strong>{item.nome}</strong><small>#{item.id} · {item.modelo || 'Sem modelo'}</small></span></div></td><td data-label="Categoria">{canonicalHardwareCategory(item.categoria)}</td><td data-label="Marca">{item.marca || '—'}</td><td data-label="Status"><AdminStatus published={item.publicado} active={item.ativo} /></td><td data-label="3D">{item.modelo3D || item.modelos3D?.length ? 'Sim' : '—'}</td><td data-label="Atualização">{formatDate(item.atualizadoEm)}</td><td data-label="Ações"><div className="admin-row-actions">{canWriteCatalog && <Link className="admin-action-button" to={`/admin/hardwares/${item.id}`}>Editar</Link>}{canWriteCatalog && item.ativo !== false && <button className="admin-action-button" type="button" onClick={() => togglePublished(item)}>{item.publicado ? 'Despublicar' : 'Publicar'}</button>}{canWriteCatalog && <Link className="admin-action-button" to="/admin/produtos/novo">+ Produto</Link>}{canDeleteCatalog && <button className="admin-action-button" type="button" onClick={() => remove(item)}>Remover</button>}{!canWriteCatalog && !canDeleteCatalog && <span className="admin-muted">Somente leitura</span>}</div></td></tr>) : <EmptyRow columns={7} />}
    </tbody></table></div><div className="admin-list-footer"><span>Mostrando {Math.min(visibleItems.length, filtered.length)} de {filtered.length} hardware(s)</span>{hasMore && <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Ver mais</button>}</div></section>
  </>
}
