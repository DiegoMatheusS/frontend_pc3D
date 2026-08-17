import { useEffect, useMemo, useState } from 'react'
import { atualizarBuscaOfertas, listarBuscaOfertas, statusVerificacaoPrecos, verificarPrecosOfertas } from '../../services/affiliateOffersService'
import { getOfferCreatorName } from '../../utils/offerCreator'
import './AffiliateOffers.css'

const TAGS = [
  ['TODOS', 'Todos'],
  ['PLACA_VIDEO', 'Placa de vídeo'],
  ['PROCESSADOR', 'Processador'],
  ['PLACA_MAE', 'Placa-mãe'],
  ['MEMORIA_RAM', 'Memória RAM'],
  ['SSD', 'SSD'],
  ['FONTE', 'Fonte'],
  ['GABINETE', 'Gabinete'],
  ['MONITOR', 'Monitor'],
  ['NOTEBOOK', 'Notebook'],
  ['PERIFERICOS', 'Periféricos'],
  ['OUTROS', 'Outros'],
]

const TAG_LABELS = Object.fromEntries(TAGS)
const DISCOUNTS = [0, 10, 20, 30, 40]
const SORTS = [
  ['MAIOR_DESCONTO', 'Maior desconto'],
  ['MENOR_PRECO', 'Menor preço'],
  ['MAIOR_PRECO', 'Maior preço'],
  ['MAIS_RECENTES', 'Mais recentes'],
]

function asNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}

