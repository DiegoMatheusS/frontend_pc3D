import { useEffect, useMemo, useState } from 'react'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, EmptyRow, formatDate } from '../components/AdminCommon'

export default function AdminAudit(){
 const [items,setItems]=useState(null);const [error,setError]=useState(null);const [search,setSearch]=useState('')
 useEffect(()=>{adminService.audit.list().then(setItems).catch(setError)},[])
 const filtered=useMemo(()=>(items||[]).filter(i=>!search||[i.acao,i.entidade,i.entidadeId,i.usuario?.email,i.usuarioId].join(' ').toLowerCase().includes(search.toLowerCase())),[items,search])
 if(error)return <AdminError error={error}/>;if(!items)return <AdminLoading/>
 return <><AdminPageHeader title="Auditoria" description="Registro de ações administrativas gravadas pelo backend."/><section className="admin-toolbar admin-toolbar--2"><label className="admin-toolbar-field"><span>Pesquisar</span><input className="admin-input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ação, entidade ou usuário"/></label></section><section className="admin-table-card"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Data</th><th>Ação</th><th>Entidade</th><th>Usuário</th><th>IP</th></tr></thead><tbody>{filtered.length?filtered.map((item,index)=><tr key={item.id||index}><td>{formatDate(item.criadoEm||item.dataHora||item.data)}</td><td><strong>{item.acao||'—'}</strong></td><td>{item.entidade||'—'} {item.entidadeId?`#${item.entidadeId}`:''}</td><td>{item.usuario?.email||item.usuarioId||'—'}</td><td>{item.ip||'—'}</td></tr>):<EmptyRow columns={5}/>}</tbody></table></div></section></>
}
