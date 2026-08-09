import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, AdminStatus, EmptyRow, formatDate, formatMoney } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

export default function AdminOffers() {
  const toast = useAdminToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [status, setStatus] = useState('')
  async function load() {
    try {
      const [offers, partners, products, hardwares] = await Promise.all([
        adminService.offers.list(), adminService.offers.partners(), adminService.products.list().catch(()=>[]), adminService.hardwares.list().catch(()=>[]),
      ])
      setData({ offers, partners, products, hardwares }); setError(null)
    } catch (err) { setError(err) }
  }
  useEffect(()=>{ let active=true; Promise.all([adminService.offers.list(),adminService.offers.partners(),adminService.products.list().catch(()=>[]),adminService.hardwares.list().catch(()=>[])]).then(([offers,partners,products,hardwares])=>{if(active){setData({offers,partners,products,hardwares});setError(null)}}).catch(err=>{if(active)setError(err)}); return()=>{active=false} },[])
  const names = useMemo(()=>{
    const map=new Map(); (data?.products||[]).forEach(i=>map.set(`p-${i.id}`,i.nome)); (data?.hardwares||[]).forEach(i=>map.set(`h-${i.id}`,i.nome)); return map
  },[data])
  const partnersMap = useMemo(()=>new Map((data?.partners||[]).map(i=>[Number(i.id),i.nome])),[data])
  const filtered = useMemo(()=>(data?.offers||[]).filter((item)=>{
    const target=item.produtoId?names.get(`p-${item.produtoId}`):names.get(`h-${item.hardwareId}`)
    const text=[target,item.vendedorNome,partnersMap.get(Number(item.parceiroId)),item.urlOriginal].join(' ').toLowerCase()
    return (!search||text.includes(search.toLowerCase()))&&(!partnerId||Number(item.parceiroId)===Number(partnerId))&&(!status||String(item.status||'').toUpperCase()===status)
  }),[data,search,partnerId,status,names,partnersMap])
  async function remove(item){ if(!window.confirm('Descontinuar esta oferta? Ela continuará no histórico, mas deixará de ficar ativa.'))return; try{ await adminService.offers.remove(item.id); toast.show('Oferta descontinuada.'); await load() }catch(err){toast.show(err.message,'erro')} }
  if(error)return <AdminError error={error}/>; if(!data)return <AdminLoading/>
  return <>
    <AdminPageHeader title="Ofertas afiliadas" description="Preço, parceiro e links comerciais ficam separados da ficha técnica."><Link className="btn btn-primario" to="/admin/ofertas/novo">+ Cadastrar oferta</Link></AdminPageHeader>
    <section className="admin-toolbar admin-toolbar--3"><label className="admin-toolbar-field"><span>Pesquisar</span><input className="admin-input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Produto, hardware, loja ou vendedor"/></label><label className="admin-toolbar-field"><span>Parceiro</span><select className="admin-select" value={partnerId} onChange={e=>setPartnerId(e.target.value)}><option value="">Todos</option>{data.partners.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><label className="admin-toolbar-field"><span>Status</span><select className="admin-select" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos</option><option>ATIVA</option><option>INDISPONIVEL</option><option>DESCONTINUADA</option></select></label></section>
    <section className="admin-table-card mobile-cards"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Item</th><th>Parceiro</th><th>Preço</th><th>Frete</th><th>Status</th><th>Validade</th><th>Ações</th></tr></thead><tbody>{filtered.length?filtered.map(item=>{const target=item.produtoId?names.get(`p-${item.produtoId}`):names.get(`h-${item.hardwareId}`);return <tr key={item.id}><td data-label="Item"><strong>{target||`Oferta #${item.id}`}</strong><br/><small>{item.vendedorNome||item.vendedorIdentificador||''}</small></td><td data-label="Parceiro">{partnersMap.get(Number(item.parceiroId))||'—'}</td><td data-label="Preço"><strong>{formatMoney(item.preco)}</strong>{item.precoAnterior&&<><br/><small>antes {formatMoney(item.precoAnterior)}</small></>}</td><td data-label="Frete">{item.frete!=null?formatMoney(item.frete):'—'}</td><td data-label="Status"><AdminStatus value={item.status||'ATIVA'}/></td><td data-label="Validade">{formatDate(item.validoAte)}</td><td data-label="Ações"><div className="admin-row-actions"><Link className="admin-action-button" to={`/admin/ofertas/${item.id}`}>Editar</Link><button className="admin-action-button" type="button" onClick={()=>remove(item)}>Descontinuar</button></div></td></tr>}):<EmptyRow columns={7}/>}</tbody></table></div><div className="admin-filter-summary"><span>{filtered.length} oferta(s)</span></div></section>
  </>
}
