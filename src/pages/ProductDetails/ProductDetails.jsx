import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProductById } from '../../services/productsService'
import ReviewsPanel from '../../components/ReviewsPanel/ReviewsPanel'
import { asArray, asNumber, asText, formatCurrency, formatRating } from '../../utils/display'
import { setDocumentMeta } from '../../utils/pageMeta'
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

const specLabels = {
  socket: 'Socket', generation: 'Geração', architecture: 'Arquitetura', cores: 'Núcleos', threads: 'Threads',
  baseClockGhz: 'Clock base', boostClockGhz: 'Clock turbo', cacheL3Mb: 'Cache L3', tdpWatts: 'TDP', integratedGraphics: 'Vídeo integrado', memory: 'Memória suportada', pcie: 'PCIe',
  vramGb: 'VRAM', memoryType: 'Tipo de memória', memoryBusBits: 'Barramento', boostClockMhz: 'Clock boost', tgpWatts: 'TGP', recommendedPsuWatts: 'Fonte recomendada', lengthMm: 'Comprimento', slots: 'Slots',
  chipset: 'Chipset', formFactor: 'Formato', ramSlots: 'Slots RAM', maxRamGb: 'RAM máxima', m2Slots: 'Slots M.2', sataPorts: 'Portas SATA', wifi: 'Wi-Fi', bluetooth: 'Bluetooth',
  capacityGb: 'Capacidade', modules: 'Módulos', frequencyMhz: 'Frequência', latency: 'Latência', voltage: 'Tensão', rgb: 'Com iluminação RGB', type: 'Tipo', interface: 'Interface', readMbps: 'Leitura', writeMbps: 'Gravação',
  coolingType: 'Tipo de refrigeração', sockets: 'Sockets suportados', thermalCapacityWatts: 'Capacidade térmica', radiatorMm: 'Radiador', fanCount: 'Quantidade de fans', noiseDb: 'Nível de ruído', lifeHours: 'Vida útil', maxRpm: 'Velocidade máxima', depthMm: 'Profundidade',
  powerWatts: 'Potência', certification: 'Certificação', modularity: 'Modularidade', pcie5: 'PCIe 5', fanMm: 'Ventoinha',
  sensor: 'Sensor', dpiMax: 'DPI máximo', pollingRateHz: 'Polling rate', buttons: 'Botões', weightGrams: 'Peso', connection: 'Conexão', layout: 'Layout', size: 'Tamanho', switch: 'Switch', hotSwap: 'Hot swap',
  driverMm: 'Driver', microphone: 'Microfone', surround: 'Surround', sizeInches: 'Tamanho', resolution: 'Resolução', refreshRateHz: 'Taxa de atualização', panel: 'Painel', responseTimeMs: 'Tempo de resposta', hdr: 'HDR', displayPort: 'DisplayPort', hdmi: 'HDMI', vesa: 'VESA',
  cpu: 'Processador', gpu: 'Placa de vídeo', ramGb: 'RAM', storageGb: 'Armazenamento', screenInches: 'Tela', weightKg: 'Peso', upgradeRam: 'Upgrade de RAM', upgradeStorage: 'Upgrade de armazenamento',
  material: 'Material', maxWeightKg: 'Peso máximo', armrest: 'Apoio de braço', reclining: 'Reclinação', lumbarSupport: 'Apoio lombar', headrest: 'Apoio de cabeça',
  widthMm: 'Largura', heightMm: 'Altura', thicknessMm: 'Espessura', surface: 'Superfície', base: 'Base',
}

const unitFor = (key) => ({
  baseClockGhz: ' GHz', boostClockGhz: ' GHz', cacheL3Mb: ' MB', tdpWatts: ' W', vramGb: ' GB', memoryBusBits: ' bits', boostClockMhz: ' MHz', tgpWatts: ' W', recommendedPsuWatts: ' W', lengthMm: ' mm', maxRamGb: ' GB', capacityGb: ' GB', frequencyMhz: ' MHz', readMbps: ' MB/s', writeMbps: ' MB/s', powerWatts: ' W', fanMm: ' mm', pollingRateHz: ' Hz', weightGrams: ' g', driverMm: ' mm', sizeInches: '”', refreshRateHz: ' Hz', responseTimeMs: ' ms', ramGb: ' GB', storageGb: ' GB', screenInches: '”', weightKg: ' kg', maxWeightKg: ' kg', widthMm: ' mm', heightMm: ' mm', depthMm: ' mm', thicknessMm: ' mm', thermalCapacityWatts: ' W', radiatorMm: ' mm', noiseDb: ' dB', lifeHours: ' horas', maxRpm: ' RPM',
}[key] ?? '')


function formatPublicSpecValue(key, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') {
    const fractionDigits = key === 'noiseDb' ? 1 : Number.isInteger(value) ? 0 : 2
    return value.toLocaleString('pt-BR', { maximumFractionDigits: fractionDigits })
  }
  return String(value)
}

function isInternalSpecKey(key) {
  const normalized = String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
  return [
    'id', 'produtoid', 'hardwareid', 'categoriaid', 'parceiroid',
    'modelo3did', 'hardwareid3d', 'criadoem', 'atualizadoem',
  ].includes(normalized)
}

function productCanonical(product) {
  return `/produto/${encodeURIComponent(product.slug || product.id)}`
}

function productStructuredData(product) {
  const offers = asArray(product.offers).filter((offer) => Number(offer?.price) > 0)
  const prices = offers.map((offer) => Number(offer.price)).filter(Number.isFinite)
  const description = asText(
    product.description,
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

  const specs = useMemo(() => product ? Object.entries(product.specs || {}).filter(([key]) => !isInternalSpecKey(key)) : [], [product])
  useEffect(() => {
    if (!product) return undefined
    const offers = asArray(product.offers)
    const priceText = Number(product.price) > 0 ? ` a partir de ${formatCurrency(product.price)}` : ''
    const description = product.description
      || `Compare ${offers.length || 'as'} oferta${offers.length === 1 ? '' : 's'} de ${product.name}${priceText}. Veja ficha técnica, avaliações e onde comprar.`

    return setDocumentMeta({
      title: `${product.name}: preços e ficha técnica | CriaByte`,
      description,
      canonical: productCanonical(product),
      image: product.image,
      type: 'product',
      structuredData: productStructuredData(product),
    })
  }, [product])

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
          <p>{product.description}</p>
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
          {specs.map(([key, value]) => <div key={key}><dt>{specLabels[key] ?? key}</dt><dd>{formatPublicSpecValue(key, value)}{unitFor(key)}</dd></div>)}
        </dl>
      </section>

      <section className="product-detail-section product-detail-section--surface" id="onde-comprar">
        <div className="page-container">
          <div className="product-detail-section__heading"><span className="eyebrow">Ofertas atuais</span><h2>Onde comprar</h2><p>Compare as ofertas disponíveis e confirme preço, frete e disponibilidade diretamente na loja.</p></div>
          <div className="product-offers-list">
            {!asArray(product.offers).length && <p className="product-detail-state">Nenhuma oferta ativa cadastrada para este produto.</p>}
            {asArray(product.offers).map((offer, index) => (
              <article className="product-offer-row" key={`${offer.store}-${offer.price}`}>
                <div><strong>{offer.store}</strong><span>{index === 0 ? 'Melhor preço disponível' : 'Oferta disponível'}</span>{offer.registeredBy && <span>Cadastrado por {offer.registeredBy}</span>}</div>
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
