import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProductById } from '../../services/productsService'
import ReviewsPanel from '../../components/ReviewsPanel/ReviewsPanel'
import { asArray, asNumber, asText, formatCurrency, formatRating } from '../../utils/display'
import { setDocumentMeta } from '../../utils/pageMeta'
import { isPublicSpec, publicProductDescription, publicSpecLabel, publicSpecValue } from '../../utils/productSpecPresentation'
import './ProductDetails.css'

const groupNavigation = {
  hardwares: { label: 'Peças', to: '/pecas' },
  perifericos: { label: 'Periféricos', to: '/loja?grupo=perifericos' },
  monitores: { label: 'Monitores', to: '/loja?grupo=monitores' },
  setup: { label: 'Setup', to: '/loja?grupo=setup' },
  notebooks: { label: 'Notebooks', to: '/notebooks' },
  computadores: { label: 'Computadores', to: '/loja?grupo=computadores' },
  celulares: { label: 'Celulares', to: '/loja?grupo=celulares' },
  tablets: { label: 'Tablets e leitura', to: '/loja?grupo=tablets' },
  games: { label: 'Games', to: '/loja?grupo=games' },
  'tv-audio': { label: 'TV e Áudio', to: '/loja?grupo=tv-audio' },
  fotografia: { label: 'Foto e Vídeo', to: '/loja?grupo=fotografia' },
  'casa-inteligente': { label: 'Casa Inteligente', to: '/loja?grupo=casa-inteligente' },
  eletroportateis: { label: 'Eletroportáteis', to: '/loja?grupo=eletroportateis' },
  rede: { label: 'Rede e Internet', to: '/loja?grupo=rede' },
  impressao: { label: 'Impressão', to: '/loja?grupo=impressao' },
  wearables: { label: 'Wearables', to: '/loja?grupo=wearables' },
  maker: { label: 'Eletrônica e Maker', to: '/loja?grupo=maker' },
  acessorios: { label: 'Acessórios', to: '/loja?grupo=acessorios' },
}

const builderCategory = {
  'placa-mae': 'placamae',
  'placa-video': 'placavideo',
  memoria: 'memoria',
  processador: 'processador',
  cooler: 'cooler',
  armazenamento: 'armazenamento',
  fonte: 'fonte',
  gabinete: 'gabinete',
  ventoinha: 'ventoinhas',
}

function productCanonical(product) {
  return `/produto/${encodeURIComponent(product.slug || product.id)}`
}

function productStructuredData(product) {
  const offers = asArray(product.offers).filter((offer) => Number(offer?.price) > 0)
  const prices = offers.map((offer) => Number(offer.price)).filter(Number.isFinite)
  const description = asText(
    publicProductDescription(product.description, product.name),
    `Compare preços, especificações e ofertas de ${product.name} no CriaByte.`,
  )

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    sku: String(product.id),
    ...(product.image ? { image: [product.image] } : {}),
    ...(product.brand && product.brand !== '—' ? {
      brand: { '@type': 'Brand', name: product.brand },
    } : {}),
    ...(product.model ? { model: product.model } : {}),
    ...(product.mpn ? { mpn: product.mpn } : {}),
  }

  const gtin = String(product.gtin || '').replace(/\D/g, '')
  if ([8, 12, 13, 14].includes(gtin.length)) {
    data[`gtin${gtin.length}`] = gtin
  }

  if (prices.length) {
    data.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'BRL',
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: prices.length,
      url: `https://criabyte.com.br${productCanonical(product)}`,
    }
  }

  const rating = Number(product.rating)
  const reviewCount = Number(product.reviewsCount)
  if (rating > 0 && reviewCount > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(rating.toFixed(1)),
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return data
}

