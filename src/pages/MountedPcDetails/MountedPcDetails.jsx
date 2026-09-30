import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMountedPcById, getMountedPcBuilderPath } from '../../services/mountedPcsService'
import CommercialBuildHardware from '../../components/CommercialBuildHardware/CommercialBuildHardware'
import ReviewsPanel from '../../components/ReviewsPanel/ReviewsPanel'
import { buildCategoryLabel, hasCompleteBuilderConfiguration, hasVerifiedConsumption, isUpgradeKit } from '../../utils/commercialBuild'
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
      description: pc.description || `Confira os componentes e as ofertas de ${pc.name}.`,
    })
  }, [pc])

  if (pc === undefined) {
    return <div className="page-container mounted-detail-state">Carregando anúncio...</div>
  }

  if (!pc) {
    return <div className="page-container mounted-detail-state">
      <h1>Anúncio não encontrado</h1>
      <Link className="button button--primary" to="/montados">Voltar para Montados</Link>
    </div>
  }

  const kit = isUpgradeKit(pc)
  const has3D = hasCompleteBuilderConfiguration(pc)
  const verifiedConsumption = hasVerifiedConsumption(pc)
  const builderPath = has3D ? getMountedPcBuilderPath(pc) : null
  const purchaseSummary = pc.purchaseSummary || null
  const purchaseItems = asArray(purchaseSummary?.itens)
  const linked = asArray(pc.components).filter((component) => component?.hardware?.id || component?.hardwareId)
  const linkedCategories = new Set(linked.map((component) => String(component.categoria || component.hardware?.categoria || '').toUpperCase()))
  const specs = [
    ['PROCESSADOR', 'Processador', pc.cpu],
    ['PROCESSADOR', 'TDP do processador', verifiedConsumption && pc.cpuTdp ? `${pc.cpuTdp} W` : null],
    ['PLACA_VIDEO', 'Placa de vídeo', pc.gpu],
    ['PLACA_VIDEO', 'TGP da GPU', verifiedConsumption && pc.gpuTgp ? `${pc.gpuTgp} W` : null],
    ['PLACA_MAE', 'Placa-mãe', pc.motherboard],
    ['MEMORIA_RAM', 'Memória', pc.ram],
    ['ARMAZENAMENTO', 'Armazenamento', pc.storage],
    ['FONTE', 'Fonte', pc.powerSupply],
    ['COOLER', 'Cooler', pc.cooler],
    ['GABINETE', 'Gabinete', pc.case],
    ['VENTOINHA', 'Ventoinhas', linkedCategories.has('VENTOINHA') ? String(pc.fans) : null],
  ].filter(([category, , value]) => linkedCategories.has(category) && value && value !== '—')

  const offerItems = purchaseItems.filter((item) => {
    const offer = item?.melhorOferta || item?.oferta || null
    const price = Number(offer?.precoAtual ?? offer?.preco ?? offer?.price ?? item?.subtotal)
    return Boolean(offer) || (Number.isFinite(price) && price > 0)
  })

  const getPieceProductPath = (item) => {
    const productId = item?.produtoId
      ?? item?.productId
      ?? item?.produto?.id
      ?? item?.product?.id
      ?? item?.melhorOferta?.produtoId
      ?? item?.melhorOferta?.produto?.id
      ?? item?.oferta?.produtoId
      ?? item?.oferta?.produto?.id
    if (productId != null && String(productId).trim()) return `/produto/${encodeURIComponent(productId)}`
    const name = asText(item?.nome, '')
    return name ? `/loja?busca=${encodeURIComponent(name)}` : '/loja'
  }

  return <div className="mounted-detail">
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
          <span className="eyebrow">{buildCategoryLabel(pc)}</span>
          <h1>{pc.name}</h1>
          <p>{pc.description}</p>
          <div className="mounted-detail__signals">
            <span className="mounted-detail__rating">★ {formatRating(pc.rating)} <small>{asNumber(pc.reviewsCount, 0)} avaliações</small></span>
            <span>{pc.offersCount} ofertas disponíveis</span>
            {verifiedConsumption && <span>{pc.estimatedConsumption} W estimados</span>}
          </div>
          <div className="mounted-detail__price">
            <span>{asNumber(pc.price, 0) > 0 ? 'A partir de' : 'Preço'}</span>
            <strong>{asNumber(pc.price, 0) > 0 ? formatCurrency(pc.price) : 'Sem oferta ativa'}</strong>
          </div>
          <div className="mounted-detail__actions">
            {builderPath && <Link className="button button--primary" to={builderPath}>Abrir build completa no 3D</Link>}
            <Link className="button button--secondary" to={`/montados?comparar=${pc.id}`}>Comparar</Link>
            <a className="button button--secondary" href="#ofertas">Onde comprar</a>
          </div>
        </div>
      </div>
    </section>

    <main className="page-container mounted-detail__main">
      <section className="mounted-detail__section">
        <header><span className="eyebrow">Informações do anúncio</span><h2>{kit ? 'Componentes do kit' : 'Componentes do PC'}</h2></header>
        {specs.length > 0 ? <dl className="mounted-detail__specs">
          {specs.map(([, label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl> : <p>O vendedor não informou modelos suficientes para vincular hardwares individualmente. Consulte a descrição original acima.</p>}
        {linked.length > 0 && <p className="mounted-detail__offers-note">A lista vinculada inclui apenas modelos confirmados. Memória sem marca e periféricos que acompanham o anúncio permanecem na descrição.</p>}
      </section>

      <CommercialBuildHardware components={pc.components} />

      <section className="mounted-detail__summary">
        <article>
          <span>Compatibilidade</span>
          <strong className={verifiedConsumption ? 'is-success' : ''}>{verifiedConsumption ? 'Configuração validada' : 'Não verificada'}</strong>
          <p>{verifiedConsumption ? 'Consumo estimado com base nos componentes cadastrados.' : 'O anúncio comercial não exige hardware cadastrado nem garante compatibilidade técnica entre peças.'}</p>
        </article>
        <article>
          <span>Consumo estimado</span>
          <strong>{verifiedConsumption ? `${pc.estimatedConsumption} W` : 'Não disponível'}</strong>
          <p>{verifiedConsumption ? `A potência da fonte é ${pc.powerSupplyWatts} W e não é tratada como consumo.` : 'Só exibimos consumo quando existe uma configuração técnica suficiente.'}</p>
        </article>
        <article>
          <span>Uso indicado</span>
          <strong>{pc.usage}</strong>
          <p>{pc.resolution === 'Não aplicável' ? 'Sem resolução alvo definida.' : `Resolução alvo: ${pc.resolution}`}</p>
        </article>
      </section>

      <section className="mounted-detail__section" id="ofertas">
        <header>
          <span className="eyebrow">Onde comprar</span>
          <h2>Ofertas disponíveis</h2>
          <p>Os preços e links podem mudar conforme a disponibilidade nas lojas.</p>
          <p className="mounted-detail__offers-note"><strong>Importante:</strong> as ofertas individuais das peças são independentes do anúncio do {kit ? 'kit' : 'PC montado'}. Nem toda peça descrita pelo vendedor tem oferta própria no CriaByte.</p>
        </header>

        {purchaseSummary && purchaseSummary.componentes?.totalLinhas > 0 && <div className="mounted-detail__purchase-summary">
          <article><span>Peças vinculadas com oferta</span><strong>{asNumber(purchaseSummary.componentes?.comOferta, 0)}/{asNumber(purchaseSummary.componentes?.totalLinhas, purchaseItems.length)}</strong></article>
          <article><span>Total das peças vinculadas</span><strong>{purchaseSummary.precoPecasCompleto != null ? formatCurrency(purchaseSummary.precoPecasCompleto) : purchaseSummary.componentes?.comOferta > 0 ? `${formatCurrency(purchaseSummary.precoPecasParcial)} parcial` : 'Sem ofertas individuais'}</strong></article>
          <article><span>{kit ? 'Kit de upgrade' : 'PC montado'}</span><strong>{purchaseSummary.melhorOfertaPcMontado?.preco != null ? formatCurrency(purchaseSummary.melhorOfertaPcMontado.preco) : 'Sem oferta'}</strong></article>
          {purchaseSummary.comparacao && verifiedConsumption && <article><span>Mais barato agora</span><strong>{purchaseSummary.comparacao.maisBarato === 'PECAS' ? 'Comprar as peças' : purchaseSummary.comparacao.maisBarato === 'PC_MONTADO' ? 'PC montado' : 'Mesmo preço'}</strong></article>}
        </div>}

        {offerItems.length > 0 && <div className="mounted-detail__offers mounted-detail__offers--parts">
          {offerItems.map((item) => {
            const offer = item?.melhorOferta || item?.oferta || null
            const itemPrice = item?.subtotal ?? offer?.precoAtual ?? offer?.preco ?? offer?.price
            return <article key={`${item.hardwareId}-${item.categoria}`}>
              <div><strong>{item.nome}</strong><span>{item.quantidadeComercial > 1 ? `${item.quantidadeComercial} unidades` : item.categoria}</span></div>
              <strong>{itemPrice != null ? formatCurrency(itemPrice) : 'Oferta disponível'}</strong>
              <Link className="button button--secondary" to={getPieceProductPath(item)}>Ver peça</Link>
            </article>
          })}
        </div>}

        <div className="mounted-detail__offers">
          {asArray(pc.offers).map((offer, index) => <article key={`${offer.store}-${offer.price}-${index}`}>
            <div><strong>{offer.store}</strong><span>{index === 0 ? 'Melhor preço atual' : 'Oferta ativa'}</span></div>
            <strong>{formatCurrency(offer.price)}</strong>
            {offer.url && offer.url !== '#'
              ? <a className="button button--secondary" href={offer.url} target="_blank" rel="sponsored noopener noreferrer">Comprar</a>
              : <button className="button button--secondary" type="button" disabled>Link indisponível</button>}
          </article>)}
          {!pc.offers?.length && <p>Não há oferta ativa para este anúncio no momento.</p>}
        </div>
      </section>

      <ReviewsPanel
        entityType="montado"
        entityId={pc.id}
        initialRating={pc.rating}
        initialCount={pc.reviewsCount}
        title="O que os usuários acham"
        intro={kit ? 'Avalie este kit de upgrade.' : 'Avalie o PC completo e deixe sua experiência com a configuração.'}
      />
    </main>
  </div>
}
