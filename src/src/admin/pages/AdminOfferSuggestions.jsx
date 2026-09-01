import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, EmptyRow, formatDate, formatMoney } from '../components/AdminCommon'

const STATUS_LABELS = {
  EM_ANALISE: 'Em análise',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
}

function statusClass(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'APROVADA') return 'status-sucesso'
  if (value === 'REJEITADA') return 'status-erro'
  return 'status-aguardando-revisao'
}

function labelCategory(value) {
  return String(value || '—').replaceAll('_', ' ')
}

export default function AdminOfferSuggestions() {
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('EM_ANALISE')
  const [category, setCategory] = useState('')
  const [fields, setFields] = useState(null)

  async function load(next = { status, category, search }) {
    setError(null)
    try {
      const [result, formSchema] = await Promise.all([
        adminService.offerSuggestions.list(next),
        adminService.offerSuggestions.fields().catch(() => null),
      ])
      setPayload(result)
      setFields(formSchema)
    } catch (err) {
      setError(err)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      adminService.offerSuggestions.list({ status: 'EM_ANALISE' }),
      adminService.offerSuggestions.fields().catch(() => null),
    ]).then(([result, formSchema]) => {
      if (!active) return
      setPayload(result)
      setFields(formSchema)
    }).catch((err) => { if (active) setError(err) })
    return () => { active = false }
  }, [])

  const categories = useMemo(() => fields?.categorias || [], [fields])

  function submitFilters(event) {
    event.preventDefault()
    load({ status, category, search })
  }

  function clearFilters() {
    setSearch('')
    setStatus('')
    setCategory('')
    load({ status: '', category: '', search: '' })
  }

  if (error && !payload) return <AdminError error={error} />
  if (!payload) return <AdminLoading />

  const items = Array.isArray(payload.sugestoes) ? payload.sugestoes : []

  return <>
    <AdminPageHeader title="Sugestões de ofertas" description="Ofertas enviadas por usuários. Nada é publicado antes da aprovação administrativa.">
      <span className="admin-suggestion-counter"><strong>{payload.emAnalise ?? items.filter((item) => item.status === 'EM_ANALISE').length}</strong> em análise</span>
    </AdminPageHeader>

    <form className="admin-toolbar admin-toolbar--suggestions" onSubmit={submitFilters}>
      <label className="admin-toolbar-field"><span>Pesquisar</span><input className="admin-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Produto, usuário ou URL" /></label>
      <label className="admin-toolbar-field"><span>Status</span><select className="admin-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="EM_ANALISE">Em análise</option><option value="APROVADA">Aprovada</option><option value="REJEITADA">Rejeitada</option></select></label>
      <label className="admin-toolbar-field"><span>Categoria</span><select className="admin-select" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas</option>{categories.map((item) => <option value={item.categoria} key={item.categoria}>{item.rotulo}</option>)}</select></label>
      <div className="admin-toolbar-actions"><button className="btn btn-primario" type="submit">Filtrar</button><button className="btn btn-secundario" type="button" onClick={clearFilters}>Limpar</button></div>
    </form>

    {error && <div className="admin-error-box">{error.message}</div>}

    <section className="admin-table-card mobile-cards">
      <div className="admin-table-wrap">
        <table className="admin-table admin-suggestions-table">
          <thead><tr><th>Sugestão</th><th>Usuário</th><th>Categoria</th><th>Preço</th><th>Status</th><th>Enviada em</th><th>Ação</th></tr></thead>
          <tbody>
            {items.length ? items.map((item) => <tr key={item.id}>
              <td data-label="Sugestão"><div className="admin-product-cell"><span className="admin-suggestion-avatar" aria-hidden="true">%</span><span><strong>{item.nome}</strong><small>#{item.id} · {item.parceiro?.nome || 'Parceiro não identificado'}</small></span></div></td>
              <td data-label="Usuário"><strong>{item.usuario?.nome || '—'}</strong><small className="admin-cell-subline">{item.usuario?.email || ''}</small></td>
              <td data-label="Categoria">{labelCategory(item.categoria)}</td>
              <td data-label="Preço"><strong>{formatMoney(item.preco)}</strong></td>
              <td data-label="Status"><span className={`admin-status ${statusClass(item.status)}`}>{STATUS_LABELS[item.status] || item.status}</span></td>
              <td data-label="Enviada em">{formatDate(item.criadoEm)}</td>
              <td data-label="Ação">{item.status === 'EM_ANALISE' ? <div className="admin-row-actions"><Link className="admin-action-button" to={`/admin/sugestoes-ofertas/${item.id}?acao=criar`}>Criar oferta</Link><Link className="admin-action-button admin-action-button--success" to={`/admin/sugestoes-ofertas/${item.id}?acao=aceitar`}>Aceitar Oferta</Link></div> : <Link className="admin-action-button" to={`/admin/sugestoes-ofertas/${item.id}`}>Ver detalhes</Link>}</td>
            </tr>) : <EmptyRow columns={7} text="Nenhuma sugestão encontrada para estes filtros." />}
          </tbody>
        </table>
      </div>
      <div className="admin-list-footer"><span>{payload.total ?? items.length} sugestão(ões) encontrada(s)</span></div>
    </section>
  </>
}
