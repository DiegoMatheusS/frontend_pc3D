import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminBack, AdminError, AdminLoading, AdminPageHeader, formatDate, formatMoney } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

function labelCategory(value) {
  return String(value || '—').replaceAll('_', ' ')
}

function statusClass(status) {
  if (status === 'APROVADA') return 'status-sucesso'
  if (status === 'REJEITADA') return 'status-erro'
  return 'status-aguardando-revisao'
}

function statusLabel(status) {
  return ({ EM_ANALISE: 'EM ANÁLISE', APROVADA: 'APROVADA', REJEITADA: 'REJEITADA' })[status] || status
}

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/$/, '').toLowerCase()
}

export default function AdminOfferSuggestionDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useAdminToast()
  const returnedProductId = searchParams.get('produtoId')
  const returnedOfferId = searchParams.get('ofertaId')

  const [item, setItem] = useState(null)
  const [products, setProducts] = useState([])
  const [offers, setOffers] = useState([])
  const [productId, setProductId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [suggestion, productItems, offerItems] = await Promise.all([
        adminService.offerSuggestions.get(id),
        adminService.products.list(),
        adminService.offers.list().catch(() => []),
      ])
      setItem(suggestion)
      setProducts(productItems)
      setOffers(offerItems)
      setProductId(String(returnedProductId || suggestion.produto?.id || suggestion.produtoId || ''))
    } catch (err) {
      setError(err)
    }
  }, [id, returnedProductId])

  useEffect(() => {
    const timer = window.setTimeout(() => { load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase('pt-BR')
    return [...products].filter((product) => {
      if (!term) return true
      return [product.id, product.nome, product.marca, product.modelo, product.categoria?.nome, product.hardware?.categoria]
        .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(term)
    }).slice(0, 100)
  }, [products, productSearch])

  const selectedProduct = useMemo(() => products.find((product) => Number(product.id) === Number(productId)) || null, [products, productId])

  const existingOffer = useMemo(() => {
    if (!item) return null
    const explicitId = returnedOfferId || item.ofertaId
    if (explicitId) {
      const byId = offers.find((offer) => Number(offer.id) === Number(explicitId))
      if (byId) return byId
    }
    const originalUrl = normalizeUrl(item.urlOriginal)
    return offers.find((offer) => {
      const sameProduct = Number(offer.produtoId || offer.produto?.id) === Number(productId)
      const sameUrl = normalizeUrl(offer.urlOriginal) === originalUrl
      return sameProduct && sameUrl
    }) || null
  }, [item, offers, productId, returnedOfferId])

  function selectProduct(value) {
    setProductId(String(value || ''))
    setError(null)
  }

  function createOfferFromSuggestion() {
    if (!productId) {
      setError(new Error('Selecione o Produto antes de criar a Oferta.'))
      return
    }
    try { sessionStorage.setItem('criabyteSugestaoOfertaOferta', JSON.stringify(item)) } catch { /* armazenamento opcional */ }
    navigate(`/admin/ofertas/novo?origem=sugestao-oferta&sugestaoId=${encodeURIComponent(item.id)}&produtoId=${encodeURIComponent(productId)}`)
  }

  async function acceptExistingOffer() {
    if (!productId) {
      setError(new Error('Selecione o Produto vinculado a esta sugestão.'))
      return
    }

    setBusy('accept')
    setError(null)
    try {
      const result = await adminService.offerSuggestions.acceptExisting(id, {
        produtoId: Number(productId),
      })
      const acceptedOffer = result?.oferta || existingOffer || null
      setItem(result?.sugestao || result)
      toast.show(acceptedOffer?.id
        ? `Oferta #${acceptedOffer.id} aceita. Sugestão marcada como APROVADA.`
        : 'Oferta aceita. Sugestão marcada como APROVADA.', 'sucesso')
      await load()
    } catch (err) {
      setError(err)
      toast.show(err?.message || 'Não foi possível aceitar a Oferta existente.', 'erro')
    } finally {
      setBusy('')
    }
  }

  async function reject(event) {
    event.preventDefault()
    if (rejectReason.trim().length < 3) {
      setError(new Error('Informe o motivo da rejeição.'))
      return
    }
    setBusy('reject')
    setError(null)
    try {
      const result = await adminService.offerSuggestions.reject(id, rejectReason.trim())
      setItem(result)
      toast.show('Sugestão rejeitada.')
      setRejectReason('')
    } catch (err) {
      setError(err)
      toast.show(err?.message || 'Não foi possível rejeitar a sugestão.', 'erro')
    } finally {
      setBusy('')
    }
  }

  function createProductFromSuggestion() {
    try { sessionStorage.setItem('criabyteSugestaoOfertaProduto', JSON.stringify(item)) } catch { /* armazenamento opcional */ }
    navigate(`/admin/produtos/novo?origem=sugestao-oferta&sugestaoId=${encodeURIComponent(item.id)}`)
  }

  if (error && !item) return <AdminError error={error} />
  if (!item) return <AdminLoading />

  const pending = item.status === 'EM_ANALISE'
  const specEntries = Object.entries(item.especificacoes || {})

  return <>
    <AdminPageHeader title={`Sugestão #${item.id}`} description="Confira o anúncio, identifique o Produto correto e conclua a sugestão sem duplicar Ofertas.">
      <AdminBack to="/admin/sugestoes-ofertas">Voltar à fila</AdminBack>
    </AdminPageHeader>

    {returnedOfferId && pending && <div className="admin-suggestion-return-banner"><strong>Oferta criada.</strong><span>A Oferta #{returnedOfferId} já existe. Agora clique em “Aceitar Oferta” para apenas concluir a sugestão.</span></div>}
    {returnedProductId && !returnedOfferId && pending && <div className="admin-suggestion-return-banner"><strong>Produto criado.</strong><span>O Produto #{returnedProductId} já foi selecionado. Se ainda não houver Oferta, use “Criar oferta”.</span></div>}

    <div className="admin-suggestion-detail-grid">
      <div className="admin-suggestion-detail-main">
        <section className="admin-card">
          <header className="admin-card-header"><div><h2>{item.nome}</h2><p>Enviada por {item.usuario?.nome || 'usuário'} · {formatDate(item.criadoEm)}</p></div><span className={`admin-status ${statusClass(item.status)}`}>{statusLabel(item.status)}</span></header>
          <div className="admin-card-body admin-suggestion-summary">
            <div><span>Categoria</span><strong>{labelCategory(item.categoria)}</strong></div>
            <div><span>Preço enviado</span><strong>{formatMoney(item.preco)}</strong></div>
            <div><span>Preço anterior</span><strong>{item.precoAnterior ? formatMoney(item.precoAnterior) : '—'}</strong></div>
            <div><span>Parceiro detectado</span><strong>{item.parceiro?.nome || 'Não identificado'}</strong></div>
            <div className="full"><span>URL original</span><a href={item.urlOriginal} target="_blank" rel="noopener noreferrer">{item.urlOriginal} ↗</a></div>
            {item.observacao && <div className="full"><span>Observação do usuário</span><p>{item.observacao}</p></div>}
          </div>
        </section>

        <section className="admin-card">
          <header className="admin-card-header"><div><h2>Dados técnicos informados</h2><p>Servem para identificar a peça. A sugestão não cria Hardware automaticamente.</p></div><span className="admin-stat-icon">{specEntries.length}</span></header>
          <div className="admin-card-body">
            {specEntries.length ? <div className="admin-suggestion-spec-grid">{specEntries.map(([key, value]) => <div key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value)}</strong></div>)}</div> : <div className="admin-empty">Nenhuma especificação técnica foi enviada.</div>}
          </div>
        </section>

        {item.analise && <section className="admin-card">
          <header className="admin-card-header"><h2>Análise concluída</h2></header>
          <div className="admin-card-body admin-suggestion-analysis"><span>Analisada em {formatDate(item.analise.analisadoEm)} por {item.analise.analisadoPorNome || `usuário #${item.analise.analisadoPorId}`}</span>{item.analise.motivo && <p>{item.analise.motivo}</p>}{item.ofertaId && <Link className="btn btn-secundario" to={`/admin/ofertas/${item.ofertaId}`}>Abrir Oferta #{item.ofertaId}</Link>}</div>
        </section>}
      </div>

      <aside className="admin-suggestion-detail-side">
        {pending ? <>
          <section className="admin-card admin-suggestion-actions-card">
            <header className="admin-card-header"><div><h2>Ações da sugestão</h2><p>“Criar oferta” cadastra os dados comerciais. “Aceitar Oferta” apenas vincula a Oferta já cadastrada e conclui a sugestão.</p></div></header>
            <div className="admin-card-body admin-suggestion-primary-actions">
              <button className="btn btn-secundario" type="button" onClick={createOfferFromSuggestion} disabled={Boolean(busy)}>Criar oferta</button>
              <button className="btn btn-primario" type="button" onClick={acceptExistingOffer} disabled={Boolean(busy)}>{busy === 'accept' ? 'Aceitando...' : 'Aceitar Oferta'}</button>
            </div>
            {existingOffer && <div className="admin-card-body"><div className="admin-suggestion-selected-product"><span>Oferta já cadastrada</span><strong>#{existingOffer.id} · {existingOffer.produto?.nome || selectedProduct?.nome || item.nome}</strong><small>{formatMoney(existingOffer.precoAtual ?? existingOffer.preco)}</small></div></div>}
            {error && <div className="admin-card-body"><p className="admin-form-error">{error.message}</p></div>}
          </section>

          <section className="admin-card">
            <header className="admin-card-header"><div><h2>Vincular a Produto</h2><p>Escolha o Produto que corresponde à sugestão.</p></div></header>
            <div className="admin-card-body admin-suggestion-product-picker">
              <label className="admin-field"><span>Pesquisar Produto</span><input className="admin-input" type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Digite nome, marca, modelo ou ID" autoComplete="off" /></label>
              {productSearch.trim() ? <div className="admin-suggestion-product-results" role="listbox" aria-label="Resultados da pesquisa de Produtos">
                {filteredProducts.length ? filteredProducts.slice(0, 12).map((product) => <button
                  key={product.id}
                  className={`admin-suggestion-product-result${Number(productId) === Number(product.id) ? ' is-selected' : ''}`}
                  type="button"
                  role="option"
                  aria-selected={Number(productId) === Number(product.id)}
                  onClick={() => { selectProduct(product.id); setProductSearch('') }}
                >
                  {product.imagemUrl ? <img src={product.imagemUrl} alt="" loading="lazy" /> : <span className="admin-suggestion-product-result__image">#</span>}
                  <span className="admin-suggestion-product-result__content"><strong>{product.nome || `Produto #${product.id}`}</strong><small>#{product.id}{product.marca ? ` · ${product.marca}` : ''}{product.modelo ? ` · ${product.modelo}` : ''}</small></span>
                  <span className="admin-suggestion-product-result__category">{product.categoria?.nome || labelCategory(product.hardware?.categoria) || 'Produto'}</span>
                </button>) : <div className="admin-suggestion-product-results__empty">Nenhum Produto encontrado para “{productSearch.trim()}”.</div>}
              </div> : <small className="admin-help">Digite para ver os Produtos correspondentes logo abaixo.</small>}
              <label className="admin-field"><span>Produto selecionado *</span><select className="admin-select" value={productId} onChange={(event) => selectProduct(event.target.value)}><option value="">Selecione</option>{products.map((product) => <option key={product.id} value={product.id}>#{product.id} · {product.nome}</option>)}</select></label>
              {selectedProduct && <div className="admin-suggestion-selected-product"><span>Vinculado a</span><strong>#{selectedProduct.id} · {selectedProduct.nome}</strong>{(selectedProduct.marca || selectedProduct.modelo) && <small>{[selectedProduct.marca, selectedProduct.modelo].filter(Boolean).join(' · ')}</small>}</div>}
              <div className="admin-suggestion-or"><span>Produto não existe?</span></div>
              <button className="btn btn-secundario btn-pequeno" type="button" onClick={createProductFromSuggestion}>Cadastrar Produto usando a sugestão</button>
            </div>
          </section>

          <form className="admin-card admin-suggestion-reject-card" onSubmit={reject}>
            <header className="admin-card-header"><h2>Rejeitar sugestão</h2></header>
            <div className="admin-card-body"><label className="admin-field"><span>Motivo *</span><textarea className="admin-textarea admin-textarea--compact" required minLength="3" maxLength="1000" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Explique por que a oferta não foi aprovada." /></label><button className="btn btn-perigo" type="submit" disabled={Boolean(busy)}>{busy === 'reject' ? 'Rejeitando...' : 'Rejeitar'}</button></div>
          </form>
        </> : <section className="admin-card"><div className="admin-card-body"><p className="admin-muted">Esta sugestão já foi analisada e não pode ser processada novamente.</p></div></section>}
      </aside>
    </div>
  </>
}
