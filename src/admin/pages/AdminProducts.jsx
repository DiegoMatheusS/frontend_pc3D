import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, AdminStatus, EmptyRow, formatDate } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { useAdminPermissions } from '../components/AdminAccess'
import { getSpecializedProductTarget } from '../utils/productRouting'

const PAGE_SIZE = 10

function categoryName(product) {
  return product.categoria?.nome || product.categoriaNome || product.categoria || '—'
}

export default function AdminProducts() {
  const toast = useAdminToast()
  const { canWriteCatalog, canDeleteCatalog } = useAdminPermissions()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  async function load() {
    try { setError(null); setItems(await adminService.products.list()) } catch (err) { setError(err) }
  }
  useEffect(() => {
    let active = true
    adminService.products.list().then((result) => { if (active) { setItems(result); setError(null) } }).catch((err) => { if (active) setError(err) })
    return () => { active = false }
  }, [])


  const categories = useMemo(() => [...new Set((items || []).map(categoryName).filter((v) => v !== '—'))].sort(), [items])
  const filtered = useMemo(() => (items || []).filter((item) => {
    const text = [item.nome, item.marca, item.fabricante, item.modelo, item.mpn, item.gtin].join(' ').toLocaleLowerCase('pt-BR')
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const published = item.publicado !== false && item.ativo !== false
    return (!term || text.includes(term)) && (!category || categoryName(item) === category) && (!status || (status === 'PUBLICADO' ? published : !published))
  }), [items, search, category, status])
  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const hasMore = visibleCount < filtered.length

  async function remove(item) {
    const specialized = getSpecializedProductTarget(item)
    const label = specialized?.label || 'produto'
    if (!window.confirm(`Arquivar ${label.toLowerCase()} “${item.nome}”?`)) return
    try {
      if (specialized?.kind === 'HARDWARE') await adminService.hardwares.remove(specialized.id)
      else if (specialized?.kind === 'NOTEBOOK') await adminService.notebooks.remove(specialized.id)
      else if (specialized?.kind === 'BUILD') await adminService.builds.remove(specialized.id)
      else await adminService.products.remove(item.id)
      toast.show(`${specialized?.label || 'Produto'} arquivado.`)
      await load()
    } catch (err) {
      toast.show(err.message, 'erro')
    }
  }

  if (error) return <AdminError error={error} />
  if (!items) return <AdminLoading />

  return (
    <>
      <AdminPageHeader title="Produtos" description="Catálogo comercial. Produtos podem ser criados a partir de Hardware existente e receber a oferta afiliada no mesmo cadastro.">
        {canWriteCatalog && <Link className="btn btn-primario" to="/admin/produtos/novo">+ Cadastrar produto</Link>}
      </AdminPageHeader>
      <section className="admin-toolbar admin-toolbar--3">
        <label className="admin-toolbar-field"><span>Pesquisar</span><input className="admin-input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE) }} placeholder="Nome, MPN, GTIN, marca ou modelo" /></label>
        <label className="admin-toolbar-field"><span>Categoria</span><select className="admin-select" value={category} onChange={(e) => { setCategory(e.target.value); setVisibleCount(PAGE_SIZE) }}><option value="">Todas</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className="admin-toolbar-field"><span>Status</span><select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setVisibleCount(PAGE_SIZE) }}><option value="">Todos</option><option value="PUBLICADO">Publicado</option><option value="RASCUNHO">Rascunho/inativo</option></select></label>
      </section>
      <section className="admin-table-card mobile-cards">
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Marca</th><th>MPN</th><th>Status</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>
          {visibleItems.length ? visibleItems.map((item) => <tr key={item.id}>
            <td data-label="Produto"><div className="admin-product-cell"><img className="admin-product-thumb" src={item.imagemUrl || '/admin-assets/placeholder-produto.svg'} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} /><span><strong>{item.nome}</strong><small>#{item.id} · {item.modelo || 'Sem modelo'}</small></span></div></td>
            <td data-label="Categoria">{categoryName(item)}</td><td data-label="Marca">{item.marca || item.fabricante || '—'}</td><td data-label="MPN">{item.mpn || '—'}</td>
            <td data-label="Status"><AdminStatus published={item.publicado} active={item.ativo} /></td><td data-label="Atualização">{formatDate(item.atualizadoEm)}</td>
            <td data-label="Ações"><div className="admin-row-actions">{(() => {
              const specialized = getSpecializedProductTarget(item)
              return <>
                {canWriteCatalog && <Link className="admin-action-button" to={specialized?.route || `/admin/produtos/${item.id}`}>{specialized ? `Editar ${specialized.label}` : 'Editar'}</Link>}
                {canWriteCatalog && <Link className="admin-action-button admin-action-button--success" to={`/admin/ofertas/novo?produtoId=${encodeURIComponent(item.id)}`}>+ Oferta</Link>}
                {canDeleteCatalog && <button className="admin-action-button" type="button" onClick={() => remove(item)}>{specialized ? `Arquivar ${specialized.label}` : 'Arquivar'}</button>}
                {!canWriteCatalog && !canDeleteCatalog && <span className="admin-muted">Somente leitura</span>}
              </>
            })()}</div></td>
          </tr>) : <EmptyRow columns={7} />}
        </tbody></table></div>
        <div className="admin-list-footer"><span>Mostrando {Math.min(visibleItems.length, filtered.length)} de {filtered.length} produto(s)</span>{hasMore && <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Ver mais</button>}</div>
      </section>
    </>
  )
}
