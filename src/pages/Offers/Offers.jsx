import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import OfferCard from '../../components/OfferCard/OfferCard'
import CatalogState from '../../components/CatalogState/CatalogState'
import { getOfferGroups, getOffers } from '../../services/offersService'
import './Offers.css'

function normalize(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function discountOf(item) {
  if (!item.previousPrice || item.previousPrice <= item.price) return 0
  return ((item.previousPrice - item.price) / item.previousPrice) * 100
}

export default function Offers() {
  const [groups, setGroups] = useState([])
  const [offers, setOffers] = useState([])
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('todos')
  const [budget, setBudget] = useState('todos')
  const [sort, setSort] = useState('relevancia')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([getOfferGroups(), getOffers()]).then(([groupData, offerData]) => {
      if (!active) return
      setGroups(Array.isArray(groupData) ? groupData : [])
      setOffers(Array.isArray(offerData) ? offerData : [])
    }).catch((error) => {
      if (!active) return
      setGroups([])
      setOffers([])
      setLoadError(error?.message || 'Não foi possível consultar as ofertas agora.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const selectedProduct = Number(searchParams.get('produto'))
  const selectedItem = selectedProduct ? offers.find((offer) => offer.id === selectedProduct) : null
  const effectiveSearch = selectedItem ? selectedItem.name : search
  const effectiveGroup = selectedItem ? selectedItem.group : group

  const filtered = useMemo(() => {
    const term = normalize(effectiveSearch.trim())

    const result = offers.filter((item) => {
      if (effectiveGroup !== 'todos' && item.group !== effectiveGroup) return false

      if (budget !== 'todos') {
        const [min, max] = budget.split('-').map(Number)
        if (item.price < min) return false
        if (max && item.price > max) return false
      }

      if (term) {
        const haystack = normalize([
          item.name,
          item.brand,
          item.category,
          item.context,
          item.bestStore,
          ...(item.tags ?? []),
        ].join(' '))
        if (!haystack.includes(term)) return false
      }

      return true
    })

    return [...result].sort((a, b) => {
      if (sort === 'menor-preco') return a.price - b.price
      if (sort === 'maior-preco') return b.price - a.price
      if (sort === 'maior-desconto') return discountOf(b) - discountOf(a)
      if (sort === 'mais-ofertas') return b.offersCount - a.offersCount
      return (b.offersCount * 10 + discountOf(b)) - (a.offersCount * 10 + discountOf(a))
    })
  }, [offers, effectiveSearch, effectiveGroup, budget, sort])

  const grouped = useMemo(() => {
    return groups
      .map((groupInfo) => ({
        ...groupInfo,
        products: filtered.filter((item) => item.group === groupInfo.id),
      }))
      .filter((groupInfo) => groupInfo.products.length)
  }, [filtered, groups])

  const resetFilters = () => {
    setSearch('')
    setGroup('todos')
    setBudget('todos')
    setSort('relevancia')
    setSearchParams({})
  }

  const selectGroup = (value) => {
    setGroup(value)
    setSearchParams({})
  }

  return (
    <main className="offers-page">
      <section className="offers-hero">
        <div className="page-container offers-hero__inner">
          <div>
            <span className="eyebrow">Produtos organizados por categoria</span>
            <h1>Ofertas sem misturar <span>hardware, periféricos e setup.</span></h1>
            <p>
              Encontre oportunidades em grupos claros, compare lojas e veja a melhor oferta ativa de cada produto sem duplicar itens no catálogo.
            </p>
            <div className="offers-hero__chips" aria-label="Grupos disponíveis">
              {groups.map((item) => <span key={item.id}>{item.label}</span>)}
            </div>
          </div>

          <aside className="offers-hero__summary">
            <span>Compare antes de comprar</span>
            <strong>Preço, lojas e disponibilidade</strong>
            <p>Veja as opções cadastradas e abra a loja que fizer mais sentido para você.</p>
          </aside>
        </div>
      </section>

      <section className="offers-content">
        <div className="page-container">
          <header className="offers-section-header">
            <div>
              <span className="eyebrow">Compare com calma</span>
              <h2>Ofertas por categoria</h2>
              <p>Pesquise um produto ou abra apenas o grupo que você quer analisar.</p>
            </div>
            <strong className="offers-count">{filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}</strong>
          </header>

          <div className="offers-group-tabs" aria-label="Filtrar ofertas por grupo">
            <button
              type="button"
              className={effectiveGroup === 'todos' ? 'is-active' : ''}
              onClick={() => selectGroup('todos')}
            >
              Todos
            </button>
            {groups.map((item) => (
              <button
                key={item.id}
                type="button"
                className={effectiveGroup === item.id ? 'is-active' : ''}
                onClick={() => selectGroup(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="offers-filters">
            <label className="offers-field offers-field--search">
              <span>Pesquisar</span>
              <input
                type="search"
                value={effectiveSearch}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setSearchParams({})
                }}
                placeholder="Produto, marca, categoria..."
              />
            </label>

            <label className="offers-field">
              <span>Preço</span>
              <select value={budget} onChange={(event) => setBudget(event.target.value)}>
                <option value="todos">Qualquer valor</option>
                <option value="0-500">Até R$ 500</option>
                <option value="500-1000">R$ 500 a R$ 1.000</option>
                <option value="1000-2000">R$ 1.000 a R$ 2.000</option>
                <option value="2000-4000">R$ 2.000 a R$ 4.000</option>
                <option value="4000-0">Acima de R$ 4.000</option>
              </select>
            </label>

            <label className="offers-field">
              <span>Ordenar</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="relevancia">Mais relevantes</option>
                <option value="menor-preco">Menor preço</option>
                <option value="maior-preco">Maior preço</option>
                <option value="maior-desconto">Maior desconto</option>
                <option value="mais-ofertas">Mais ofertas</option>
              </select>
            </label>

            <button type="button" className="offers-clear" onClick={resetFilters}>Limpar</button>
          </div>

          {loading || loadError ? (
            <CatalogState loading={loading} error={loadError} label="ofertas" onRetry={() => { setLoading(true); setLoadError(''); setReloadKey((value) => value + 1) }} />
          ) : grouped.length ? (
            <div className="offers-sections">
              {grouped.map((section) => (
                <section className="offers-category" key={section.id}>
                  <header className="offers-category__header">
                    <div>
                      <h3>{section.label}</h3>
                      <p>{section.description}</p>
                    </div>
                    <span>{section.products.length} {section.products.length === 1 ? 'item' : 'itens'}</span>
                  </header>

                  <div className="offers-grid">
                    {section.products.map((product) => (
                      <OfferCard key={product.id} product={product} compact={false} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="offers-empty">
              <span aria-hidden="true">◇</span>
              <h3>Nenhuma oferta encontrada</h3>
              <p>Altere a busca ou os filtros para voltar a visualizar os produtos.</p>
              <button type="button" className="button button--secondary" onClick={resetFilters}>Limpar filtros</button>
            </div>
          )}

          <div className="offers-price-example">
            <div>
              <span className="eyebrow">Compare melhor</span>
              <h2>Um produto, várias lojas.</h2>
              <p>Abra o produto para comparar as ofertas disponíveis, conferir a loja e escolher a opção que fizer mais sentido.</p>
            </div>
            <div className="offers-price-example__box">
              <small>Na página do produto</small>
              <strong>Compare as lojas disponíveis</strong>
              <span>Menor preço válido em destaque</span>
              <em>Preço e disponibilidade conforme as ofertas cadastradas</em>
            </div>
          </div>
        </div>
      </section>

      <section className="offers-builder-cta">
        <div className="page-container offers-builder-cta__inner">
          <div>
            <span>Quer escolher as peças antes de olhar preço?</span>
            <strong>Monte a configuração e depois consulte as ofertas.</strong>
          </div>
          <Link className="button button--primary" to="/montar">Abrir montador 3D</Link>
        </div>
      </section>
    </main>
  )
}