function formatUpdated(value) {
  if (!value) return 'Ainda não atualizado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Horário indisponível'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function AffiliateOffers() {
  const [offers, setOffers] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('TODOS')
  const [discount, setDiscount] = useState(0)
  const [sort, setSort] = useState('MAIOR_DESCONTO')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [checkingPrices, setCheckingPrices] = useState(false)
  const [priceCheckStatus, setPriceCheckStatus] = useState(null)
  const [priceCheckResult, setPriceCheckResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listarBuscaOfertas()
      .then((payload) => {
        if (!active) return
        setOffers(Array.isArray(payload?.ofertas) ? payload.ofertas : [])
        setLastUpdated(payload?.ultimaAtualizacao || null)
        setError('')
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError?.message || 'Não foi possível carregar as ofertas afiliadas do CriaByte.')
        setOffers([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    statusVerificacaoPrecos()
      .then((payload) => {
        if (active) setPriceCheckStatus(payload || null)
      })
      .catch(() => {
        if (active) setPriceCheckStatus(null)
      })
    return () => { active = false }
  }, [])

  const filteredOffers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const result = offers.filter((offer) => {
      if (tag !== 'TODOS' && offer?.tag !== tag) return false
      if (discount > 0 && (offer?.descontoPercentual == null || asNumber(offer.descontoPercentual, -1) < discount)) return false
      if (term) {
        const haystack = `${offer?.nome || ''} ${offer?.descricao || ''} ${offer?.parceiro?.nome || ''}`.toLocaleLowerCase('pt-BR')
        if (!haystack.includes(term)) return false
      }
      return true
    })

    return [...result].sort((a, b) => {
      if (sort === 'MENOR_PRECO') return asNumber(a.precoAtual) - asNumber(b.precoAtual)
      if (sort === 'MAIOR_PRECO') return asNumber(b.precoAtual) - asNumber(a.precoAtual)
      if (sort === 'MAIS_RECENTES') return String(b.atualizadoEm || '').localeCompare(String(a.atualizadoEm || ''))
      return asNumber(b.descontoPercentual, -1) - asNumber(a.descontoPercentual, -1)
    })
  }, [discount, offers, search, sort, tag])

  async function handleRefresh() {
    setRefreshing(true)
    setError('')
    try {
      const payload = await atualizarBuscaOfertas()
      setOffers(Array.isArray(payload?.ofertas) ? payload.ofertas : [])
      setLastUpdated(payload?.ultimaAtualizacao || new Date().toISOString())
    } catch (requestError) {
      setError(requestError?.message || 'Não foi possível reler as ofertas do CriaByte.')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleVerifyPrices() {
    setCheckingPrices(true)
    setPriceCheckResult(null)
    setError('')
    try {
      const result = await verificarPrecosOfertas(50)
      setPriceCheckResult(result || null)

      const [offersPayload, statusPayload] = await Promise.all([
        listarBuscaOfertas(),
        statusVerificacaoPrecos().catch(() => null),
      ])

      setOffers(Array.isArray(offersPayload?.ofertas) ? offersPayload.ofertas : [])
      setLastUpdated(offersPayload?.ultimaAtualizacao || new Date().toISOString())
      if (statusPayload) setPriceCheckStatus(statusPayload)
    } catch (requestError) {
      setError(requestError?.message || 'Não foi possível verificar os preços das ofertas.')
    } finally {
      setCheckingPrices(false)
    }
  }

  return (
    <section className="affiliate-offers-page">
      <div className="page-container">
        <header className="affiliate-offers-heading">
          <div>
            <span className="eyebrow">Ferramenta interna</span>
            <h1>Busca de Ofertas</h1>
            <p>Produtos com Oferta ativa e link afiliado cadastrado aparecem aqui automaticamente.</p>
          </div>
          <div className="affiliate-offers-source" aria-label="Fonte dos dados">
            <span>Fonte</span>
            <strong>CriaByte</strong>
          </div>
        </header>

        <section className="affiliate-offers-toolbar" aria-label="Filtros da busca de ofertas">
          <label className="affiliate-offers-search">
            <span className="sr-only">Pesquisar produto</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar produto..." maxLength={120} />
          </label>

          <label><span>Categoria</span><select value={tag} onChange={(event) => setTag(event.target.value)}>{TAGS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Desconto mínimo</span><select value={discount} onChange={(event) => setDiscount(Number(event.target.value))}>{DISCOUNTS.map((value) => <option key={value} value={value}>{value === 0 ? 'Todos' : `${value}% ou mais`}</option>)}</select></label>
          <label><span>Ordenar</span><select value={sort} onChange={(event) => setSort(event.target.value)}>{SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>

          <button className="button button--secondary affiliate-offers-refresh" type="button" onClick={handleRefresh} disabled={refreshing || checkingPrices}>
            {refreshing ? 'Atualizando...' : 'Atualizar lista'}
          </button>

          <button className="button button--primary affiliate-offers-refresh" type="button" onClick={handleVerifyPrices} disabled={checkingPrices || refreshing}>
            {checkingPrices ? 'Verificando preços...' : 'Verificar preços'}
          </button>
        </section>

        <div className="affiliate-offers-meta" aria-live="polite">
          <strong>{filteredOffers.length} {filteredOffers.length === 1 ? 'oferta encontrada' : 'ofertas encontradas'}</strong>
          <span>Última atualização: {formatUpdated(lastUpdated)}</span>
        </div>

        {(priceCheckStatus || priceCheckResult) && (
          <div className="affiliate-offers-price-check" aria-live="polite">
            {priceCheckResult ? (
              <>
                <strong>Verificação concluída</strong>
                <span>
                  {priceCheckResult.verificadas ?? 0} verificadas · {priceCheckResult.atualizadas ?? 0} atualizadas · {priceCheckResult.semAlteracao ?? 0} sem alteração · {priceCheckResult.indisponiveis ?? 0} indisponíveis · {priceCheckResult.falharam ?? 0} falharam
                </span>
                {Number(priceCheckResult.restantesElegiveis) > 0 && <small>{priceCheckResult.restantesElegiveis} oferta(s) ainda aguardam outro lote de verificação.</small>}
              </>
            ) : (
              <>
                <strong>Verificação de preços</strong>
                <span>{priceCheckStatus?.elegiveis ?? 0} oferta(s) elegíveis · {priceCheckStatus?.nuncaVerificadas ?? 0} nunca verificadas · {priceCheckStatus?.desatualizadasMaisDe24h ?? 0} há mais de 24h</span>
                <small>Última verificação: {formatUpdated(priceCheckStatus?.ultimaVerificacaoEm)}</small>
              </>
            )}
          </div>
        )}

        {error && <div className="affiliate-offers-alert" role="alert"><strong>Não foi possível concluir a operação.</strong><span>{error}</span></div>}

        {loading ? (
          <div className="affiliate-offers-state" role="status">Carregando ofertas...</div>
        ) : filteredOffers.length === 0 ? (
          <div className="affiliate-offers-state">
            <strong>Nenhuma oferta afiliada encontrada.</strong>
            <span>Cadastre uma Oferta ativa com URL afiliada no Produto para ela aparecer aqui.</span>
          </div>
        ) : (
          <div className="affiliate-offers-table-wrap">
            <table className="affiliate-offers-table">
              <thead><tr><th>Nome</th><th>Tag</th><th>Descrição</th><th>Valor</th><th>Desconto</th></tr></thead>
              <tbody>
                {filteredOffers.map((offer) => (
                  <tr key={offer.id}>
                    <td data-label="Nome"><div className="affiliate-offers-product">{offer.imagemUrl ? <img src={offer.imagemUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <span className="affiliate-offers-product-placeholder" aria-hidden="true">{String(offer.tag || 'OF').slice(0, 2)}</span>}<span><a href={offer.url} target="_blank" rel="noreferrer noopener">{offer.nome}</a>{offer.parceiro?.nome && <small>{offer.parceiro.nome}</small>}{getOfferCreatorName(offer) && <small>Cadastrado por {getOfferCreatorName(offer)}</small>}</span></div></td>
                    <td data-label="Tag"><span className="affiliate-offers-tag">{TAG_LABELS[offer.tag] || 'Outros'}</span></td>
                    <td data-label="Descrição" className="affiliate-offers-description">{offer.descricao || '—'}</td>
                    <td data-label="Valor" className="affiliate-offers-price"><strong>{formatMoney(offer.precoAtual)}</strong>{Number(offer.precoAnterior) > Number(offer.precoAtual) && <del>{formatMoney(offer.precoAnterior)}</del>}</td>
                    <td data-label="Desconto">{offer.descontoPercentual == null ? <span>—</span> : <strong className="affiliate-offers-discount">{Math.round(asNumber(offer.descontoPercentual))}%</strong>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="affiliate-offers-note">Esta página não consulta API externa. Ela mostra somente Ofertas do próprio CriaByte que possuem URL afiliada.</p>
      </div>
    </section>
  )
}
