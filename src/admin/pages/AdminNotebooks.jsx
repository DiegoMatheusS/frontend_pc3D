import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, AdminStatus, EmptyRow, formatDate } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

export default function AdminNotebooks(){
 const toast=useAdminToast();const [items,setItems]=useState(null);const [error,setError]=useState(null);const [search,setSearch]=useState('')
 async function load(){try{setItems(await adminService.notebooks.list());setError(null)}catch(err){setError(err)}}useEffect(()=>{let active=true;adminService.notebooks.list().then(result=>{if(active){setItems(result);setError(null)}}).catch(err=>{if(active)setError(err)});return()=>{active=false}},[])
 const filtered=useMemo(()=>(items||[]).filter(i=>!search||[i.nome,i.marca,i.modelo,i.mpn].join(' ').toLowerCase().includes(search.toLowerCase())),[items,search])
 async function toggle(item){try{await adminService.notebooks.update(item.id,{publicado:!item.publicado});toast.show(item.publicado?'Notebook despublicado.':'Notebook publicado.');await load()}catch(err){toast.show(err.message,'erro')}}
 async function remove(item){if(!window.confirm(`Arquivar “${item.nome}”?`))return;try{await adminService.notebooks.remove(item.id);toast.show('Notebook arquivado.');await load()}catch(err){toast.show(err.message,'erro')}}
 if(error)return <AdminError error={error}/>;if(!items)return <AdminLoading/>
 return <><AdminPageHeader title="Notebooks" description="Catálogo técnico dedicado exibido na área pública."><Link className="btn btn-primario" to="/admin/notebooks/novo">+ Novo notebook</Link></AdminPageHeader><section className="admin-toolbar admin-toolbar--2"><label className="admin-toolbar-field"><span>Pesquisar</span><input className="admin-input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome, marca ou modelo"/></label></section><section className="admin-table-card mobile-cards"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Notebook</th><th>Marca</th><th>Status</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>{filtered.length?filtered.map(item=><tr key={item.id}><td><strong>{item.nome}</strong><br/><small>#{item.id} · {item.modelo}</small></td><td>{item.marca}</td><td><AdminStatus published={item.publicado} active={item.ativo}/></td><td>{formatDate(item.atualizadoEm)}</td><td><div className="admin-row-actions"><Link className="admin-action-button" to={`/admin/notebooks/${item.id}`}>Editar</Link><button className="admin-action-button" type="button" onClick={()=>toggle(item)}>{item.publicado?'Despublicar':'Publicar'}</button><button className="admin-action-button" type="button" onClick={()=>remove(item)}>Arquivar</button></div></td></tr>):<EmptyRow columns={5}/>}</tbody></table></div></section></>
}
