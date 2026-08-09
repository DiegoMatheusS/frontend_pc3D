import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../../components/ProductCard/ProductCard'
import CatalogState from '../../components/CatalogState/CatalogState'
import { getProductById, getProductGroups, getProducts } from '../../services/productsService'
import useAccessibleDialog from '../../hooks/useAccessibleDialog'
import './Store.css'

const formatPrice = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
}).format(value)

const normalize = (value) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const comparisonByCategory = {
  processador: [
    ['Socket', 'socket'], ['Geração', 'generation'], ['Arquitetura', 'architecture'],
    ['Núcleos', 'cores', 'higher'], ['Threads', 'threads', 'higher'],
    ['Clock base', 'baseClockGhz', 'higher', ' GHz'], ['Clock turbo', 'boostClockGhz', 'higher', ' GHz'],
    ['Cache L3', 'cacheL3Mb', 'higher', ' MB'], ['TDP', 'tdpWatts', 'lower', ' W'],
    ['Vídeo integrado', 'integratedGraphics'], ['Memória', 'memory'], ['PCIe', 'pcie'],
  ],
  'placa-video': [
    ['VRAM', 'vramGb', 'higher', ' GB'], ['Memória', 'memoryType'], ['Barramento', 'memoryBusBits', null, ' bits'],
    ['Clock boost', 'boostClockMhz', 'higher', ' MHz'], ['TGP', 'tgpWatts', 'lower', ' W'],
    ['Fonte recomendada', 'recommendedPsuWatts', null, ' W'], ['Comprimento', 'lengthMm', 'lower', ' mm'], ['Slots', 'slots'], ['PCIe', 'pcie'],
  ],
  'placa-mae': [
    ['Socket', 'socket'], ['Chipset', 'chipset'], ['Formato', 'formFactor'], ['Memória', 'memory'],
    ['Slots RAM', 'ramSlots', 'higher'], ['RAM máxima', 'maxRamGb', 'higher', ' GB'],
    ['Slots M.2', 'm2Slots', 'higher'], ['Portas SATA', 'sataPorts', 'higher'], ['Wi-Fi', 'wifi'], ['Bluetooth', 'bluetooth'], ['PCIe', 'pcie'],
  ],
  memoria: [
    ['Capacidade', 'capacityGb', 'higher', ' GB'], ['Módulos', 'modules'], ['Tipo', 'memoryType'],
    ['Frequência', 'frequencyMhz', 'higher', ' MHz'], ['Latência', 'latency'], ['Tensão', 'voltage'], ['RGB', 'rgb'],
  ],
  armazenamento: [
    ['Capacidade', 'capacityGb', 'higher', ' GB'], ['Tipo', 'type'], ['Interface', 'interface'],
    ['Leitura', 'readMbps', 'higher', ' MB/s'], ['Gravação', 'writeMbps', 'higher', ' MB/s'], ['Formato', 'formFactor'],
  ],
  fonte: [
    ['Potência', 'powerWatts', null, ' W'], ['Certificação', 'certification'], ['Modularidade', 'modularity'], ['PCIe 5', 'pcie5'], ['Ventoinha', 'fanMm', null, ' mm'],
  ],
  mouse: [
    ['Sensor', 'sensor'], ['DPI máximo', 'dpiMax', 'higher'], ['Polling rate', 'pollingRateHz', 'higher', ' Hz'],
    ['Botões', 'buttons', 'higher'], ['Peso', 'weightGrams', 'lower', ' g'], ['Conexão', 'connection'], ['RGB', 'rgb'],
  ],
  teclado: [['Tipo', 'type'], ['Layout', 'layout'], ['Tamanho', 'size'], ['Switch', 'switch'], ['Conexão', 'connection'], ['RGB', 'rgb'], ['Hot swap', 'hotSwap']],
  headset: [['Conexão', 'connection'], ['Driver', 'driverMm', 'higher', ' mm'], ['Microfone', 'microphone'], ['Surround', 'surround'], ['Peso', 'weightGrams', 'lower', ' g']],
  monitor: [
    ['Tamanho', 'sizeInches', null, '”'], ['Resolução', 'resolution'], ['Taxa de atualização', 'refreshRateHz', 'higher', ' Hz'],
    ['Painel', 'panel'], ['Tempo de resposta', 'responseTimeMs', 'lower', ' ms'], ['HDR', 'hdr'], ['DisplayPort', 'displayPort'], ['HDMI', 'hdmi'], ['VESA', 'vesa'],
  ],
  notebook: [
    ['CPU', 'cpu'], ['GPU', 'gpu'], ['RAM', 'ramGb', 'higher', ' GB'], ['Armazenamento', 'storageGb', 'higher', ' GB'],
    ['Tela', 'screenInches', null, '”'], ['Resolução', 'resolution'], ['Hz', 'refreshRateHz', 'higher', ' Hz'],
    ['Peso', 'weightKg', 'lower', ' kg'], ['Upgrade RAM', 'upgradeRam'], ['Upgrade armazenamento', 'upgradeStorage'],
  ],
  cadeira: [['Material', 'material'], ['Peso máximo', 'maxWeightKg', 'higher', ' kg'], ['Braço', 'armrest'], ['Reclinação', 'reclining'], ['Apoio lombar', 'lumbarSupport'], ['Apoio de cabeça', 'headrest']],
  mousepad: [['Largura', 'widthMm', 'higher', ' mm'], ['Altura', 'heightMm', 'higher', ' mm'], ['Espessura', 'thicknessMm', 'higher', ' mm'], ['Superfície', 'surface'], ['Base', 'base'], ['RGB', 'rgb']],
}

