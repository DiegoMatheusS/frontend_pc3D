import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOfferCreatorName } from '../../utils/offerCreator'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, AdminStatus, EmptyRow, formatDate, formatMoney } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { useAdminPermissions } from '../components/AdminAccess'

export default function AdminOffers() {
  const toast = useAdminToast()
  const { canWriteCatalog, canDeleteCatalog, isAdmin } = useAdminPermissions()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [status, setStatus] = useState('')
  const [checkingPrices, setCheckingPrices] = useState(false)
  const [priceReport, setPriceReport] = useState(() => {
    try {
      const saved = sessionStorage.getItem('criabyteUltimoRelatorioPrecos')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [reportOpen, setReportOpen] = useState(false)

  const fetchData = useCallback(async () => {
    const suggestionsRequest = isAdmin
      ? adminService.offerSuggestions.list().catch(() => ({ sugestoes: [] }))
      : Promise.resolve({ sugestoes: [] })
    const auditRequest = isAdmin
      ? adminService.audit.list({ acao: 'OFERTA_CRIADA', entidade: 'Oferta', porPagina: 200 }).catch(() => [])
      : Promise.resolve([])

    const [offers, partners, products, hardwares, suggestionsPayload, auditLogs] = await Promise.all([
      adminService.offers.list(),
      adminService.offers.partners(),
      adminService.products.list().catch(() => []),
      adminService.hardwares.list().catch(() => []),
      suggestionsRequest,
      auditRequest,
    ])

    const suggestions = Array.isArray(suggestionsPayload)
      ? suggestionsPayload
      : Array.isArray(suggestionsPayload?.sugestoes)
        ? suggestionsPayload.sugestoes
        : []

    return { offers, partners, products, hardwares, suggestions, auditLogs }
  }, [isAdmin])

  const load = useCallback(async () => {
    const nextData = await fetchData()
    setData(nextData)
    setError(null)
  }, [fetchData])

  useEffect(() => {
    let active = true
    fetchData()
      .then((nextData) => {
        if (!active) return
        setData(nextData)
        setError(null)
      })
      .catch((err) => {
        if (active) setError(err)
      })
    return () => { active = false }
  }, [fetchData])

  const itemsMap = useMemo(() => {
    const map = new Map()
    ;(data?.products || []).forEach((item) => map.set(`p-${item.id}`, item))
    ;(data?.hardwares || []).forEach((item) => map.set(`h-${item.id}`, item))
    return map
  }, [data])

  const partnersMap = useMemo(() => new Map((data?.partners || []).map((item) => [Number(item.id), item.nome])), [data])

  const suggestionCreatorMap = useMemo(() => {
    const byOfferId = new Map()
    const byUrl = new Map()
    ;(data?.suggestions || []).forEach((suggestion) => {
      const offerId = Number(suggestion?.ofertaId)
      const name = suggestion?.usuario?.nome || suggestion?.usuarioNome || null
      const url = String(suggestion?.urlOriginal || '').trim().toLowerCase()
      if (offerId > 0 && name) byOfferId.set(offerId, name)
      if (url && name && !byUrl.has(url)) byUrl.set(url, name)
    })
    return { byOfferId, byUrl }
  }, [data])

  const auditCreatorMap = useMemo(() => {
    const map = new Map()
    ;(data?.auditLogs || []).forEach((log) => {
      const offerId = Number(log?.entidadeId)
      const name = log?.usuario?.nome || log?.usuario?.email || null
      if (offerId > 0 && name && !map.has(offerId)) map.set(offerId, name)
    })
    return map
  }, [data])

  const creatorName = useCallback((item) => {
    const url = String(item?.urlOriginal || '').trim().toLowerCase()
    return suggestionCreatorMap.byOfferId.get(Number(item?.id)) || (url ? suggestionCreatorMap.byUrl.get(url) : null) || getOfferCreatorName(item) || auditCreatorMap.get(Number(item?.id)) || null
  }, [auditCreatorMap, suggestionCreatorMap])

  const isCommunityOffer = useCallback((item) => {
    const url = String(item?.urlOriginal || '').trim().toLowerCase()
    return suggestionCreatorMap.byOfferId.has(Number(item?.id)) || Boolean(url && suggestionCreatorMap.byUrl.has(url))
  }, [suggestionCreatorMap])

  const filtered = useMemo(() => (data?.offers || []).filter((item) => {
    const target = item.produtoId ? itemsMap.get(`p-${item.produtoId}`) : itemsMap.get(`h-${item.hardwareId}`)
    const creator = creatorName(item)
    const searchable = [target?.nome, target?.marca, target?.modelo, item.vendedorNome, partnersMap.get(Number(item.parceiroId)), item.urlOriginal, creator].join(' ').toLowerCase()
    return (!search || searchable.includes(search.toLowerCase()))
      && (!partnerId || Number(item.parceiroId) === Number(partnerId))
      && (!status || String(item.status || '').toUpperCase() === status)
  }), [creatorName, data, itemsMap, partnerId, partnersMap, search, status])

  const offerStatus = (item) => String(item?.status || 'ATIVA').toUpperCase()

  async function remove(item) {
    if (!window.confirm('Descontinuar esta oferta? Ela continuará no histórico, mas deixará de ficar ativa.')) return
    try {
      await adminService.offers.remove(item.id)
      setData((current) => current ? {
        ...current,
        offers: (current.offers || []).map((entry) => entry.id === item.id ? { ...entry, status: 'DESCONTINUADA' } : entry),
      } : current)
      toast.show('Oferta descontinuada.')
      await load()
    } catch (err) {
      toast.show(err.message, 'erro')
    }
  }

  async function reactivate(item) {
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
    } catch (err) {
      toast.show(err.message, 'erro')
    }
  }

  async function verifyPrices() {
    setCheckingPrices(true)
    try {
      const result = await adminService.offers.verifyPrices(50)
      setPriceReport(result)
      setReportOpen(true)
      try { sessionStorage.setItem('criabyteUltimoRelatorioPrecos', JSON.stringify(result)) } catch { /* opcional */ }
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

  if (error) return <AdminError error={error} />
  if (!data) return <AdminLoading />

  return <>
    <AdminPageHeader title="Ofertas afiliadas" description="Gerencie múltiplas ofertas por Produto, com parceiro, preço e link afiliado independentes.">
      {priceReport && <button className="btn btn-secundario" type="button" onClick={() => setReportOpen((current) => !current)}>{reportOpen ? 'Fechar relatório' : 'Relatório'}</button>}
      {canWriteCatalog && <button className="btn btn-secundario" type="button" onClick={verifyPrices} disabled={checkingPrices}>{checkingPrices ? 'Verificando preços...' : 'Verificar preços'}</button>}
      {canWriteCatalog && <Link className="btn btn-primario" to="/admin/ofertas/novo">+ Nova oferta</Link>}
    </AdminPageHeader>

    {reportOpen && priceReport && <section className="admin-price-report admin-card">
      <header className="admin-card-header"><div><h2>Relatório da verificação de preços</h2><p>Veja exatamente quais ofertas mudaram e quais não puderam ser verificadas.</p></div><button className="admin-action-button" type="button" onClick={() => setReportOpen(false)}>Fechar</button></header>
      <div className="admin-card-body">
        <div className="admin-price-report-summary">
          <span><strong>{priceReport.verificadas ?? 0}</strong> verificadas</span>
          <span><strong>{priceReport.atualizadas ?? 0}</strong> atualizadas</span>
          <span><strong>{priceReport.semAlteracao ?? 0}</strong> sem alteração</span>
          <span><strong>{priceReport.indisponiveis ?? 0}</strong> indisponíveis</span>
          <span><strong>{priceReport.falharam ?? 0}</strong> falharam</span>
        </div>
        {Array.isArray(priceReport.resultados) && priceReport.resultados.length ? <div className="admin-table-wrap"><table className="admin-table admin-price-report-table"><thead><tr><th>Produto</th><th>Parceiro</th><th>Resultado</th><th>Preço anterior</th><th>Preço novo</th><th>Detalhe</th></tr></thead><tbody>{priceReport.resultados.map((result) => <tr key={`${result.ofertaId}-${result.status}`} className={result.status === 'ATUALIZADA' ? 'admin-price-report-row--changed' : ''}><td><strong>{result.produto || `Oferta #${result.ofertaId}`}</strong><br /><small>Oferta #{result.ofertaId}</small></td><td>{result.parceiro || '—'}</td><td><AdminStatus value={result.status} /></td><td>{result.precoAnterior == null ? '—' : formatMoney(result.precoAnterior)}</td><td>{result.precoAtual == null ? '—' : <strong>{formatMoney(result.precoAtual)}</strong>}</td><td>{result.status === 'ATUALIZADA' ? <strong className="admin-price-change">{formatMoney(result.precoAnterior)} → {formatMoney(result.precoAtual)}</strong> : (result.motivo || result.origemPreco || '—')}</td></tr>)}</tbody></table></div> : <div className="admin-empty">O backend não retornou itens detalhados para este lote.</div>}
      </div>
    </section>}

    <section className="admin-toolbar admin-toolbar--3">
      <label className="admin-toolbar-field"><span>Pesquisar</span><input className="admin-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Produto, loja, vendedor ou usuário" /></label>
      <label className="admin-toolbar-field"><span>Parceiro</span><select className="admin-select" value={partnerId} onChange={(event) => setPartnerId(event.target.value)}><option value="">Todos</option>{data.partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.nome}</option>)}</select></label>
      <label className="admin-toolbar-field"><span>Status</span><select className="admin-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option>ATIVA</option><option>INDISPONIVEL</option><option>DESCONTINUADA</option></select></label>
    </section>

    <section className="admin-table-card mobile-cards">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Item</th><th>Parceiro</th><th>Cadastrado por</th><th>Preço</th><th>Frete</th><th>Status</th><th>Validade</th><th>Ações</th></tr></thead>
          <tbody>
            {filtered.length ? filtered.map((item) => {
              const target = item.produtoId ? itemsMap.get(`p-${item.produtoId}`) : itemsMap.get(`h-${item.hardwareId}`)
              const creator = creatorName(item)
              return <tr key={item.id}>
                <td data-label="Item"><div className="admin-product-cell"><img className="admin-product-thumb" src={target?.imagemUrl || '/admin-assets/placeholder-produto.svg'} alt="" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} /><span><strong>{target?.nome || `Oferta #${item.id}`}</strong><small>{item.vendedorNome || item.vendedorIdentificador || target?.modelo || ''}</small></span></div></td>
                <td data-label="Parceiro">{partnersMap.get(Number(item.parceiroId)) || '—'}</td>
                <td data-label="Cadastrado por"><strong>{creator || '—'}</strong>{creator && <><br /><small>{isCommunityOffer(item) ? 'Comunidade' : auditCreatorMap.has(Number(item.id)) ? 'Admin' : ''}</small></>}</td>
                <td data-label="Preço"><strong>{formatMoney(item.preco)}</strong>{item.precoAnterior && <><br /><small>antes {formatMoney(item.precoAnterior)}</small></>}</td>
                <td data-label="Frete">{item.frete != null ? formatMoney(item.frete) : '—'}</td>
                <td data-label="Status"><AdminStatus value={item.status || 'ATIVA'} /></td>
                <td data-label="Validade">{formatDate(item.validoAte)}</td>
                <td data-label="Ações"><div className="admin-row-actions">{canWriteCatalog && <Link className="admin-action-button" to={`/admin/ofertas/${item.id}`}>Editar</Link>}{canWriteCatalog && offerStatus(item) !== 'ATIVA' && <button className="admin-action-button admin-action-button--success" type="button" onClick={() => reactivate(item)}>Reativar</button>}{canDeleteCatalog && offerStatus(item) !== 'DESCONTINUADA' && <button className="admin-action-button" type="button" onClick={() => remove(item)}>Descontinuar</button>}{!canWriteCatalog && !canDeleteCatalog && <span className="admin-muted">Somente leitura</span>}</div></td>
              </tr>
            }) : <EmptyRow columns={8} />}
          </tbody>
        </table>
      </div>
      <div className="admin-filter-summary"><span>{filtered.length} oferta(s) exibida(s)</span><span>{(data.offers || []).filter((item) => offerStatus(item) === 'ATIVA').length} ativa(s) · {(data.offers || []).filter((item) => offerStatus(item) === 'DESCONTINUADA').length} descontinuada(s)</span></div>
    </section>
  </>
}
