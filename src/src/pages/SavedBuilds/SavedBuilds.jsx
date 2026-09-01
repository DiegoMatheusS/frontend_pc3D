import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { listarMinhasBuilds, removerBuildComunidade } from '../../services/communityService'
import { savedBuildsService } from '../../services/savedBuildsService'
import './SavedBuilds.css'

const formatPrice = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value) || 0)

const formatDate = (value, onlyDate = false) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', onlyDate
    ? { dateStyle: 'short' }
    : { dateStyle: 'short', timeStyle: 'short' })
}

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export default function SavedBuilds() {
  const { user } = useAuth()
  const storageOwner = user?.email || '__local__'
  const [builds, setBuilds] = useState(() => savedBuildsService.list(storageOwner))
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recentes')
  const [message, setMessage] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importName, setImportName] = useState('')
  const [importError, setImportError] = useState('')
  const [draft, setDraft] = useState(() => savedBuildsService.getDraft())
  const [communityBuilds, setCommunityBuilds] = useState([])
  const [communityLoading, setCommunityLoading] = useState(Boolean(user))
  const [communityError, setCommunityError] = useState('')
  const [removingCommunityId, setRemovingCommunityId] = useState(null)
  const importDialogRef = useRef(null)

  useEffect(() => {
    if (!user) return undefined

    let active = true
    queueMicrotask(() => {
      if (active) setCommunityLoading(true)
    })
    listarMinhasBuilds(user)
      .then((items) => {
        if (!active) return
        setCommunityBuilds(Array.isArray(items) ? items : [])
        setCommunityError('')
      })
      .catch((requestError) => {
        if (!active) return
        setCommunityBuilds([])
        setCommunityError(requestError?.message || 'Não foi possível carregar suas publicações.')
      })
      .finally(() => {
        if (active) setCommunityLoading(false)
      })

    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (!importOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const dialog = importDialogRef.current
    const firstField = dialog?.querySelector('textarea, input, button')
    window.requestAnimationFrame(() => firstField?.focus())

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setImportOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [importOpen])

  const visibleBuilds = useMemo(() => {
    const term = normalize(search.trim())
    const filtered = builds.filter((build) => {
      const haystack = normalize([
        build.nome,
        ...(build.componentes || []).flatMap((item) => [item.nome, item.categoria, item.slot]),
      ].filter(Boolean).join(' '))
      return !term || haystack.includes(term)
    })

    return [...filtered].sort((a, b) => {
      if (sort === 'antigas') return new Date(a.criadaEm) - new Date(b.criadaEm)
      if (sort === 'nome') return String(a.nome).localeCompare(String(b.nome), 'pt-BR')
      if (sort === 'preco-maior') return (Number(b.precoTotal) || 0) - (Number(a.precoTotal) || 0)
      if (sort === 'preco-menor') return (Number(a.precoTotal) || 0) - (Number(b.precoTotal) || 0)
      return new Date(b.atualizadaEm || b.criadaEm) - new Date(a.atualizadaEm || a.criadaEm)
    })
  }, [builds, search, sort])

  const totalValue = builds.reduce((sum, build) => sum + (Number(build.precoTotal) || 0), 0)
  const lastUpdate = builds
    .map((build) => new Date(build.atualizadaEm || build.criadaEm).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0]

  
  function renameBuild(build) {
    const nextName = window.prompt('Novo nome da build:', build.nome || 'Minha build')
    if (!nextName?.trim()) return
    setBuilds(savedBuildsService.rename(storageOwner, build.id, nextName))
    setMessage('Build renomeada.')
  }

  function removeBuild(build) {
    if (!window.confirm(`Excluir “${build.nome || 'esta build'}”?`)) return
    setBuilds(savedBuildsService.remove(storageOwner, build.id))
    setMessage('Build excluída.')
  }

  async function removeCommunityBuild(build) {
    if (!window.confirm(
      `Remover “${build.title || 'esta build'}” da Comunidade?\n\nEla deixará de ficar visível publicamente. Comentários e avaliações serão preservados.`,
    )) return

    setRemovingCommunityId(build.id)
    setCommunityError('')
    try {
      await removerBuildComunidade(build.id)
      setCommunityBuilds((items) => items.filter((item) => String(item.id) !== String(build.id)))
      setMessage('Publicação removida da Comunidade.')
    } catch (requestError) {
      setCommunityError(requestError?.message || 'Não foi possível remover a publicação.')
    } finally {
      setRemovingCommunityId(null)
    }
  }

  async function shareBuild(build) {
    const url = savedBuildsService.createBuilderUrl(build)
    try {
      if (navigator.share) {
        await navigator.share({
          title: build.nome || 'Build CriaByte',
          text: 'Confira esta configuração no CriaByte.',
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      setMessage('Link da build copiado.')
    } catch (error) {
      if (error?.name !== 'AbortError') setMessage('Não foi possível compartilhar a build.')
    }
  }

  function saveDraft() {
    if (!draft) return
    const defaultName = `Rascunho ${new Date().toLocaleDateString('pt-BR')}`
    const name = window.prompt('Nome da build:', defaultName)
    if (!name?.trim()) return
    const nextBuilds = savedBuildsService.saveDraft(storageOwner, draft, name)
    setBuilds(nextBuilds)
    setDraft(null)
    setMessage('Rascunho salvo nas suas builds.')
  }

  function handleImport(event) {
    event.preventDefault()
    setImportError('')
    try {
      const result = savedBuildsService.importFromSharedUrl(storageOwner, importUrl, importName)
      setBuilds(result.builds)
      setImportOpen(false)
      setImportUrl('')
      setImportName('')
      setMessage('Build importada com sucesso.')
    } catch (error) {
      setImportError(error.message)
    }
  }

  return (
    <main className="saved-builds-page">
      <div className="page-container">
        <header className="saved-builds-heading">
          <div>
            <span className="eyebrow">Sua conta</span>
            <h1>Minhas builds</h1>
            <p>Organize suas configurações, volte ao Montador 3D e compartilhe cada build por link.</p>
          </div>
          <div className="saved-builds-heading__actions">
            <button className="button button--secondary" type="button" onClick={() => setImportOpen(true)}>Importar build</button>
            <Link className="button button--primary" to="/montar">＋ Montar novo PC</Link>
          </div>
        </header>

        <section className="saved-builds-profile">
          <div className="saved-builds-avatar" aria-hidden="true">
            {user
              ? (user.nome || 'CB').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
              : 'PC'}
          </div>
          <div>
            <strong>{user?.nome || 'Builds locais deste navegador'}</strong>
            <span>{user?.email || 'As builds deste navegador ficam disponíveis neste dispositivo.'}</span>
          </div>
          {!user && <Link className="button button--secondary" to="/entrar?retorno=%2Fminhas-builds">Entrar</Link>}
        </section>

        <section className="saved-builds-metrics" aria-label="Resumo das builds">
          <article><span>Builds salvas</span><strong>{builds.length}</strong></article>
          <article><span>Valor combinado</span><strong>{formatPrice(totalValue)}</strong></article>
          <article><span>Última alteração</span><strong>{lastUpdate ? formatDate(lastUpdate, true) : '—'}</strong></article>
        </section>

        {draft && (
          <section className="saved-builds-draft">
            <div>
              <span className="eyebrow">Salvamento automático</span>
              <h2>Existe uma montagem em andamento</h2>
              <p>Rascunho atualizado em {formatDate(draft.atualizadaEm)}.</p>
            </div>
            <div>
              <button className="button button--primary" type="button" onClick={saveDraft}>Salvar nas builds</button>
              <a className="button button--secondary" href={savedBuildsService.createBuilderUrl({ configuracao: draft.configuracao })}>Abrir no 3D</a>
            </div>
          </section>
        )}

        <section className="saved-builds-toolbar" aria-label="Pesquisa e ordenação">
          <label>
            <span>Pesquisar</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Nome ou componente..." />
          </label>
          <label>
            <span>Ordenar</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="recentes">Mais recentes</option>
              <option value="antigas">Mais antigas</option>
              <option value="nome">Nome</option>
              <option value="preco-maior">Maior preço</option>
              <option value="preco-menor">Menor preço</option>
            </select>
          </label>
        </section>

        {message && <p className="saved-builds-message" role="status">{message}</p>}

        {builds.length === 0 ? (
          <section className="saved-builds-empty">
            <span aria-hidden="true">▦</span>
            <h2>Nenhuma build salva ainda</h2>
            <p>Monte um PC do zero ou importe um link compartilhado para começar.</p>
            <Link className="button button--primary" to="/montar">Abrir Montador 3D</Link>
          </section>
        ) : (
          <>
            <p className="saved-builds-result">{visibleBuilds.length} de {builds.length} build(s).</p>
            <section className="saved-builds-grid">
              {visibleBuilds.map((build) => {
                const components = Array.isArray(build.componentes) ? build.componentes : []
                const remaining = Math.max(0, components.length - 5)
                return (
                  <article className="saved-build-card" key={build.id}>
                    <header>
                      <div>
                        <h2>{build.nome || 'Build sem nome'}</h2>
                        <time>{formatDate(build.atualizadaEm || build.criadaEm)}</time>
                      </div>
                      <span>Salva</span>
                    </header>

                    <div className="saved-build-card__metrics">
                      <div><span>Preço salvo</span><strong>{Number(build.precoTotal) ? formatPrice(build.precoTotal) : '—'}</strong></div>
                      <div><span>Componentes</span><strong>{Number(build.quantidade) || components.length || 0}</strong></div>
                    </div>

                    <ul>
                      {components.slice(0, 5).map((component, index) => (
                        <li key={`${component.slot}-${component.nome}-${index}`}>
                          <span>{component.nome || 'Componente'}</span>
                          <small>{component.categoria || component.slot || 'Peça'}</small>
                        </li>
                      ))}
                      {!components.length && <li><span>Configuração pronta para o 3D</span><small>Build</small></li>}
                      {remaining > 0 && <li><span>Mais {remaining} componente(s)</span><small>＋</small></li>}
                    </ul>

                    <div className="saved-build-card__actions">
                      <Link className="button button--secondary" to={`/minhas-builds/${build.id}`}>Detalhes</Link>
                      <Link className="button button--primary" to={savedBuildsService.createEditBuilderPath(build)}>Editar build</Link>
                      {build.communityBuildId && <Link className="button button--secondary" to={`/comunidade/${build.communityBuildId}`}>Ver publicação</Link>}
                      <button className="button button--secondary" type="button" onClick={() => shareBuild(build)}>Compartilhar</button>
                      <button className="button button--secondary" type="button" onClick={() => renameBuild(build)}>Renomear</button>
                      <button className="button saved-build-card__delete" type="button" onClick={() => removeBuild(build)}>Excluir</button>
                    </div>
                  </article>
                )
              })}
            </section>
          </>
        )}

        {user && (
          <section className="saved-community-section" aria-labelledby="saved-community-title">
            <div className="saved-community-section__heading">
              <div>
                <span className="eyebrow">Comunidade</span>
                <h2 id="saved-community-title">Minhas publicações</h2>
                <p>Excluir uma build salva neste navegador não remove sua publicação. As publicações são gerenciadas separadamente aqui.</p>
              </div>
              <Link className="button button--secondary" to="/comunidade/publicar">Publicar build</Link>
            </div>

            {communityLoading ? (
              <p className="saved-builds-result">Carregando publicações…</p>
            ) : communityError ? (
              <p className="saved-builds-community-error" role="alert">{communityError}</p>
            ) : communityBuilds.length === 0 ? (
              <div className="saved-community-empty">Você ainda não possui builds ativas na Comunidade.</div>
            ) : (
              <div className="saved-community-grid">
                {communityBuilds.map((build) => (
                  <article className="saved-community-card" key={build.id}>
                    <div>
                      <span className="saved-community-card__status">{build.status || 'RASCUNHO'} · {build.visibility || 'PRIVADA'}</span>
                      <h3>{build.title}</h3>
                      <p>{build.cpu} · {build.gpu}</p>
                    </div>
                    <div className="saved-community-card__metrics">
                      <span>{Number(build.commentsCount) || 0} comentários</span>
                      <span>{Number(build.views) || 0} visualizações</span>
                    </div>
                    <div className="saved-community-card__actions">
                      <Link className="button button--secondary" to={`/comunidade/${build.id}`}>Ver publicação</Link>
                      <Link className="button button--secondary" to={`/comunidade/publicar?editar=${build.id}`}>Editar publicação</Link>
                      <button
                        className="button saved-build-card__delete"
                        type="button"
                        disabled={String(removingCommunityId) === String(build.id)}
                        onClick={() => removeCommunityBuild(build)}
                      >
                        {String(removingCommunityId) === String(build.id) ? 'Removendo…' : 'Remover da Comunidade'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {importOpen && createPortal(
        <div className="saved-builds-modal" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setImportOpen(false)
        }}>
          <form
            ref={importDialogRef}
            className="saved-builds-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-builds-import-title"
            onSubmit={handleImport}
          >
            <span className="eyebrow">Importar</span>
            <h2 id="saved-builds-import-title">Importar build compartilhada</h2>
            <p>Cole um link compartilhado do CriaByte. Builds antigas e novas usam o mesmo formato de configuração.</p>
            <label>
              <span>Link da build</span>
              <textarea value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="Cole aqui o link compartilhado da build" required />
            </label>
            <label>
              <span>Nome opcional</span>
              <input value={importName} onChange={(event) => setImportName(event.target.value)} placeholder="Minha build" />
            </label>
            {importError && <p className="saved-builds-modal__error">{importError}</p>}
            <div className="saved-builds-modal__actions">
              <button className="button button--secondary" type="button" onClick={() => setImportOpen(false)}>Cancelar</button>
              <button className="button button--primary" type="submit">Importar</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </main>
  )
}
