import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import MountedPcCard from '../../components/MountedPcCard/MountedPcCard'
import CatalogState from '../../components/CatalogState/CatalogState'
import { getMountedPcs } from '../../services/mountedPcsService'
import useAccessibleDialog from '../../hooks/useAccessibleDialog'
import './MountedPcs.css'

const formatPrice = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value)

const normalizeText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()

const comparisonFields = [
  { label: 'Categoria', value: (pc) => pc.category },
  { label: 'Processador', value: (pc) => pc.cpu },
  { label: 'TDP do processador', number: (pc) => pc.cpuTdp, format: (v) => v ? `${v} W` : '—', better: 'lower' },
  { label: 'Placa de vídeo', value: (pc) => pc.gpu },
  { label: 'TGP / consumo da GPU', number: (pc) => pc.gpuTgp, format: (v) => v ? `${v} W` : '—', better: 'lower' },
  { label: 'Placa-mãe', value: (pc) => pc.motherboard },
  { label: 'Memória RAM total', number: (pc) => pc.ramGb, format: (v) => `${v} GB`, better: 'higher' },
  { label: 'Armazenamento total', number: (pc) => pc.storageGb, format: (v) => v >= 1024 ? `${v / 1024} TB` : `${v} GB`, better: 'higher' },
  { label: 'Fonte', value: (pc) => pc.powerSupply },
  { label: 'Potência da fonte', number: (pc) => pc.powerSupplyWatts, format: (v) => `${v} W` },
  { label: 'Cooler', value: (pc) => pc.cooler },
  { label: 'Gabinete', value: (pc) => pc.case },
  { label: 'Ventoinhas', number: (pc) => pc.fans, format: (v) => String(v) },
  { label: 'Consumo estimado', number: (pc) => pc.estimatedConsumption, format: (v) => `${v} W`, better: 'lower' },
  { label: 'Preço', number: (pc) => pc.price, format: formatPrice, better: 'lower' },
  { label: 'Ofertas ativas', number: (pc) => pc.offersCount, format: (v) => String(v) },
]

function winningIndex(values, better) {
  if (!better || values.length !== 2) return -1
  if (values.some((value) => !Number.isFinite(Number(value)))) return -1
  if (Number(values[0]) === Number(values[1])) return -1
  if (better === 'lower') return Number(values[0]) < Number(values[1]) ? 0 : 1
  return Number(values[0]) > Number(values[1]) ? 0 : 1
}

