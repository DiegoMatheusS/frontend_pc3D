import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BuildCard from '../../components/BuildCard/BuildCard'
import { listarBuilds } from '../../services/communityService'
import './Community.css'

const orderOptions = [
  ['RECENTES', 'Recentes'],
  ['MAIS_COPIADAS', 'Mais copiadas'],
]

const purposeOptions = [
  ['', 'Todas as finalidades'],
  ['GAMER', 'Gamer'],
  ['TRABALHO', 'Trabalho'],
  ['PROGRAMACAO', 'Programação'],
  ['EDICAO', 'Edição'],
  ['STREAMING', 'Streaming'],
  ['WORKSTATION', 'Workstation'],
  ['USO_GERAL', 'Uso geral'],
]

const resolutionOptions = [
  ['', 'Todas as resoluções'],
  ['NAO_APLICAVEL', 'Não aplicável'],
  ['1080P', '1080p'],
  ['1440P', '1440p'],
  ['4K', '4K'],
]

export default function Community() {
  const [builds, setBuilds] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [order, setOrder] = useState('RECENTES')
  const [purpose, setPurpose] = useState('')
  const [resolution, setResolution] = useState('')
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      if (active) setLoading(true)
      try {
        const data = await listarBuilds({
          busca: search,
          finalidade: purpose,
          resolucao: resolution,
          ordenar: order,
          limite: 50,
        })
        if (!active) return
        setBuilds(Array.isArray(data) ? data : [])
        setLoadError('')
      } catch (error) {
        if (!active) return
        setBuilds([])
        setLoadError(error?.message || 'Não foi possível carregar as builds.')
      } finally {
        if (active) setLoading(false)
      }
    }, search ? 260 : 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [order, purpose, resolution, reloadKey, search])

  return (
    <>
      <section className="community-hero">
        <div className="page-container community-hero__inner">
          <div>
            <span className="eyebrow">Ajuda, dúvidas e builds reais</span>
            <h1>Builds da Comunidade</h1>
            <p>
              Compartilhe o PC que você montou em casa, peça sugestões de upgrade e ajude outras pessoas
              usando configurações estruturadas do CriaByte.
            </p>
          </div>
          <Link className="button button--primary community-create" to="/comunidade/publicar">
            Publicar minha build
          </Link>
        </div>
      </section>

      <section className="community-content">
        <div className="page-container">
          <div className="community-toolbar">
            <label className="community-search">
              <span className="sr-only">Pesquisar builds</span>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                placeholder="Pesquisar título ou descrição..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="community-selects">
              <label>
                <span className="sr-only">Finalidade</span>
                <select value={purpose} onChange={(event) => setPurpose(event.target.value)}>
                  {purposeOptions.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Resolução</span>
                <select value={resolution} onChange={(event) => setResolution(event.target.value)}>
                  {resolutionOptions.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}
                </select>
              </label>
            </div>

            <div className="community-filters" aria-label="Ordenar builds">
              {orderOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={order === value ? 'is-active' : ''}
                  onClick={() => setOrder(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="community-heading-row">
            <div>
              <h2>Builds compartilhadas</h2>
              <p>Explore configurações publicadas, filtre por finalidade e encontre ideias para a sua próxima montagem.</p>
            </div>
            <strong>{builds.length} builds</strong>
          </div>

          {loading ? (
            <div className="community-state community-state--loading"><span className="community-loader" aria-hidden="true" />Carregando builds…</div>
          ) : loadError ? (
            <div className="community-state" role="alert">
              <strong>Não foi possível carregar a Comunidade.</strong>
              <span>{loadError}</span>
              <button className="button button--secondary" type="button" onClick={() => setReloadKey((value) => value + 1)}>Tentar novamente</button>
            </div>
          ) : builds.length > 0 ? (
            <div className="community-grid">
              {builds.map((build, index) => <BuildCard key={build.id ?? `build-${index}`} build={build} />)}
            </div>
          ) : (
            <div className="community-state">
              <strong>Nenhuma build encontrada.</strong>
              <span>Altere os filtros ou publique a primeira build desta seleção.</span>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
