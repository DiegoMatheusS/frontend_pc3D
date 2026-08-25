import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMountedPcById, getMountedPcBuilderPath } from '../../services/mountedPcsService'
import ReviewsPanel from '../../components/ReviewsPanel/ReviewsPanel'
import { asArray, asNumber, asText, formatCurrency, formatRating } from '../../utils/display'
import { setDocumentMeta } from '../../utils/pageMeta'
import './MountedPcDetails.css'

export default function MountedPcDetails() {
  const { id } = useParams()
  const [pc, setPc] = useState(undefined)

  useEffect(() => {
    let active = true
    getMountedPcById(id).then((value) => { if (active) setPc(value) }).catch(() => { if (active) setPc(null) })
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!pc) return
    setDocumentMeta({
      title: `${pc.name} — CriaByte`,
      description: pc.description || `Confira a configuração, avaliações e ofertas de ${pc.name}.`,
    })
  }, [pc])

  if (pc === undefined) {
    return <div className="page-container mounted-detail-state">Carregando PC...</div>
  }

  if (!pc) {
    return (
      <div className="page-container mounted-detail-state">
        <h1>PC não encontrado</h1>
        <Link className="button button--primary" to="/montados">Voltar para Montados</Link>
      </div>
    )
  }

  const builderPath = getMountedPcBuilderPath(pc)
  const purchaseSummary = pc.purchaseSummary || null
  const purchaseItems = asArray(purchaseSummary?.itens)

  const specs = [
    ['Processador', pc.cpu],
    ['TDP do processador', `${pc.cpuTdp} W`],
    ['Placa de vídeo', pc.gpu],
    ['TGP da GPU', pc.gpuTgp ? `${pc.gpuTgp} W` : 'Integrada / não aplicável'],
    ['Placa-mãe', pc.motherboard],
    ['Memória', pc.ram],
    ['Armazenamento', pc.storage],
    ['Fonte', pc.powerSupply],
    ['Cooler', pc.cooler],
    ['Gabinete', pc.case],
    ['Ventoinhas', String(pc.fans)],
  ]

  const componentItems = asArray(pc.components)
  const purchaseByHardwareId = new Map(purchaseItems.map((item) => [String(item.hardwareId), item]))
  const isPromotion = (offer) => {
    if (!offer) return false
    const current = Number(offer.precoAtual ?? offer.preco ?? offer.price)
    const previous = Number(offer.precoAnterior ?? offer.previousPrice)
    const discount = Number(offer.descontoPercentual ?? offer.desconto ?? offer.discountPercent)
    return (Number.isFinite(discount) && discount > 0) || (Number.isFinite(previous) && previous > 0 && Number.isFinite(current) && current > 0 && previous > current)
  }

  const getComponentOffer = (component) => {
    const purchaseItem = purchaseByHardwareId.get(String(component?.hardwareId ?? component?.hardware?.id))
    return purchaseItem?.melhorOferta || purchaseItem?.oferta || null
  }

  return (
    <div className="mounted-detail">
      <section className="mounted-detail__hero">
        <div className="page-container mounted-detail__hero-grid">
          <div className="mounted-detail__visual">
            {pc.highlight ? <span>{asText(pc.highlight, '')}</span> : null}
            {pc.image ? <img className="mounted-detail__image" src={pc.image} alt={pc.name} /> : <div className="mounted-detail__case" aria-hidden="true">
              <i className="mounted-detail__fan mounted-detail__fan--1" />
              <i className="mounted-detail__fan mounted-detail__fan--2" />
              <i className="mounted-detail__gpu" />
            </div>}
          </div>

          <div className="mounted-detail__intro">
            <Link className="mounted-detail__back" to="/montados">← Voltar para Montados</Link>
            <span className="eyebrow">{pc.category}</span>
            <h1>{pc.name}</h1>
            <p>{pc.description}</p>

            <div className="mounted-detail__signals">
              <span className="mounted-detail__rating">★ {formatRating(pc.rating)} <small>{asNumber(pc.reviewsCount, 0)} avaliações</small></span>
              <span>{pc.offersCount} ofertas disponíveis</span>
              <span>{pc.estimatedConsumption} W estimados</span>
            </div>

            <div className="mounted-detail__price">
              <span>A partir de</span>
              <strong>{formatCurrency(pc.price)}</strong>
            </div>

            <div className="mounted-detail__actions">
              <Link className="button button--primary" to={builderPath}>Abrir build completa no 3D</Link>
              <Link className="button button--secondary" to={`/montados?comparar=${pc.id}`}>Comparar</Link>
              <a className="button button--secondary" href="#ofertas">Onde comprar</a>
            </div>
          </div>
        </div>
      </section>

      <main className="page-container mounted-detail__main">
        <section className="mounted-detail__section">
          <header>
            <span className="eyebrow">Configuração</span>
            <h2>Componentes do PC</h2>
          </header>
          <dl className="mounted-detail__specs">
            {specs.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>

          {componentItems.length > 0 && <div className="mounted-detail__components-list">
            <h3>Peças utilizadas neste PC</h3>
            <p className="mounted-detail__components-note"><strong>Importante:</strong> as peças em promoção relacionadas são ofertas do CriaByte para compra separada e <strong>não estão vinculadas diretamente ao computador em promoção</strong>.</p>
            {componentItems.map((component, index) => {
              const hardware = component?.hardware || {}
              const offer = getComponentOffer(component)
              const promotion = isPromotion(offer)
              const name = component?.nome || hardware?.nome || component?.name || `Hardware #${component?.hardwareId ?? index + 1}`
              const category = component?.categoria || hardware?.categoria || 'Hardware'
              const quantity = Number(component?.quantidade || 1)
              return (
                <div className="mounted-detail__component-row" key={`${component?.hardwareId ?? 'component'}-${index}`}>
                  <div><strong>{name}</strong><span>{category}{quantity > 1 ? ` · ${quantity} unidades` : ''}</span></div>
                  {promotion && offer?.urlCompra && <a className="button button--secondary" href={offer.urlCompra} target="_blank" rel="sponsored noopener noreferrer">Ver Promoção</a>}
                </div>
              )
            })}
          </div>}
        </section>

        <section className="mounted-detail__summary">
          <article>
            <span>Compatibilidade</span>
            <strong className="is-success">Compatível</strong>
            <p>O resumo usa os dados técnicos disponíveis para esta configuração.</p>
          </article>
          <article>
            <span>Consumo estimado</span>
            <strong>{pc.estimatedConsumption} W</strong>
            <p>A potência da fonte é {pc.powerSupplyWatts} W e não é tratada como consumo.</p>
          </article>
          <article>
            <span>Uso indicado</span>
            <strong>{pc.usage}</strong>
            <p>{pc.resolution === 'Não aplicável' ? 'Sem resolução alvo definida.' : `Resolução alvo: ${pc.resolution}.`}</p>
          </article>
        </section>

        <section className="mounted-detail__section" id="ofertas">
          <header>
            <span className="eyebrow">Onde comprar</span>
            <h2>Ofertas disponíveis</h2>
            <p>Preços e links podem mudar conforme as ofertas disponíveis nas lojas.</p>
          </header>

          {purchaseSummary && <div className="mounted-detail__purchase-summary">
            <article><span>Peças com oferta</span><strong>{asNumber(purchaseSummary.componentes?.comOferta, 0)}/{asNumber(purchaseSummary.componentes?.totalLinhas, purchaseItems.length)}</strong></article>
            <article><span>Total das peças</span><strong>{purchaseSummary.precoPecasCompleto != null ? formatCurrency(purchaseSummary.precoPecasCompleto) : `${formatCurrency(purchaseSummary.precoPecasParcial)} parcial`}</strong></article>
            <article><span>PC montado</span><strong>{purchaseSummary.melhorOfertaPcMontado?.preco != null ? formatCurrency(purchaseSummary.melhorOfertaPcMontado.preco) : 'Sem oferta'}</strong></article>
            {purchaseSummary.comparacao && <article><span>Mais barato agora</span><strong>{purchaseSummary.comparacao.maisBarato === 'PECAS' ? 'Comprar as peças' : purchaseSummary.comparacao.maisBarato === 'PC_MONTADO' ? 'PC montado' : 'Mesmo preço'}</strong></article>}
          </div>}

          {purchaseItems.length > 0 && <div className="mounted-detail__offers mounted-detail__offers--parts">
            {purchaseItems.map((item) => (
              <article key={`${item.hardwareId}-${item.categoria}`}>
                <div><strong>{item.nome}</strong><span>{item.quantidadeComercial > 1 ? `${item.quantidadeComercial} unidades` : item.categoria}</span></div>
                <strong>{item.subtotal != null ? formatCurrency(item.subtotal) : 'Sem oferta'}</strong>
                {isPromotion(item.melhorOferta) && item.melhorOferta?.urlCompra ? <a className="button button--secondary" href={item.melhorOferta.urlCompra} target="_blank" rel="sponsored noopener noreferrer">Ver Promoção</a> : null}
              </article>
            ))}
          </div>}

          <div className="mounted-detail__offers">
            {asArray(pc.offers).map((offer, index) => (
              <article key={`${offer.store}-${offer.price}`}>
                <div>
                  <strong>{offer.store}</strong>
                  <span>{index === 0 ? 'Melhor preço atual' : 'Oferta ativa'}</span>
                </div>
                <strong>{formatCurrency(offer.price)}</strong>
                {offer.url && offer.url !== '#' ? (
                  <a className="button button--secondary" href={offer.url} target="_blank" rel="sponsored noopener noreferrer">Comprar</a>
                ) : (
                  <button className="button button--secondary" type="button" disabled>Link indisponível</button>
                )}
              </article>
            ))}
          </div>
        </section>

        <ReviewsPanel
          entityType="montado"
          entityId={pc.id}
          initialRating={pc.rating}
          initialCount={pc.reviewsCount}
          title="O que os usuários acham"
          intro="Avalie o PC completo e deixe sua experiência com a configuração."
        />
      </main>
    </div>
  )
}
