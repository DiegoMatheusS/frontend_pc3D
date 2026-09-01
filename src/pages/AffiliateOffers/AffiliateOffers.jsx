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

function normalizeCheckStatus(value) {
  const status = String(value || '').trim().toUpperCase()
  if (status === 'ATUALIZADA') return 'ATUALIZADO'
  if (status === 'FALHOU' || status === 'FALHA') return 'ERRO'
  return status || 'VERIFICADA'
}

function checkValues(result = {}) {
  return {
    status: normalizeCheckStatus(result.status),
    saved: result.precoAnteriorBanco ?? result.precoSalvo ?? result.precoAnterior ?? null,
    found: result.precoEncontrado ?? result.precoAtual ?? result.novoPreco ?? null,
    previousFound: result.precoAnteriorEncontrado ?? result.precoAnteriorColetado ?? null,
    variation: result.variacaoPercentual ?? result.variacao ?? null,
    source: result.fontePreco ?? result.origemPreco ?? result.fonte ?? '',
    verifiedAt: result.verificadoEm ?? result.dataUltimaVerificacao ?? result.atualizadoEm ?? null,
    url: result.urlFinal ?? result.urlConsultada ?? result.urlOriginal ?? '',
  }
}

function formatVariation(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return `${number > 0 ? '+' : ''}${number.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
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
            <p>Produtos com Oferta ativa aparecem aqui. A verificação de preço usa a URL disponível na Oferta e o backend decide se o valor é seguro para atualizar.</p>
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
                  {priceCheckResult.verificadas ?? 0} verificadas · {priceCheckResult.atualizadas ?? 0} atualizadas · {priceCheckResult.semAlteracao ?? 0} sem alteração · {priceCheckResult.revisar ?? priceCheckResult.revisaoNecessaria ?? 0} revisar · {priceCheckResult.bloqueadas ?? priceCheckResult.bloqueados ?? 0} bloqueadas · {priceCheckResult.erros ?? priceCheckResult.falharam ?? 0} erros
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

        {Array.isArray(priceCheckResult?.resultados) && priceCheckResult.resultados.length > 0 && (
          <div className="affiliate-offers-check-table-wrap">
            <table className="affiliate-offers-check-table">
              <thead><tr><th>Produto</th><th>Preço banco</th><th>Encontrado</th><th>Preço anterior</th><th>Variação</th><th>Fonte</th><th>Status</th><th>Última verificação</th><th>Diagnóstico</th></tr></thead>
              <tbody>{priceCheckResult.resultados.map((result) => {
                const values = checkValues(result)
                return <tr key={`${result.ofertaId}-${values.status}`} className={`is-${values.status.toLowerCase()}`}>
                  <td><strong>{result.produtoNome || result.produto || `Oferta #${result.ofertaId}`}</strong><small>Oferta #{result.ofertaId}</small></td>
                  <td>{values.saved == null ? '—' : formatMoney(values.saved)}</td>
                  <td>{values.found == null ? '—' : <strong>{formatMoney(values.found)}</strong>}</td>
                  <td>{values.previousFound == null ? '—' : formatMoney(values.previousFound)}</td>
                  <td>{formatVariation(values.variation)}</td>
                  <td>{values.source || '—'}</td>
                  <td><span className={`affiliate-offers-check-status is-${values.status.toLowerCase()}`}>{values.status.replaceAll('_', ' ')}</span></td>
                  <td>{formatUpdated(values.verifiedAt)}</td>
                  <td><div className="affiliate-offers-check-detail"><span>{result.motivo || result.detalhe || result.mensagem || (values.status === 'ATUALIZADO' ? 'Preço confirmado e salvo.' : values.status === 'SEM_ALTERACAO' ? 'Sem alteração.' : '—')}</span>{result.produtoIaUtilizada === true && <small>Projeto IA utilizada</small>}{values.url && <a href={values.url} target="_blank" rel="noopener noreferrer">Abrir link ↗</a>}</div></td>
                </tr>
              })}</tbody>
            </table>
          </div>
        )}

        {error && <div className="affiliate-offers-alert" role="alert"><strong>Não foi possível concluir a operação.</strong><span>{error}</span></div>}

        {loading ? (
          <div className="affiliate-offers-state" role="status">Carregando ofertas...</div>
        ) : filteredOffers.length === 0 ? (
          <div className="affiliate-offers-state">
            <strong>Nenhuma oferta afiliada encontrada.</strong>
            <span>Cadastre uma Oferta ativa no Produto para ela aparecer aqui. Para verificar preço, a Oferta precisa ter URL original ou URL afiliada.</span>
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

        <p className="affiliate-offers-note">Esta página não faz scraping no navegador. A verificação é solicitada ao backend do CriaByte, que usa a URL original e, quando necessário, a URL afiliada como fallback.</p>
      </div>
    </section>
  )
}