function winnerIndex(values, better) {
  if (!better || values.length !== 2) return -1
  if (values.some((value) => !Number.isFinite(Number(value)))) return -1
  if (Number(values[0]) === Number(values[1])) return -1
  if (better === 'lower') return Number(values[0]) < Number(values[1]) ? 0 : 1
  return Number(values[0]) > Number(values[1]) ? 0 : 1
}

function formatSpecValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return `${value.join(', ')}${suffix}`
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'object') {
    const label = value.nome ?? value.name ?? value.label ?? value.codigo ?? value.slug
    return label ? `${label}${suffix}` : '—'
  }
  return `${value}${suffix}`
}

function humanizeSpecKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function genericComparisonFields(items) {
  if (items.length !== 2) return []
  const first = items[0].specs || {}
  const second = items[1].specs || {}
  const keys = [...new Set([...Object.keys(first), ...Object.keys(second)])]
  return keys
    .filter((key) => {
      const values = [first[key], second[key]]
      return values.some((value) => value !== undefined && value !== null && value !== '')
        && values.every((value) => typeof value !== 'object' || value === null || Array.isArray(value))
    })
    .slice(0, 18)
    .map((key) => [humanizeSpecKey(key), key])
}

export default function Store({ defaultGroup = 'todos' }) {
  const [groups, setGroups] = useState([])
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState(defaultGroup)
  const [category, setCategory] = useState('todos')
  const [brand, setBrand] = useState('todos')
  const [maxPrice, setMaxPrice] = useState('todos')
  const [sortBy, setSortBy] = useState('relevancia')
  const [compare, setCompare] = useState([])
  const [comparisonItems, setComparisonItems] = useState([])
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [compareMessage, setCompareMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [searchParams, setSearchParams] = useSearchParams()
  const comparisonDialogRef = useAccessibleDialog(comparisonOpen, setComparisonOpen)

  useEffect(() => {
    let active = true
    Promise.all([getProductGroups(), getProducts()]).then(([groupItems, productItems]) => {
      if (!active) return
      const safeGroups = Array.isArray(groupItems) ? groupItems : []
      const safeProducts = Array.isArray(productItems) ? productItems : []
      setGroups(safeGroups)
      setProducts(safeProducts)
      const requestedSearch = searchParams.get('busca')
      setQuery(requestedSearch || '')
      const requestedGroup = searchParams.get('grupo')
      if (requestedGroup && safeGroups.some((item) => item.id === requestedGroup)) setGroup(requestedGroup)
      const requestedCategory = searchParams.get('categoria')
      if (requestedCategory) {
        const foundCategory = safeProducts.find((item) => item.categoryKey === requestedCategory)?.category
        if (foundCategory) setCategory(foundCategory)
      }
      const requestedCompare = searchParams.get('comparar')
      if (requestedCompare) {
        const found = safeProducts.find((item) => String(item.id) === String(requestedCompare) || String(item.slug) === String(requestedCompare))
        if (found) {
          setCompare([found])
          setCompareMessage('Selecione mais um produto da mesma categoria para comparar.')
        }
        const next = new URLSearchParams(searchParams)
        next.delete('comparar')
        setSearchParams(next, { replace: true })
      }
    }).catch((error) => {
      if (!active) return
      setGroups([])
      setProducts([])
      setLoadError(error?.message || 'Não foi possível consultar o catálogo agora.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey, searchParams, setSearchParams])


  const visiblePool = useMemo(() => products.filter((product) => group === 'todos' || product.group === group), [products, group])
  const categories = useMemo(() => [...new Set(visiblePool.map((product) => product.category))].sort(), [visiblePool])
  const brands = useMemo(() => [...new Set(visiblePool.map((product) => product.brand))].sort(), [visiblePool])

  const filtered = useMemo(() => {
    const text = normalize(query)
    const max = maxPrice === 'todos' ? Infinity : Number(maxPrice)
    const result = products.filter((product) => {
      const haystack = normalize([product.name, product.brand, product.category, product.description, ...product.tags].join(' '))
      return (group === 'todos' || product.group === group)
        && (category === 'todos' || product.category === category)
        && (brand === 'todos' || product.brand === brand)
        && product.price <= max
        && (!text || haystack.includes(text))
    })

    return [...result].sort((a, b) => {
      if (sortBy === 'preco-menor') return a.price - b.price
      if (sortBy === 'preco-maior') return b.price - a.price
      if (sortBy === 'avaliacao') return b.rating - a.rating || b.reviewsCount - a.reviewsCount
      if (sortBy === 'ofertas') return b.offers.length - a.offers.length
      if (sortBy === 'nome') return a.name.localeCompare(b.name, 'pt-BR')
      return (b.rating * Math.log10(b.reviewsCount + 10)) - (a.rating * Math.log10(a.reviewsCount + 10))
    })
  }, [products, query, group, category, brand, maxPrice, sortBy])

  const changeGroup = (nextGroup) => {
    setGroup(nextGroup)
    setCategory('todos')
    setBrand('todos')
    if (defaultGroup === 'hardwares') return
    const next = new URLSearchParams(searchParams)
    if (nextGroup === 'todos') next.delete('grupo')
    else next.set('grupo', nextGroup)
    setSearchParams(next, { replace: true })
  }

  const toggleCompare = (product) => {
    setComparisonOpen(false)
    setComparisonItems([])
    setCompare((current) => {
      const exists = current.some((item) => String(item.id) === String(product.id))
      if (exists) {
        setCompareMessage('')
        return current.filter((item) => String(item.id) !== String(product.id))
      }

      if (current.length && current[0].categoryKey !== product.categoryKey) {
        setCompareMessage(`Para uma comparação técnica correta, escolha outro produto da categoria ${current[0].category}.`)
        return current
      }

      setCompareMessage('')
      if (current.length >= 2) return [current[1], product]
      return [...current, product]
    })
  }

  const openComparison = async () => {
    if (compare.length !== 2) return
    setComparisonLoading(true)
    setCompareMessage('')
    try {
      const detailed = await Promise.all(compare.map(async (product) => {
        try {
          return await getProductById(product.slug || product.id) || product
        } catch {
          return product
        }
      }))

      if (detailed[0].categoryKey !== detailed[1].categoryKey) {
        setCompareMessage('Os dois produtos precisam pertencer à mesma categoria para comparar a ficha técnica.')
        return
      }

      setComparisonItems(detailed)
      setComparisonOpen(true)
    } catch {
      setCompareMessage('Não foi possível carregar as fichas técnicas para comparação.')
    } finally {
      setComparisonLoading(false)
    }
  }

  const clearFilters = () => {
    setQuery('')
    setGroup(defaultGroup)
    setCategory('todos')
    setBrand('todos')
    setMaxPrice('todos')
    setSortBy('relevancia')
    setCompare([])
    setComparisonItems([])
    setComparisonOpen(false)
    setCompareMessage('')
    const next = new URLSearchParams(searchParams)
    next.delete('categoria')
    next.delete('comparar')
    next.delete('grupo')
    setSearchParams(next, { replace: true })
  }

  const activeGroupLabel = groups.find((item) => item.id === group)?.label
  const pageTitle = defaultGroup === 'hardwares'
    ? 'Peças para computador'
    : group === 'todos'
      ? 'Todos os produtos'
      : activeGroupLabel || 'Produtos'
  const pageDescription = defaultGroup === 'hardwares'
    ? 'Encontre componentes para montar ou atualizar o computador e compare especificações antes de escolher.'
    : group === 'todos'
      ? 'Explore hardwares, periféricos, monitores, notebooks e itens de setup em um catálogo único.'
      : `Explore ${String(activeGroupLabel || 'produtos').toLowerCase()} com especificações, comparação e ofertas disponíveis.`

  const activeComparison = comparisonItems.length === 2 ? comparisonItems : compare
  const categoryFields = activeComparison.length === 2 ? (comparisonByCategory[activeComparison[0].categoryKey] || []) : []
  const availableCategoryFields = categoryFields.filter(([, key]) => activeComparison.some((item) => {
    const value = item.specs?.[key]
    return value !== undefined && value !== null && value !== ''
  }))
  const fields = activeComparison.length === 2
    ? (availableCategoryFields.length ? availableCategoryFields : genericComparisonFields(activeComparison))
    : []

  return (
    <div className="store-page">
      <section className="store-page__hero">
        <div className="page-container">
          <span className="eyebrow">Catálogo técnico</span>
          <h1>{pageTitle}</h1>
          <p>{pageDescription}</p>
        </div>
      </section>

      <div className="store-groups-wrap">
        <div className="page-container store-groups" aria-label="Grupos de produtos">
          {groups.filter((item) => defaultGroup !== 'hardwares' || ['todos', 'hardwares'].includes(item.id)).map((item) => (
            <button key={item.id} type="button" className={group === item.id ? 'is-active' : ''} onClick={() => changeGroup(item.id)}>{item.label}</button>
          ))}
        </div>
      </div>

      <section className="page-container store-page__content">
        <aside className="store-filters">
          <div className="store-filters__heading">
            <div><span className="eyebrow">Refine a busca</span><h2>Filtros</h2></div>
            <button type="button" onClick={clearFilters}>Limpar</button>
          </div>

          <label className="store-field">
            <span>Pesquisar</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Produto, marca, categoria..." />
          </label>

          <label className="store-field">
            <span>Categoria</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="todos">Todas</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label className="store-field">
            <span>Marca</span>
            <select value={brand} onChange={(event) => setBrand(event.target.value)}>
              <option value="todos">Todas</option>
              {brands.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label className="store-field">
            <span>Preço máximo</span>
            <select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
              <option value="todos">Qualquer preço</option>
              <option value="300">Até R$ 300</option>
              <option value="500">Até R$ 500</option>
              <option value="1000">Até R$ 1.000</option>
              <option value="2000">Até R$ 2.000</option>
              <option value="5000">Até R$ 5.000</option>
              <option value="10000">Até R$ 10.000</option>
            </select>
          </label>
        </aside>

        <main className="store-results">
          <div className="store-results__toolbar">
            <div>
              <strong>{filtered.length} produto{filtered.length === 1 ? '' : 's'}</strong>
              <span>Compare especificações, avaliações e ofertas disponíveis.</span>
            </div>
            <select aria-label="Ordenar produtos" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="relevancia">Relevância</option>
              <option value="avaliacao">Melhor avaliação</option>
              <option value="ofertas">Mais ofertas</option>
              <option value="preco-menor">Menor preço</option>
              <option value="preco-maior">Maior preço</option>
              <option value="nome">Nome A–Z</option>
            </select>
          </div>

          {loading || loadError ? (
            <CatalogState loading={loading} error={loadError} label="produtos" onRetry={() => { setLoading(true); setLoadError(''); setReloadKey((value) => value + 1) }} />
          ) : filtered.length ? (
            <div className="store-results__grid">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} onCompare={toggleCompare} selected={compare.some((item) => String(item.id) === String(product.id))} />
              ))}
            </div>
          ) : (
            <div className="store-empty"><strong>Nenhum produto encontrado.</strong><p>Altere a busca ou remova algum filtro.</p><button className="button button--secondary" type="button" onClick={clearFilters}>Limpar filtros</button></div>
          )}
        </main>
      </section>

      {compare.length > 0 && (
        <div className="store-compare-bar">
          <div className="page-container store-compare-bar__inner">
            <div>
              <strong>{compare.length}/2 selecionado{compare.length === 1 ? '' : 's'}</strong>
              <span>{compare.map((item) => item.name).join(' × ')} · compare somente produtos da mesma categoria</span>
            </div>
            <div>
              <button className="button button--secondary" type="button" onClick={() => { setCompare([]); setComparisonItems([]); setComparisonOpen(false); setCompareMessage('') }}>Limpar</button>
              <button className="button button--primary" type="button" disabled={compare.length !== 2 || comparisonLoading} onClick={openComparison}>{comparisonLoading ? 'Carregando…' : 'Comparar agora'}</button>
            </div>
          </div>
          {compareMessage && <p className="store-compare-bar__message" role="status">{compareMessage}</p>}
        </div>
      )}

      {comparisonOpen && activeComparison.length === 2 && (
        <div className="store-dialog-backdrop" role="presentation" onMouseDown={() => setComparisonOpen(false)}>
          <section className="store-comparison" ref={comparisonDialogRef} role="dialog" aria-modal="true" aria-labelledby="store-comparison-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="store-comparison__header">
              <div><span className="eyebrow">{activeComparison[0].category}</span><h2 id="store-comparison-title">Comparação de produtos</h2></div>
              <button type="button" aria-label="Fechar" onClick={() => setComparisonOpen(false)}>×</button>
            </header>
            <div className="store-comparison__table">
              <div className="store-comparison__row store-comparison__row--head"><strong>Especificação</strong><strong>{activeComparison[0].name}</strong><strong>{activeComparison[1].name}</strong></div>
              {fields.map(([label, key, better, suffix = '']) => {
                const values = activeComparison.map((item) => item.specs?.[key])
                const winner = winnerIndex(values, better)
                return (
                  <div className="store-comparison__row" key={key}>
                    <span>{label}</span>
                    {values.map((value, index) => <span className={winner === index ? 'is-better' : ''} key={`${key}-${activeComparison[index].id}`}>{formatSpecValue(value, suffix)}</span>)}
                  </div>
                )
              })}
              <div className="store-comparison__row">
                <span>Preço</span>
                {activeComparison.map((item, index) => {
                  const winner = winnerIndex(activeComparison.map((p) => p.price), 'lower')
                  return <span className={winner === index ? 'is-better' : ''} key={`price-${item.id}`}>{formatPrice(item.price)}</span>
                })}
              </div>
              <div className="store-comparison__row"><span>Ofertas ativas</span>{activeComparison.map((item) => <span key={`offers-${item.id}`}>{item.offers?.length || 0}</span>)}</div>
            </div>
            <p className="store-comparison__note">O verde aparece apenas quando existe uma vantagem objetiva definida para aquele campo. Potência da fonte e outros atributos dependentes do contexto permanecem neutros.</p>
          </section>
        </div>
      )}
    </div>
  )
}
