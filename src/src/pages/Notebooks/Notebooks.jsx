import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import NotebookCard from '../../components/NotebookCard/NotebookCard'
import CatalogState from '../../components/CatalogState/CatalogState'
import { getNotebooks } from '../../services/notebooksService'
import useAccessibleDialog from '../../hooks/useAccessibleDialog'
import './Notebooks.css'

const normalize = (value) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const validTextOptions = (values) => [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean).filter((value) => value !== '—'))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
const validNumberOptions = (values) => [...new Set(values.map(Number).filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b)

const fields = [
  ['Processador', 'cpu'],
  ['GPU', 'gpu'],
  ['Modelo da RAM', 'ramModel'],
  ['Memória RAM', 'ramGb', 'higher', ' GB'],
  ['Tipo da RAM', 'ramType'],
  ['Armazenamento', 'storageLabel'],
  ['Tela', 'screenInches', null, '”'],
  ['Resolução', 'resolution'],
  ['Peso', 'weightKg', 'lower', ' kg'],
]

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })

function winnerIndex(values, better) {
  if (!better || values.length !== 2) return -1
  const numeric = values.map(Number)
  if (numeric.some((value) => !Number.isFinite(value) || value <= 0) || numeric[0] === numeric[1]) return -1
  if (better === 'lower') return numeric[0] < numeric[1] ? 0 : 1
  return numeric[0] > numeric[1] ? 0 : 1
}

