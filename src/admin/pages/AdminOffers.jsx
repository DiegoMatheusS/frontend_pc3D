import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, AdminStatus, EmptyRow, formatDate, formatMoney } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { useAdminPermissions } from '../components/AdminAccess'

export default function AdminOffers() {
  const toast = useAdminToast()
  const { canWriteCatalog, canDeleteCatalog } = useAdminPermissions()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [status, setStatus] = useState('')
  const [checkingPrices, setCheckingPrices] = useState(false)
  async function load() {
    try {
      const [offers, partners, products, hardwares] = await Promise.all([
        adminService.offers.list(), adminService.offers.partners(), adminService.products.list().catch(()=>[]), adminService.hardwares.list().catch(()=>[]),
      ])
      setData({ offers, partners, products, hardwares }); setError(null)
    } catch (err) { setError(err) }
  }
  useEffect(()=>{ let active=true; Promise.all([adminService.offers.list(),adminService.offers.partners(),adminService.products.list().catch(()=>[]),adminService.hardwares.list().catch(()=>[])]).then(([offers,partners,products,hardwares])=>{if(active){setData({offers,partners,products,hardwares});setError(null)}}).catch(err=>{if(active)setError(err)}); return()=>{active=false} },[])
  const itemsMap = useMemo(()=>{
    const map=new Map();
    ;(data?.products||[]).forEach(i=>map.set(`p-${i.id}`,i))
    ;(data?.hardwares||[]).forEach(i=>map.set(`h-${i.id}`,i))
    return map
  },[data])
  const partnersMap = useMemo(()=>new Map((data?.partners||[]).map(i=>[Number(i.id),i.nome])),[data])
  const filtered = useMemo(()=>(data?.offers||[]).filter((item)=>{
    const target=item.produtoId?itemsMap.get(`p-${item.produtoId}`):itemsMap.get(`h-${item.hardwareId}`)
    const text=[target?.nome,target?.marca,target?.modelo,item.vendedorNome,partnersMap.get(Number(item.parceiroId)),item.urlOriginal].join(' ').toLowerCase()
    return (!search||text.includes(search.toLowerCase()))&&(!partnerId||Number(item.parceiroId)===Number(partnerId))&&(!status||String(item.status||'').toUpperCase()===status)
  }),[data,search,partnerId,status,itemsMap,partnersMap])
  const offerStatus = (item) => String(item?.status || 'ATIVA').toUpperCase()
  async function remove(item){
    if(!window.confirm('Descontinuar esta oferta? Ela continuará no histórico, mas deixará de ficar ativa.')) return
    try {
      await adminService.offers.remove(item.id)
      setData((current) => current ? {
        ...current,
        offers: (current.offers || []).map((entry) => entry.id === item.id ? { ...entry, status: 'DESCONTINUADA' } : entry),
      } : current)
      toast.show('Oferta descontinuada.')
      await load()
    } catch(err) { toast.show(err.message,'erro') }
  }
  async function reactivate(item){
    try {
      await adminService.offers.setStatus(item.id, 'ATIVA')
      setData((current) => current ? {
        ...current,
        offers: (current.offers || []).map((entry) => entry.id === item.id ? { ...entry, status: 'ATIVA' } : entry),
      } : current)
      toast.show(item.validoAte
        ? 'Oferta reativada. Confira a validade antes de mantê-la publicada.'
        : 'Oferta reativada com sucesso.', 'sucesso')
      await load()
    } catch (err) { toast.show(err.message, 'erro') }
  }
  async function verifyPrices(){
    setCheckingPrices(true)
    try {
      const result = await adminService.offers.verifyPrices(50)
      await load()
      const remaining = Number(result?.restantesElegiveis || 0)
      const summary = `${result?.verificadas ?? 0} verificadas · ${result?.atualizadas ?? 0} atualizadas · ${result?.semAlteracao ?? 0} sem alteração · ${result?.indisponiveis ?? 0} indisponíveis · ${result?.falharam ?? 0} falharam`
      toast.show(remaining > 0 ? `${summary}. Restam ${remaining} para outro lote.` : summary, 'sucesso')
    } catch (err) {
      toast.show(err?.message || 'Não foi possível verificar os preços.', 'erro')
    } finally {
      setCheckingPrices(false)
    }
  }
  if(error)return <AdminError error={error}/>; if(!data)return <AdminLoading/>
  return <>
    <AdminPageHeader title="Ofertas afiliadas" description="Gerencie múltiplas ofertas por Produto, com parceiro, preço e link afiliado independentes.">
      {canWriteCatalog && <button className="btn btn-secundario" type="button" onClick={verifyPrices} disabled={checkingPrices}>{checkingPrices ? 'Verificando preços...' : 'Verificar preços'}</button>}
      {canWriteCatalog && <Link className="btn btn-primario" to="/admin/ofertas/novo">+ Nova oferta</Link>}
    </AdminPageHeader>
    <section className="admin-toolbar admin-toolbar--3"><label className="admin-toolbar-field"><span>Pesquisar</span><input className="admin-input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Produto, hardware, loja ou vendedor"/></label><label className="admin-toolbar-field"><span>Parceiro</span><select className="admin-select" value={partnerId} onChange={e=>setPartnerId(e.target.value)}><option value="">Todos</option>{data.partners.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><label className="admin-toolbar-field"><span>Status</span><select className="admin-select" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos</option><option>ATIVA</option><option>INDISPONIVEL</option><option>DESCONTINUADA</option></select></label></section>
    <section className="admin-table-card mobile-cards"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Item</th><th>Parceiro</th><th>Preço</th><th>Frete</th><th>Status</th><th>Validade</th><th>Ações</th></tr></thead><tbody>{filtered.length?filtered.map(item=>{const target=item.produtoId?itemsMap.get(`p-${item.produtoId}`):itemsMap.get(`h-${item.hardwareId}`);return <tr key={item.id}><td data-label="Item"><div className="admin-product-cell"><img className="admin-product-thumb" src={target?.imagemUrl || '/admin-assets/placeholder-produto.svg'} alt="" onError={(event)=>{event.currentTarget.style.visibility='hidden'}}/><span><strong>{target?.nome||`Oferta #${item.id}`}</strong><small>{item.vendedorNome||item.vendedorIdentificador||target?.modelo||''}</small></span></div></td><td data-label="Parceiro">{partnersMap.get(Number(item.parceiroId))||'—'}</td><td data-label="Preço"><strong>{formatMoney(item.preco)}</strong>{item.precoAnterior&&<><br/><small>antes {formatMoney(item.precoAnterior)}</small></>}</td><td data-label="Frete">{item.frete!=null?formatMoney(item.frete):'—'}</td><td data-label="Status"><AdminStatus value={item.status||'ATIVA'}/></td><td data-label="Validade">{formatDate(item.validoAte)}</td><td data-label="Ações"><div className="admin-row-actions">{canWriteCatalog && <Link className="admin-action-button" to={`/admin/ofertas/${item.id}`}>Editar</Link>}{canWriteCatalog && offerStatus(item) !== 'ATIVA' && <button className="admin-action-button admin-action-button--success" type="button" onClick={()=>reactivate(item)}>Reativar</button>}{canDeleteCatalog && offerStatus(item) !== 'DESCONTINUADA' && <button className="admin-action-button" type="button" onClick={()=>remove(item)}>Descontinuar</button>}{!canWriteCatalog && !canDeleteCatalog && <span className="admin-muted">Somente leitura</span>}</div></td></tr>}):<EmptyRow columns={7}/>}</tbody></table></div><div className="admin-filter-summary"><span>{filtered.length} oferta(s) exibida(s)</span><span>{(data.offers||[]).filter(i=>offerStatus(i)==='ATIVA').length} ativa(s) · {(data.offers||[]).filter(i=>offerStatus(i)==='DESCONTINUADA').length} descontinuada(s)</span></div></section>
  </>
}
