import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  adicionarComentario,
  buscarBuildPorSlug,
  copiarBuildComunidade,
  editarComentarioComunidade,
  listarComentarios,
  removerBuildComunidade,
  removerComentarioComunidade,
} from '../../services/communityService'
import { savedBuildsService } from '../../services/savedBuildsService'
import { useAuth } from '../../contexts/authContext'
import ReviewsPanel from '../../components/ReviewsPanel/ReviewsPanel'
import { asNumber, asText, formatCurrency, formatRating, safeInitials } from '../../utils/display'
import { setDocumentMeta } from '../../utils/pageMeta'
import './CommunityBuild.css'

function compatibilityLabel(value) {
  if (value === 'COMPATIVEL') return { text: 'Compatível', className: 'is-compatible' }
  if (value === 'INCOMPATIVEL') return { text: 'Incompatível', className: 'has-error' }
  if (value === 'COMPATIVEL_COM_ALERTAS') return { text: 'Compatível com alertas', className: 'has-warning' }
  return { text: 'Compatibilidade não informada', className: 'is-neutral' }
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function savedComponentsFromCommunity(build) {
  return (Array.isArray(build?.components) ? build.components : []).map((component, index) => ({
    categoria: component.categoria || component.hardware?.categoria || 'Componente',
    categoriaCodigo: component.categoria || component.hardware?.categoria || '',
    hardwareId: component.hardwareId ?? component.hardware?.id ?? null,
    slot: component.posicao || `Componente ${index + 1}`,
    posicao: component.posicao || null,
    nome: component.nome || component.hardware?.nome || component.modelo || 'Componente',
    marca: component.marca || component.hardware?.marca || '',
    modelo: component.modelo || component.hardware?.modelo || '',
    quantidade: Math.max(1, Number(component.quantidade) || 1),
  }))
}

export default function CommunityBuild() {
  const { slug } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [build, setBuild] = useState(undefined)
  const [draft, setDraft] = useState('')
  const [comments, setComments] = useState([])
  const [commentsCount, setCommentsCount] = useState(0)
  const [replyTo, setReplyTo] = useState(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copying, setCopying] = useState(false)
  const [preparingEdit, setPreparingEdit] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let ativo = true
    buscarBuildPorSlug(slug).then(async (data) => {
      if (!ativo) return
      setBuild(data)
      setCommentsCount(asNumber(data?.commentsCount, 0))

      if (data?.id) {
        try {
          const loadedComments = await listarComentarios(data.id, user)
          if (!ativo) return
          const normalizedComments = Array.isArray(loadedComments) ? loadedComments : []
          setComments(normalizedComments)
          const total = normalizedComments.reduce((sum, item) => sum + 1 + (item.replies?.length || 0), 0)
          setCommentsCount(Math.max(asNumber(data?.commentsCount, 0), total))
        } catch {
          if (ativo) setComments(Array.isArray(data?.comments) ? data.comments : [])
        }
      } else {
        setComments(Array.isArray(data?.comments) ? data.comments : [])
      }
    }).catch(() => { if (ativo) setBuild(null) })
    return () => { ativo = false }
  }, [slug, user])

  useEffect(() => {
    if (!build) return
    setDocumentMeta({
      title: `${build.title} — Comunidade CriaByte`,
      description: build.description || `Veja a configuração ${build.title}, componentes, avaliações e comentários.`,
    })
  }, [build])

  const builderPath = useMemo(() => build
    ? savedBuildsService.createBuilderPath({ configuracao: build.builderConfiguration })
    : '/montar', [build])

  if (build === undefined) return <div className="page-container build-detail-state">Carregando build…</div>
  if (!build) return <div className="page-container build-detail-state"><strong>Build não encontrada.</strong><Link to="/comunidade">Voltar para a comunidade</Link></div>

  const returnPath = `${location.pathname}${location.search}`
  const compatibility = compatibilityLabel(build.compatibility)
  const hasReviews = asNumber(build.reviewsCount, 0) > 0
  const publicationPrice = asNumber(build.price, 0)
  const currentPrice = asNumber(build.currentPrice, 0)
  const currentCoverage = build.currentPriceCoverage || { priced: 0, total: 0 }
  const displayedPrice = publicationPrice > 0 ? publicationPrice : currentPrice
  const priceLabel = publicationPrice > 0
    ? 'Preço na publicação'
    : build.currentPriceComplete
      ? 'Preço atual das peças'
      : currentPrice > 0
        ? 'Preço parcial atual'
        : 'Preço das peças'
  const canManage = Boolean(user && (
    String(build.authorId || '') === String(user.id || '')
    || String(user.papel || '').toUpperCase() === 'ADMIN'
  ))

  async function usarComoBase() {
    if (!user) {
      navigate(`/entrar?retorno=${encodeURIComponent(returnPath)}`)
      return
    }
    setCopying(true); setError(''); setMessage('')
    try {
      await copiarBuildComunidade(build.id)
      setBuild((current) => current ? { ...current, copies: asNumber(current.copies, 0) + 1 } : current)
      navigate(builderPath)
    } catch (requestError) {
      setError(requestError?.message || 'Não foi possível copiar esta build.')
    } finally {
      setCopying(false)
    }
  }

  function abrirEdicaoComponentes() {
    if (!canManage) return
    setPreparingEdit(true)
    setError('')
    setMessage('')
    try {
      const owner = user?.email || '__local__'
      const componentes = savedComponentsFromCommunity(build)
      const metadata = {
        nome: build.title,
        precoTotal: displayedPrice,
        consumoTotal: asNumber(build.consumption, 0),
        quantidade: componentes.reduce((total, item) => total + Math.max(1, Number(item.quantidade) || 1), 0),
        componentes,
        communityBuildId: build.id,
      }

      const existing = savedBuildsService.findByCommunityBuildId(owner, build.id)
      const result = existing
        ? savedBuildsService.updateConfiguration(owner, existing.id, build.builderConfiguration, metadata)
        : savedBuildsService.saveConfiguration(owner, build.builderConfiguration, build.title, metadata)

      const editable = result?.build || result
      if (!editable) throw new Error('Não foi possível preparar a build para edição.')
      navigate(savedBuildsService.createEditBuilderPath(editable))
    } catch (editError) {
      setError(editError?.message || 'Não foi possível abrir a build para edição.')
      setPreparingEdit(false)
    }
  }

  async function removerPublicacao() {
    if (!canManage || removing) return
    const confirmed = window.confirm(
      'Remover esta build da Comunidade?\n\nEla deixará de ficar visível publicamente. Comentários e avaliações serão preservados no banco.',
    )
    if (!confirmed) return

    setRemoving(true)
    setError('')
    setMessage('')
    try {
      await removerBuildComunidade(build.id)
      navigate('/comunidade', { replace: true })
    } catch (requestError) {
      setError(requestError?.message || 'Não foi possível remover esta build da Comunidade.')
      setRemoving(false)
    }
  }

  async function editarComentario(commentId, currentText, parentId = null) {
    const nextText = window.prompt('Editar comentário:', currentText || '')
    if (!nextText?.trim() || nextText.trim() === currentText) return

    setError('')
    setMessage('')
    try {
      const updated = await editarComentarioComunidade(commentId, nextText.trim(), user)
      setComments((items) => items.map((item) => {
        if (String(item.id) === String(commentId)) return { ...item, ...updated, replies: item.replies || [] }
        if (parentId && String(item.id) === String(parentId)) {
          return {
            ...item,
            replies: (item.replies || []).map((reply) => (
              String(reply.id) === String(commentId) ? { ...reply, ...updated } : reply
            )),
          }
        }
        return item
      }))
      setMessage('Comentário atualizado.')
    } catch (requestError) {
      setError(requestError?.message || 'Não foi possível editar o comentário.')
    }
  }

  async function removerComentario(commentId, parentId = null) {
    if (!window.confirm('Remover este comentário? As respostas existentes serão preservadas.')) return

    setError('')
    setMessage('')
    try {
      await removerComentarioComunidade(commentId)
      setComments((items) => items.map((item) => {
        if (String(item.id) === String(commentId)) {
          return { ...item, text: 'Comentário removido.', removed: true }
        }
        if (parentId && String(item.id) === String(parentId)) {
          return {
            ...item,
            replies: (item.replies || []).map((reply) => (
              String(reply.id) === String(commentId)
                ? { ...reply, text: 'Comentário removido.', removed: true }
                : reply
            )),
          }
        }
        return item
      }))
      setCommentsCount((value) => Math.max(0, value - 1))
      setMessage('Comentário removido.')
    } catch (requestError) {
      setError(requestError?.message || 'Não foi possível remover o comentário.')
    }
  }

  async function enviarComentario(event) {
    event.preventDefault()
    if (!user) return
    const text = draft.trim()
    if (!text) return
    setSubmitting(true); setError(''); setMessage('')
    try {
      const saved = await adicionarComentario(build.id, { texto: text }, user)
      setComments((items) => [...items, saved])
      setCommentsCount((value) => value + 1)
      setDraft('')
      setMessage('Comentário publicado.')
    } catch (requestError) {
      setError(requestError?.message || 'Não foi possível publicar o comentário.')
    } finally { setSubmitting(false) }
  }

  async function enviarResposta(parentId) {
    if (!user) return
    const text = replyDraft.trim()
    if (!text) return
    setSubmitting(true); setError(''); setMessage('')
    try {
      const saved = await adicionarComentario(build.id, { texto: text, comentarioPaiId: parentId }, user)
      setComments((items) => items.map((item) => String(item.id) === String(parentId)
        ? { ...item, replies: [...(item.replies || []), saved] }
        : item))
      setCommentsCount((value) => value + 1)
      setReplyDraft(''); setReplyTo(null); setMessage('Resposta publicada.')
    } catch (requestError) {
      setError(requestError?.message || 'Não foi possível publicar a resposta.')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="page-container build-detail">
      <Link className="build-detail__back" to="/comunidade">← Voltar para a comunidade</Link>

      <header className="build-detail__hero">
        <div>
          <div className="build-detail__meta">
            <span>{build.purpose}</span><span>{build.resolution}</span>
            <span className={compatibility.className}>{compatibility.text}</span>
          </div>
          <h1>{build.title}</h1>
          <p className="build-detail__author">por <strong>{build.author}</strong></p>
          <p className="build-detail__description">{build.description}</p>
        </div>
        <aside className="build-detail__score">{hasReviews ? <><strong>★ {formatRating(build.rating)}</strong><span>{asNumber(build.reviewsCount, 0)} avaliações</span></> : <><strong>{asNumber(build.views, 0)}</strong><span>visualizações</span></>}<span>{commentsCount} comentários/respostas</span><span>{asNumber(build.copies, 0)} cópias</span></aside>
      </header>

      <div className="build-detail__actions">
        <Link className="button button--primary" to={builderPath}>Abrir build completa no 3D</Link>
        <button className="button button--secondary" type="button" onClick={usarComoBase} disabled={copying}>{copying ? 'Copiando…' : 'Usar esta build'}</button>
        <Link className="button button--secondary" to="/ofertas">Onde comprar</Link>
      </div>

      {canManage && (
        <section className="build-owner-actions" aria-label="Gerenciar sua publicação">
          <div>
            <span className="eyebrow">Sua publicação</span>
            <strong>Você pode editar ou remover esta build.</strong>
            <p>A remoção é lógica: a publicação sai da Comunidade, mas comentários e avaliações permanecem preservados.</p>
          </div>
          <div className="build-owner-actions__buttons">
            <Link className="button button--secondary" to={`/comunidade/publicar?editar=${encodeURIComponent(build.id)}`}>Editar publicação</Link>
            <button className="button button--secondary" type="button" onClick={abrirEdicaoComponentes} disabled={preparingEdit}>{preparingEdit ? 'Abrindo…' : 'Editar componentes no 3D'}</button>
            <button className="button build-owner-actions__remove" type="button" onClick={removerPublicacao} disabled={removing}>{removing ? 'Removendo…' : 'Remover da Comunidade'}</button>
          </div>
        </section>
      )}

      {message && <p className="discussion-message discussion-message--success" role="status">{message}</p>}
      {error && <p className="discussion-message discussion-message--error" role="alert">{error}</p>}

      <div className="build-detail__grid">
        <section className="detail-panel">
          <div className="detail-panel__heading">
            <span>Configuração</span>
            <strong>{displayedPrice > 0 ? formatCurrency(displayedPrice) : 'Preço não disponível'}</strong>
          </div>
          {publicationPrice <= 0 && currentPrice > 0 && (
            <p className="build-price-note">
              {build.currentPriceComplete
                ? 'Valor calculado pelas ofertas atuais das peças vinculadas ao catálogo.'
                : `Valor parcial: ${asNumber(currentCoverage.priced, 0)} de ${asNumber(currentCoverage.total, 0)} peça(s) possuem oferta atual.`}
            </p>
          )}
          <dl className="component-list">
            <div><dt>Processador</dt><dd>{build.cpu}</dd></div><div><dt>Placa de vídeo</dt><dd>{build.gpu}</dd></div><div><dt>Placa-mãe</dt><dd>{build.motherboard}</dd></div><div><dt>Memória</dt><dd>{build.ram}</dd></div><div><dt>Armazenamento</dt><dd>{build.storage}</dd></div><div><dt>Fonte</dt><dd>{build.psu}</dd></div>
          </dl>
        </section>
        <aside className="detail-panel build-summary">
          <div><span>Consumo na publicação</span><strong>{asNumber(build.consumption, 0) > 0 ? `${asNumber(build.consumption, 0)} W` : '—'}</strong></div>
          <div><span>{priceLabel}</span><strong>{displayedPrice > 0 ? formatCurrency(displayedPrice) : 'Sem oferta'}</strong></div>
          <div><span>Visualizações</span><strong>{asNumber(build.views, 0)}</strong></div>
          <div><span>Status</span><strong>{asText(build.status, 'PUBLICADA')}</strong></div>
        </aside>
      </div>

      <ReviewsPanel entityType="build" entityId={build.id} initialRating={build.rating} initialCount={build.reviewsCount} title="Avaliar esta build" intro="A nota é separada da discussão técnica abaixo." />

      <section className="discussion-section">
        <header><span className="eyebrow">Fórum da build</span><h2>Dúvidas e comentários</h2><p>Converse sobre upgrades, temperaturas, compatibilidade e experiência real com a montagem.</p></header>

        {user ? (
          <form className="comment-form" onSubmit={enviarComentario}>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escreva uma dúvida ou comentário..." minLength={2} maxLength={3000} required />
            <div><small>Comentário vinculado à sua sessão: {user.nome}.</small><button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Publicando…' : 'Comentar'}</button></div>
          </form>
        ) : (
          <div className="discussion-login"><p>Entre na sua conta para deixar uma dúvida, comentário ou resposta.</p><Link className="button button--secondary" to={`/entrar?retorno=${encodeURIComponent(returnPath)}`}>Entrar para comentar</Link></div>
        )}

        <div className="comment-list">
          {comments.length === 0 ? <div className="empty-comments">Ainda não há comentários nesta build.</div> : comments.map((comment) => (
            <article className="comment" key={comment.id}>
              <div className="comment__avatar" aria-hidden="true">{safeInitials(comment.author, 'US')}</div>
              <div className="comment__body">
                <header><strong>{comment.author}</strong><span>{formatTime(comment.time)}</span></header>
                <p>{comment.text}</p>
                {user && !comment.removed && (
                  <div className="comment__actions">
                    <button type="button" onClick={() => { setReplyTo(replyTo === comment.id ? null : comment.id); setReplyDraft('') }}>{replyTo === comment.id ? 'Cancelar resposta' : 'Responder'}</button>
                    {comment.own && <button type="button" onClick={() => editarComentario(comment.id, comment.text)}>Editar</button>}
                    {(comment.own || String(user.papel || '').toUpperCase() === 'ADMIN') && <button className="is-danger" type="button" onClick={() => removerComentario(comment.id)}>Remover</button>}
                  </div>
                )}
                {replyTo === comment.id && user && <div className="comment__reply-form"><textarea value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} maxLength={3000} placeholder={`Responder a ${asText(comment.author, 'usuário')}...`} /><button className="button button--primary" type="button" disabled={submitting || !replyDraft.trim()} onClick={() => enviarResposta(comment.id)}>Enviar resposta</button></div>}
                {comment.replies?.length > 0 && <div className="comment__replies">{comment.replies.map((reply) => <article className="comment comment--reply" key={reply.id}><div className="comment__avatar" aria-hidden="true">{safeInitials(reply.author, 'US')}</div><div className="comment__body"><header><strong>{reply.author}</strong><span>{formatTime(reply.time)}</span></header><p>{reply.text}</p>{user && !reply.removed && <div className="comment__actions">{reply.own && <button type="button" onClick={() => editarComentario(reply.id, reply.text, comment.id)}>Editar</button>}{(reply.own || String(user.papel || '').toUpperCase() === 'ADMIN') && <button className="is-danger" type="button" onClick={() => removerComentario(reply.id, comment.id)}>Remover</button>}</div>}</div></article>)}</div>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