export default function ProductDetails() {
  const { id } = useParams()
  const [product, setProduct] = useState(undefined)

  useEffect(() => {
    let active = true
    getProductById(id).then((item) => { if (active) setProduct(item) }).catch(() => { if (active) setProduct(null) })
    return () => { active = false }
  }, [id])

  const specs = useMemo(() => {
    const rows = new Map()
    for (const [key, value] of Object.entries(product?.specs || {})) {
      if (isPublicSpec(key, value)) rows.set(publicSpecLabel(key).toLocaleLowerCase('pt-BR'), [key, value])
    }
    return [...rows.values()]
  }, [product])
  const description = product ? publicProductDescription(product.description, product.name) : ''
  useEffect(() => {
    if (!product) return undefined
    const offers = asArray(product.offers)
    const priceText = Number(product.price) > 0 ? ` a partir de ${formatCurrency(product.price)}` : ''
    const metadataDescription = description
      || `Compare ${offers.length || 'as'} oferta${offers.length === 1 ? '' : 's'} de ${product.name}${priceText}. Veja ficha técnica, avaliações e onde comprar.`

    return setDocumentMeta({
      title: `${product.name}: preços e ficha técnica | CriaByte`,
      description: metadataDescription,
      canonical: productCanonical(product),
      image: product.image,
      type: 'product',
      structuredData: productStructuredData(product),
    })
  }, [product, description])

  useEffect(() => {
    if (!product || window.location.hash !== '#onde-comprar') return undefined
    const timer = window.setTimeout(() => {
      document.getElementById('onde-comprar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [product])

  const section = product ? (groupNavigation[product.group] || { label: 'Produtos', to: '/loja' }) : null

  if (product === undefined) return <div className="page-container product-detail-state">Carregando produto...</div>
  if (!product) return <div className="page-container product-detail-state"><strong>Produto não encontrado.</strong><Link to="/loja">Voltar para produtos</Link></div>

  return (
    <div className="product-detail-page">
      <section className="page-container product-detail-hero">
        <div className={`product-detail-visual product-detail-visual--${asText(product.group, 'hardwares')}`}>
          {product.image
            ? <>
                <img
                  className={`product-detail-visual__image product-detail-visual__image--primary ${product.hoverImage && product.hoverImage !== product.image ? 'product-detail-visual__image--has-hover' : ''}`}
                  src={product.image}
                  alt={product.name}
                />
                {product.hoverImage && product.hoverImage !== product.image && (
                  <img className="product-detail-visual__image product-detail-visual__image--hover" src={product.hoverImage} alt="" />
                )}
              </>
            : <span aria-hidden="true">{asText(product.category, 'Produto').slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className="product-detail-summary">
          <div className="product-detail-breadcrumb"><Link to={section.to}>{section.label}</Link><span>/</span><span>{asText(product.category, 'Produto')}</span></div>
          <span className="eyebrow">{asText(product.brand)}</span>
          <h1>{product.name}</h1>
          <p>{description || `Compare especificações e ofertas de ${product.name}.`}</p>
          <div className="product-detail-rating"><strong>★ {formatRating(product.rating)}</strong><span>{asNumber(product.reviewsCount, 0)} avaliações</span></div>
          <div className="product-detail-price"><span>{asNumber(product.price, 0) > 0 ? 'A partir de' : 'Preço'}</span><strong>{asNumber(product.price, 0) > 0 ? formatCurrency(product.price) : 'Sem oferta ativa'}</strong><small>{asArray(product.offers).length} oferta{asArray(product.offers).length === 1 ? '' : 's'} ativa{asArray(product.offers).length === 1 ? '' : 's'}</small></div>
          <div className="product-detail-actions">
            <a className="button button--primary" href="#onde-comprar">Onde comprar</a>
            <Link className="button button--secondary" to={`/loja?comparar=${encodeURIComponent(product.slug || product.id)}`}>Comparar</Link>
            <Link className="button button--secondary" to={`/enviar-oferta?produtoId=${encodeURIComponent(product.id)}`}>Enviar oferta</Link>
            {product.builderCompatible && <Link className="button button--secondary" to={`/montar?peca=${encodeURIComponent(product.builderId || product.id)}&categoria=${encodeURIComponent(builderCategory[product.categoryKey] || product.categoryKey)}`}>Abrir no 3D</Link>}
          </div>
          {product.builderCompatible && <p className="product-detail-legacy-note">Ao abrir o montador, este componente é selecionado automaticamente quando existe no catálogo 3D.</p>}
        </div>
      </section>

      <section className="page-container product-detail-section">
        <div className="product-detail-section__heading"><span className="eyebrow">Ficha técnica</span><h2>Especificações</h2></div>
        <dl className="product-spec-grid">
          {specs.map(([key, value]) => <div key={key}><dt>{publicSpecLabel(key)}</dt><dd>{publicSpecValue(key, value)}</dd></div>)}
        </dl>
      </section>

      <section className="product-detail-section product-detail-section--surface" id="onde-comprar">
        <div className="page-container">
          <div className="product-detail-section__heading"><span className="eyebrow">Ofertas atuais</span><h2>Onde comprar</h2><p>Compare as ofertas disponíveis e confirme preço, frete e disponibilidade diretamente na loja.</p></div>
          <div className="product-offers-list">
            {!asArray(product.offers).length && <p className="product-detail-state">Nenhuma oferta ativa cadastrada para este produto.</p>}
            {asArray(product.offers).map((offer, index) => (
              <article className="product-offer-row" key={offer.id ?? `${offer.url}-${index}`}>
                <div><strong>{offer.store}</strong>{offer.seller && <span>Vendido por {offer.seller}</span>}<span>{index === 0 ? 'Melhor preço disponível' : 'Oferta disponível'}</span>{offer.registeredBy && <span>Cadastrado por {offer.registeredBy}</span>}</div>
                <strong>{formatCurrency(offer.price)}</strong>
                {offer.url && offer.url !== '#' ? (
                  <a className="button button--primary" href={offer.url} target="_blank" rel="sponsored noopener noreferrer">Comprar</a>
                ) : (
                  <button className="button button--primary" type="button" disabled>Link indisponível</button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="page-container product-detail-section">
        <ReviewsPanel
          entityType="produto"
          entityId={product.id}
          initialRating={product.rating}
          initialCount={product.reviewsCount}
          title="Avaliações do produto"
          intro="Veja opiniões e, estando autenticado, registre sua própria avaliação."
        />
      </div>
    </div>
  )
}