export default function Notebooks() {
  const [notebooks, setNotebooks] = useState([])
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('todos')
  const [use, setUse] = useState('todos')
  const [cpuBrand, setCpuBrand] = useState('todos')
  const [gpu, setGpu] = useState('todos')
  const [ram, setRam] = useState('todos')
  const [screen, setScreen] = useState('todos')
  const [maxPrice, setMaxPrice] = useState('todos')
  const [sortBy, setSortBy] = useState('relevancia')
  const [compare, setCompare] = useState([])
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const comparisonDialogRef = useAccessibleDialog(comparisonOpen, setComparisonOpen)

  useEffect(() => {
    let active = true
    getNotebooks().then((items) => {
      if (!active) return
      setNotebooks(Array.isArray(items) ? items : [])
    }).catch((error) => {
      if (!active) return
      setNotebooks([])
      setLoadError(error?.message || 'Não foi possível consultar os notebooks agora.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const brands = useMemo(() => validTextOptions(notebooks.map((item) => item.brand)), [notebooks])
  const uses = useMemo(() => validTextOptions(notebooks.map((item) => item.use)), [notebooks])
  const cpuBrands = useMemo(() => validTextOptions(notebooks.map((item) => item.specs?.cpuBrand)), [notebooks])
  const ramOptions = useMemo(() => validNumberOptions(notebooks.map((item) => item.specs?.ramGb)), [notebooks])
  const screenOptions = useMemo(() => validNumberOptions(notebooks.map((item) => item.specs?.screenInches)), [notebooks])

  const filtered = useMemo(() => {
    const text = normalize(query)
    const max = maxPrice === 'todos' ? Infinity : Number(maxPrice)
    const items = notebooks.filter((notebook) => {
      const haystack = normalize([
        notebook.name, notebook.brand, notebook.model, notebook.use, notebook.description,
        notebook.specs?.cpu, notebook.specs?.gpu, ...(Array.isArray(notebook.tags) ? notebook.tags : []),
      ].join(' '))
      return (!text || haystack.includes(text))
        && (brand === 'todos' || notebook.brand === brand)
        && (use === 'todos' || notebook.use === use)
        && (cpuBrand === 'todos' || notebook.specs?.cpuBrand === cpuBrand)
        && (gpu === 'todos' || (gpu === 'dedicada' ? notebook.specs?.dedicatedGpu : !notebook.specs?.dedicatedGpu))
        && (ram === 'todos' || notebook.specs?.ramGb === Number(ram))
        && (screen === 'todos' || notebook.specs?.screenInches === Number(screen))
        && notebook.price <= max
    })

    return [...items].sort((a, b) => {
      if (sortBy === 'preco-menor') return a.price - b.price
      if (sortBy === 'preco-maior') return b.price - a.price
      if (sortBy === 'avaliacao') return b.rating - a.rating || b.reviewsCount - a.reviewsCount
      if (sortBy === 'mais-ofertas') return (b.offers?.length || 0) - (a.offers?.length || 0)
      if (sortBy === 'mais-leve') return Number(a.specs?.weightKg || Infinity) - Number(b.specs?.weightKg || Infinity)
      return (b.rating * Math.log10(b.reviewsCount + 10)) - (a.rating * Math.log10(a.reviewsCount + 10))
    })
  }, [notebooks, query, brand, use, cpuBrand, gpu, ram, screen, maxPrice, sortBy])

  const toggleCompare = (notebook) => {
    setCompare((current) => {
      if (current.some((item) => item.id === notebook.id)) return current.filter((item) => item.id !== notebook.id)
      if (current.length >= 2) return [current[1], notebook]
      return [...current, notebook]
    })
  }

  const clearFilters = () => {
    setQuery(''); setBrand('todos'); setUse('todos'); setCpuBrand('todos'); setGpu('todos')
    setRam('todos'); setScreen('todos'); setMaxPrice('todos'); setSortBy('relevancia')
  }

  return (
    <main className="notebooks-page">
      <section className="notebooks-hero">
        <div className="page-container notebooks-hero__inner">
          <div>
            <span className="eyebrow">Catálogo dedicado</span>
            <h1>Notebooks com comparação <span>técnica de verdade.</span></h1>
            <p>Compare processador, GPU, memória, possibilidade de upgrade, tela, bateria e peso antes de escolher.</p>
          </div>
          <aside>
            <span>Escolha com mais contexto</span>
            <strong>Especificações, upgrades e ofertas</strong>
            <p>Compare os detalhes que realmente mudam a experiência de uso.</p>
          </aside>
        </div>
      </section>

      <section className="page-container notebooks-layout">
        <aside className="notebooks-filters">
          <div className="notebooks-filters__heading"><div><span className="eyebrow">Refine</span><h2>Filtros</h2></div><button onClick={clearFilters}>Limpar</button></div>
          <label><span>Pesquisar</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Notebook, CPU, GPU..." /></label>
          <label><span>Marca</span><select value={brand} onChange={(e) => setBrand(e.target.value)}><option value="todos">Todas</option>{brands.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Uso</span><select value={use} onChange={(e) => setUse(e.target.value)}><option value="todos">Todos</option>{uses.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Processador</span><select value={cpuBrand} onChange={(e) => setCpuBrand(e.target.value)}><option value="todos">Todos</option>{cpuBrands.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>GPU</span><select value={gpu} onChange={(e) => setGpu(e.target.value)}><option value="todos">Todas</option><option value="dedicada">Dedicada</option><option value="integrada">Integrada</option></select></label>
          <label><span>Memória</span><select value={ram} onChange={(e) => setRam(e.target.value)}><option value="todos">Qualquer</option>{ramOptions.map((item) => <option key={item} value={item}>{item} GB</option>)}</select></label>
          <label><span>Tela</span><select value={screen} onChange={(e) => setScreen(e.target.value)}><option value="todos">Qualquer</option>{screenOptions.map((item) => <option key={item} value={item}>{item}”</option>)}</select></label>
          <label><span>Preço máximo</span><select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}><option value="todos">Sem limite</option><option value="3000">Até R$ 3.000</option><option value="4000">Até R$ 4.000</option><option value="5000">Até R$ 5.000</option><option value="6000">Até R$ 6.000</option><option value="7000">Até R$ 7.000</option></select></label>
        </aside>

        <div className="notebooks-results">
          <header className="notebooks-results__toolbar">
            <div><strong>{filtered.length} notebook{filtered.length === 1 ? '' : 's'}</strong><span>Selecione até 2 modelos para comparar.</span></div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Ordenar notebooks">
              <option value="relevancia">Mais relevantes</option><option value="avaliacao">Melhor avaliados</option>
              <option value="mais-ofertas">Mais ofertas</option><option value="preco-menor">Menor preço</option>
              <option value="preco-maior">Maior preço</option><option value="mais-leve">Menor peso</option>
            </select>
          </header>

          {loading || loadError ? <CatalogState loading={loading} error={loadError} label="notebooks" onRetry={() => { setLoading(true); setLoadError(''); setReloadKey((value) => value + 1) }} />
            : filtered.length ? <div className="notebooks-grid">{filtered.map((notebook) => <NotebookCard key={notebook.id} notebook={notebook} onCompare={toggleCompare} selected={compare.some((item) => item.id === notebook.id)} />)}</div>
            : <div className="notebooks-empty"><h3>Nenhum notebook encontrado</h3><p>Altere os filtros para visualizar outros modelos.</p><button className="button button--secondary" onClick={clearFilters}>Limpar filtros</button></div>}
        </div>
      </section>

      {typeof document !== 'undefined' && compare.length > 0 && createPortal(
        <aside className="notebooks-compare-dock" aria-label="Notebooks selecionados para comparação">
          <div className="notebooks-compare-dock__heading">
            <div>
              <strong>Comparar notebooks</strong>
              <span>{compare.length}/2 selecionado{compare.length === 1 ? '' : 's'}</span>
            </div>
            <button className="notebooks-compare-dock__clear" type="button" onClick={() => { setCompare([]); setComparisonOpen(false) }}>Limpar</button>
          </div>

          <div className="notebooks-compare-dock__slots">
            {[0, 1].map((slot) => {
              const item = compare[slot]
              return item ? (
                <div className="notebooks-compare-dock__item" key={String(item.id)}>
                  <div className="notebooks-compare-dock__thumb">
                    {item.image ? <img src={item.image} alt="" /> : <span>NB</span>}
                  </div>
                  <div className="notebooks-compare-dock__item-copy">
                    <small>{item.brand || 'Notebook'}</small>
                    <strong>{item.name}</strong>
                  </div>
                  <button type="button" className="notebooks-compare-dock__remove" aria-label={`Remover ${item.name} da comparação`} onClick={() => toggleCompare(item)}>×</button>
                </div>
              ) : (
                <div className="notebooks-compare-dock__item notebooks-compare-dock__item--empty" key={`empty-${slot}`}>
                  <span className="notebooks-compare-dock__plus">+</span>
                  <div className="notebooks-compare-dock__item-copy">
                    <small>Segundo notebook</small>
                    <strong>Selecione outro notebook</strong>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            className="button button--primary notebooks-compare-dock__compare"
            type="button"
            disabled={compare.length !== 2}
            onClick={() => setComparisonOpen(true)}
          >
            {compare.length === 2 ? 'Abrir comparação' : 'Selecione 2 notebooks'}
          </button>
        </aside>,
        document.body,
      )}

      {typeof document !== 'undefined' && comparisonOpen && compare.length === 2 && createPortal(
        <div className="notebooks-dialog" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setComparisonOpen(false) }}>
          <section className="notebooks-comparison" ref={comparisonDialogRef} role="dialog" aria-modal="true" aria-labelledby="notebook-comparison-title">
            <header><div><span className="eyebrow">Comparação</span><h2 id="notebook-comparison-title">Notebook lado a lado</h2></div><button onClick={() => setComparisonOpen(false)} aria-label="Fechar comparação">×</button></header>
            <div className="notebooks-comparison__table">
              <div className="notebooks-comparison__row notebooks-comparison__row--head"><strong>Especificação</strong>{compare.map((item) => <strong key={item.id}>{item.name}</strong>)}</div>
              {fields.map(([label, key, better, suffix = '']) => {
                const values = compare.map((item) => item.specs?.[key])
                const winner = winnerIndex(values, better)
                return <div className="notebooks-comparison__row" key={key}><span>{label}</span>{values.map((value, index) => {
                  const hasValue = value !== null && value !== undefined && value !== '' && !(typeof value === 'number' && value <= 0)
                  return <span className={winner === index ? 'is-better' : ''} key={`${key}-${compare[index].id}`}>{hasValue ? `${value}${typeof value === 'number' ? suffix : ''}` : '-'}</span>
                })}</div>
              })}
              <div className="notebooks-comparison__row"><span>Preço</span>{compare.map((item, index) => { const winner = winnerIndex(compare.map((n) => n.price), 'lower'); return <span className={winner === index ? 'is-better' : ''} key={item.id}>{Number(item.price) > 0 ? money.format(item.price) : '-'}</span> })}</div>
            </div>
            <p className="notebooks-comparison__note">Campos sem informação cadastrada aparecem como “-”. O destaque verde é usado apenas quando existe uma vantagem objetiva, como mais memória, menor peso ou menor preço.</p>
          </section>
        </div>,
        document.body,
      )}
    </main>
  )
}