export default function MountedPcs() {
  const [pcs, setPcs] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('todos')
  const [usage, setUsage] = useState('todos')
  const [maxPrice, setMaxPrice] = useState('todos')
  const [sortBy, setSortBy] = useState('relevancia')
  const [compare, setCompare] = useState([])
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [searchParams, setSearchParams] = useSearchParams()
  const comparisonDialogRef = useAccessibleDialog(comparisonOpen, setComparisonOpen)

  useEffect(() => {
    let active = true
    getMountedPcs().then((items) => {
      if (!active) return
      const safeItems = Array.isArray(items) ? items : []
      setPcs(safeItems)
      const requested = searchParams.get('comparar')
      if (requested) {
        const found = safeItems.find((pc) => String(pc.id) === String(requested))
        if (found) setCompare([found])
        setSearchParams({}, { replace: true })
      }
    }).catch((error) => {
      if (!active) return
      setPcs([])
      setLoadError(error?.message || 'Não foi possível consultar os PCs montados agora.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey, searchParams, setSearchParams])

  const categories = useMemo(() => [...new Set(pcs.map((pc) => pc.category))], [pcs])
  const usages = useMemo(() => [...new Set(pcs.map((pc) => pc.usage))], [pcs])

  const filtered = useMemo(() => {
    const text = normalizeText(query)
    const max = maxPrice === 'todos' ? Infinity : Number(maxPrice)

    const result = pcs.filter((pc) => {
      const haystack = normalizeText([pc.name, pc.cpu, pc.gpu, pc.ram, pc.storage, pc.category].join(' '))
      return (!text || haystack.includes(text))
        && (category === 'todos' || pc.category === category)
        && (usage === 'todos' || pc.usage === usage)
        && pc.price <= max
    })

    return [...result].sort((a, b) => {
      if (sortBy === 'preco-menor') return a.price - b.price
      if (sortBy === 'preco-maior') return b.price - a.price
      if (sortBy === 'avaliacao') return b.rating - a.rating || b.reviewsCount - a.reviewsCount
      if (sortBy === 'ofertas') return b.offersCount - a.offersCount
      return (b.rating * Math.log10(b.reviewsCount + 10)) - (a.rating * Math.log10(a.reviewsCount + 10))
    })
  }, [pcs, query, category, usage, maxPrice, sortBy])

  const toggleCompare = (pc) => {
    setCompare((current) => {
      const exists = current.some((item) => item.id === pc.id)
      if (exists) return current.filter((item) => item.id !== pc.id)
      if (current.length >= 2) return [current[1], pc]
      return [...current, pc]
    })
  }

  const clearFilters = () => {
    setQuery('')
    setCategory('todos')
    setUsage('todos')
    setMaxPrice('todos')
    setSortBy('relevancia')
  }

  return (
    <div className="mounted-page">
      <section className="mounted-page__hero">
        <div className="page-container">
          <span className="eyebrow">Computadores completos</span>
          <h1>PCs Montados</h1>
          <p>Compare configurações prontas, avaliações, quantidade de ofertas e preços antes de escolher.</p>
        </div>
      </section>

      <section className="page-container mounted-page__content">
        <aside className="mounted-filters" aria-label="Filtros de PCs montados">
          <div className="mounted-filters__heading">
            <div>
              <span className="eyebrow">Refine a busca</span>
              <h2>Filtros</h2>
            </div>
            <button type="button" onClick={clearFilters}>Limpar</button>
          </div>

          <label className="mounted-field mounted-field--search">
            <span>Pesquisar</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="CPU, GPU, nome..." />
          </label>

          <label className="mounted-field">
            <span>Categoria</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="todos">Todas</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="mounted-field">
            <span>Uso</span>
            <select value={usage} onChange={(event) => setUsage(event.target.value)}>
              <option value="todos">Todos</option>
              {usages.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="mounted-field">
            <span>Preço máximo</span>
            <select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
              <option value="todos">Qualquer preço</option>
              <option value="3000">Até R$ 3.000</option>
              <option value="5000">Até R$ 5.000</option>
              <option value="7000">Até R$ 7.000</option>
              <option value="10000">Até R$ 10.000</option>
            </select>
          </label>
        </aside>

        <main className="mounted-results">
          <div className="mounted-results__toolbar">
            <div>
              <strong>{filtered.length} PC{filtered.length === 1 ? '' : 's'} encontrado{filtered.length === 1 ? '' : 's'}</strong>
              <span>Compare configurações, avaliações e ofertas disponíveis.</span>
            </div>
            <label>
              <span className="sr-only">Ordenar</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="relevancia">Relevância</option>
                <option value="avaliacao">Melhor avaliação</option>
                <option value="ofertas">Mais ofertas</option>
                <option value="preco-menor">Menor preço</option>
                <option value="preco-maior">Maior preço</option>
              </select>
            </label>
          </div>

          {loading || loadError ? (
            <CatalogState loading={loading} error={loadError} label="PCs montados" onRetry={() => { setLoading(true); setLoadError(''); setReloadKey((value) => value + 1) }} />
          ) : filtered.length ? (
            <div className="mounted-results__grid">
              {filtered.map((pc) => (
                <MountedPcCard
                  key={pc.id}
                  pc={pc}
                  onCompare={toggleCompare}
                  selected={compare.some((item) => item.id === pc.id)}
                />
              ))}
            </div>
          ) : (
            <div className="mounted-empty">
              <strong>Nenhum computador encontrado.</strong>
              <p>Tente remover algum filtro ou alterar a pesquisa.</p>
              <button type="button" className="button button--secondary" onClick={clearFilters}>Limpar filtros</button>
            </div>
          )}
        </main>
      </section>

      {compare.length > 0 && (
        <div className="mounted-compare-bar" role="region" aria-label="Comparação de PCs">
          <div className="page-container mounted-compare-bar__inner">
            <div>
              <strong>{compare.length}/2 selecionado{compare.length === 1 ? '' : 's'}</strong>
              <span>{compare.map((pc) => pc.name).join(' × ')}</span>
            </div>
            <div>
              <button className="button button--secondary" type="button" onClick={() => setCompare([])}>Limpar</button>
              <button className="button button--primary" type="button" disabled={compare.length !== 2} onClick={() => setComparisonOpen(true)}>Comparar agora</button>
            </div>
          </div>
        </div>
      )}

      {comparisonOpen && compare.length === 2 && (
        <div className="mounted-dialog-backdrop" role="presentation" onMouseDown={() => setComparisonOpen(false)}>
          <section className="mounted-comparison" ref={comparisonDialogRef} role="dialog" aria-modal="true" aria-labelledby="mounted-comparison-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="mounted-comparison__header">
              <div>
                <span className="eyebrow">Comparação lado a lado</span>
                <h2 id="mounted-comparison-title">Compare os PCs selecionados</h2>
              </div>
              <button type="button" className="mounted-comparison__close" aria-label="Fechar comparação" onClick={() => setComparisonOpen(false)}>×</button>
            </header>

            <div className="mounted-comparison__table">
              <div className="mounted-comparison__row mounted-comparison__row--head">
                <strong>Especificação</strong>
                <strong>{compare[0].name}</strong>
                <strong>{compare[1].name}</strong>
              </div>
              {comparisonFields.map((field) => {
                const rawValues = field.number ? compare.map(field.number) : compare.map(field.value)
                const winner = field.number ? winningIndex(rawValues, field.better) : -1
                return (
                  <div className="mounted-comparison__row" key={field.label}>
                    <span>{field.label}</span>
                    {rawValues.map((value, index) => (
                      <span key={`${field.label}-${compare[index].id}`} className={index === winner ? 'is-better' : ''}>
                        {field.format ? field.format(value) : value || '—'}
                      </span>
                    ))}
                  </div>
                )
              })}
            </div>
            <p className="mounted-comparison__note">Verde indica apenas vantagem objetiva no campo: menor consumo/TDP/TGP/preço ou maior RAM/armazenamento. Potência da fonte permanece neutra.</p>
          </section>
        </div>
      )}
    </div>
  )
}
