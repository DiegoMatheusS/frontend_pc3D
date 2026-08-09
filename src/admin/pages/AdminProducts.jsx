import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, AdminStatus, EmptyRow, formatDate } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

function categoryName(product) {
  return product.categoria?.nome || product.categoriaNome || product.categoria || '—'
}

export default function AdminProducts() {
  const toast = useAdminToast()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')

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
    const text = [item.nome, item.marca, item.fabricante, item.modelo, item.mpn, item.gtin].join(' ').toLowerCase()
    const published = item.publicado !== false && item.ativo !== false
    return (!search || text.includes(search.toLowerCase())) && (!category || categoryName(item) === category) && (!status || (status === 'PUBLICADO' ? published : !published))
  }), [items, search, category, status])

  async function remove(item) {
    if (!window.confirm(`Excluir “${item.nome}”?`)) return
    try { await adminService.products.remove(item.id); toast.show('Produto removido.'); await load() } catch (err) { toast.show(err.message, 'erro') }
  }

  if (error) return <AdminError error={error} />
  if (!items) return <AdminLoading />

  return (
    <>
      <AdminPageHeader title="Produtos" description="Catálogo comercial para monitores, periféricos e demais itens que não são Hardware do montador.">
        <Link className="btn btn-primario" to="/admin/produtos/novo">+ Cadastrar produto</Link>
      </AdminPageHeader>
      <section className="admin-toolbar admin-toolbar--3">
        <label className="admin-toolbar-field"><span>Pesquisar</span><input className="admin-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, MPN, marca ou modelo" /></label>
        <label className="admin-toolbar-field"><span>Categoria</span><select className="admin-select" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className="admin-toolbar-field"><span>Status</span><select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option><option value="PUBLICADO">Publicado</option><option value="RASCUNHO">Rascunho/inativo</option></select></label>
      </section>
      <section className="admin-table-card mobile-cards">
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Marca</th><th>MPN</th><th>Status</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>
          {filtered.length ? filtered.map((item) => <tr key={item.id}>
            <td data-label="Produto"><div className="admin-product-cell"><img className="admin-product-thumb" src={item.imagemUrl || '/admin-assets/placeholder-produto.svg'} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} /><span><strong>{item.nome}</strong><small>#{item.id} · {item.modelo || 'Sem modelo'}</small></span></div></td>
            <td data-label="Categoria">{categoryName(item)}</td><td data-label="Marca">{item.marca || item.fabricante || '—'}</td><td data-label="MPN">{item.mpn || '—'}</td>
            <td data-label="Status"><AdminStatus published={item.publicado} active={item.ativo} /></td><td data-label="Atualização">{formatDate(item.atualizadoEm)}</td>
            <td data-label="Ações"><div className="admin-row-actions"><Link className="admin-action-button" to={`/admin/produtos/${item.id}`}>Editar</Link><Link className="admin-action-button" to={`/admin/ofertas/novo?produtoId=${item.id}`}>+ Oferta</Link><button className="admin-action-button" type="button" onClick={() => remove(item)}>Excluir</button></div></td>
          </tr>) : <EmptyRow columns={7} />}
        </tbody></table></div><div className="admin-filter-summary"><span>{filtered.length} produto(s)</span></div>
      </section>
    </>
  )
}
