import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { savedBuildsService } from '../../services/savedBuildsService'
import './SavedBuildDetails.css'

const formatPrice = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value) || 0)

const formatDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
}

export default function SavedBuildDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const storageOwner = user?.email || '__local__'
  const build = savedBuildsService.get(storageOwner, id)

  if (!build) return <Navigate to="/minhas-builds" replace />

  const components = Array.isArray(build.componentes) ? build.componentes : []

  async function shareBuild() {
    const url = savedBuildsService.createBuilderUrl(build)
    if (navigator.share) {
      try {
        await navigator.share({ title: build.nome || 'Build CriaByte', url })
        return
      } catch (error) {
        if (error?.name === 'AbortError') return
      }
    }
    await navigator.clipboard.writeText(url)
    window.alert('Link da build copiado.')
  }

  function renameBuild() {
    const name = window.prompt('Novo nome da build:', build.nome || 'Minha build')
    if (!name?.trim()) return
    savedBuildsService.rename(storageOwner, build.id, name)
    navigate('/minhas-builds', { replace: true })
  }

  function deleteBuild() {
    if (!window.confirm(`Excluir “${build.nome || 'esta build'}”?`)) return
    savedBuildsService.remove(storageOwner, build.id)
    navigate('/minhas-builds', { replace: true })
  }


  function publishBuild() {
    try {
      sessionStorage.setItem('pcBuilderPublicacaoPendente', JSON.stringify({ ...build, pendentePublicacao: true }))
    } catch {
      // Se o navegador bloquear o sessionStorage, a tela de publicação ainda pode usar builds salvas da conta.
    }
    navigate('/comunidade/publicar')
  }

  function downloadJson() {
    const blob = new Blob([savedBuildsService.exportJson(build)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${String(build.nome || 'build').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="saved-build-detail">
      <div className="page-container">
        <Link className="saved-build-detail__back" to="/minhas-builds">← Voltar para minhas builds</Link>

        <section className="saved-build-detail__hero">
          <div>
            <span className="eyebrow">Build salva</span>
            <h1>{build.nome || 'Build sem nome'}</h1>
            <p>Salva em {formatDate(build.criadaEm)} · atualizada em {formatDate(build.atualizadaEm || build.criadaEm)}.</p>
          </div>
          <div className="saved-build-detail__actions">
            <Link className="button button--primary" to={savedBuildsService.createEditBuilderPath(build)}>Editar build</Link>
            <a className="button button--secondary" href={savedBuildsService.createBuilderUrl(build)}>Abrir no 3D</a>
            <button className="button button--secondary" type="button" onClick={shareBuild}>Compartilhar</button>
            <button className="button button--secondary" type="button" onClick={renameBuild}>Renomear</button>
          </div>
        </section>

        <section className="saved-build-detail__summary">
          <article><span>Preço salvo</span><strong>{Number(build.precoTotal) ? formatPrice(build.precoTotal) : 'Não calculado'}</strong></article>
          <article><span>Consumo salvo</span><strong>{Number(build.consumoTotal) ? `${build.consumoTotal} W` : 'Não calculado'}</strong></article>
          <article><span>Componentes</span><strong>{Number(build.quantidade) || components.length || 0}</strong></article>
        </section>

        <section className="saved-build-detail__section">
          <header>
            <span className="eyebrow">Configuração</span>
            <h2>Componentes salvos</h2>
            <p>Os preços exibidos aqui são os valores registrados no momento em que a build foi salva e podem mudar ao longo do tempo.</p>
          </header>

          {components.length ? (
            <div className="saved-build-detail__components">
              {components.map((component, index) => (
                <article key={`${component.slot}-${component.nome}-${index}`}>
                  <div>
                    <span>{component.categoria || component.slot || 'Componente'}</span>
                    <strong>{component.nome || 'Componente'}</strong>
                  </div>
                  <strong>{Number(component.preco) ? formatPrice(component.preco) : '—'}</strong>
                </article>
              ))}
            </div>
          ) : (
            <p className="saved-build-detail__empty">Esta build possui a configuração necessária para abrir no 3D, mas não contém um resumo textual dos componentes.</p>
          )}
        </section>

        <section className="saved-build-detail__transition">
          <div>
            <span className="eyebrow">Ações da build</span>
            <h2>Continue com esta configuração</h2>
            <p>Use “Editar build” para alterar os componentes e salvar por cima desta mesma build. Você também pode abrir uma cópia no 3D, compartilhar ou publicar na Comunidade.</p>
          </div>
          <div className="saved-build-detail__transition-actions">
            <Link className="button button--primary" to={savedBuildsService.createEditBuilderPath(build)}>Editar componentes</Link>
            <button className="button button--secondary" type="button" onClick={publishBuild}>Publicar na comunidade</button>
            <button className="button button--secondary" type="button" onClick={downloadJson}>Exportar JSON</button>
            <button className="button saved-build-detail__delete" type="button" onClick={deleteBuild}>Excluir build</button>
          </div>
        </section>
      </div>
    </main>
  )
}
