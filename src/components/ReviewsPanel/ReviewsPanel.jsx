import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { listReviews, submitReview } from '../../services/reviewsService'
import { asArray, asNumber, asText, formatRating, safeInitials } from '../../utils/display'
import './ReviewsPanel.css'


const BUILD_RATING_STORAGE_KEY = 'criaByteCommunityRatings:v1'

function buildRatingIdentity(entityId, userId) {
  return `${String(entityId)}:${String(userId)}`
}

function readBuildRating(entityId, userId) {
  if (typeof localStorage === 'undefined' || !entityId || !userId) return null
  try {
    const store = JSON.parse(localStorage.getItem(BUILD_RATING_STORAGE_KEY) || '{}')
    const value = Number(store?.[buildRatingIdentity(entityId, userId)]?.rating ?? store?.[buildRatingIdentity(entityId, userId)])
    return value >= 1 && value <= 5 ? value : null
  } catch {
    return null
  }
}

function saveBuildRating(entityId, userId, rating) {
  if (typeof localStorage === 'undefined' || !entityId || !userId) return
  try {
    const store = JSON.parse(localStorage.getItem(BUILD_RATING_STORAGE_KEY) || '{}')
    store[buildRatingIdentity(entityId, userId)] = { rating: Number(rating), savedAt: new Date().toISOString() }
    localStorage.setItem(BUILD_RATING_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // A avaliação já foi salva no backend; falhar ao persistir o bloqueio local não deve quebrar a tela.
  }
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date)
}

export default function ReviewsPanel({ entityType, entityId, initialRating = 0, initialCount = 0, title = 'Avaliações', intro = '' }) {
  const { user } = useAuth()
  const location = useLocation()
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submittedBuildRatings, setSubmittedBuildRatings] = useState({})

  const buildRatingKey = entityType === 'build' && user?.id
    ? buildRatingIdentity(entityId, user.id)
    : ''
  const persistedBuildRating = buildRatingKey
    ? (submittedBuildRatings[buildRatingKey] ?? readBuildRating(entityId, user.id))
    : null
  const buildRatingLocked = entityType === 'build' && persistedBuildRating !== null

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) setLoading(true) })
    listReviews(entityType, entityId)
      .then((result) => {
        if (!active) return
        setItems(asArray(result?.items))
        setSummary(result?.summary || null)
      })
      .catch((requestError) => {
        if (active) setError(requestError?.message || 'Não foi possível carregar as avaliações.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [entityId, entityType])

  const aggregate = useMemo(() => {
    if (summary?.count) return summary
    const localCount = items.length
    const localTotal = items.reduce((total, item) => total + asNumber(item.rating, 0), 0)
    const baseCount = asNumber(initialCount, 0)
    const baseRating = asNumber(initialRating, 0)
    const count = baseCount + localCount
    const weighted = (baseRating * baseCount) + localTotal
    return { rating: count ? weighted / count : baseRating, count }
  }, [initialCount, initialRating, items, summary])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!user || buildRatingLocked) return
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const saved = await submitReview(entityType, entityId, {
        rating,
        comment: comment.trim(),
        userId: user.id,
        email: user.email,
        author: user.nome,
      })
      setItems((current) => {
        const withoutOwn = current.filter((item) => !(item.own && item.author === saved.author))
        return [saved, ...withoutOwn]
      })
      setComment('')
      if (entityType === 'build') {
        const savedRating = asNumber(saved?.rating, rating)
        saveBuildRating(entityId, user.id, savedRating)
        setSubmittedBuildRatings((current) => ({ ...current, [buildRatingKey]: savedRating }))
        setMessage('Sua nota foi registrada e não poderá ser alterada.')
      } else {
        setMessage('Sua avaliação foi registrada.')
      }
      if (saved?._summary) setSummary(saved._summary)

      if (entityType !== 'build') {
        try {
          const refreshed = await listReviews(entityType, entityId)
          setItems(asArray(refreshed?.items))
          setSummary(refreshed?.summary || null)
        } catch {
          if (!saved?._summary) setSummary(null)
        }
      }
    } catch (requestError) {
      setError(requestError?.message || 'Não foi possível registrar sua avaliação.')
    } finally {
      setSubmitting(false)
    }
  }

  const returnPath = `${location.pathname}${location.search}`

  return (
    <section className="reviews-panel">
      <header className="reviews-panel__header">
        <div>
          <span className="eyebrow">Opiniões</span>
          <h2>{title}</h2>
          {intro && <p>{intro}</p>}
        </div>
        <div className="reviews-panel__score" aria-label={`Nota média ${formatRating(aggregate.rating)} de 5`}>
          <strong>★ {formatRating(aggregate.rating)}</strong>
          <span>{aggregate.count} avaliação{aggregate.count === 1 ? '' : 'ões'}</span>
        </div>
      </header>

      {user ? (
        buildRatingLocked ? (
          <div className="reviews-panel__locked" role="status">
            <div>
              <strong>Você já avaliou esta build.</strong>
              <span>★ {persistedBuildRating}/5</span>
            </div>
            <p>A avaliação de uma build é única e não pode ser alterada pelo site.</p>
          </div>
        ) : (
        <form className="reviews-panel__form" onSubmit={handleSubmit}>
          <div className="reviews-panel__stars" role="radiogroup" aria-label="Sua nota">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                className={value <= rating ? 'is-active' : ''}
                onClick={() => setRating(value)}
                title={`${value} estrela${value === 1 ? '' : 's'}`}
              >★</button>
            ))}
            <span>{rating}/5</span>
          </div>
          {entityType !== 'build' && <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Conte sua experiência ou opinião..."
            minLength={3}
            maxLength={3000}
            required
          />}
          <div className="reviews-panel__form-footer">
            <small>{entityType === 'build' ? 'A discussão e as respostas ficam na seção de comentários abaixo.' : 'Você pode atualizar sua avaliação enviando uma nova nota.'}</small>
            <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Enviando…' : entityType === 'build' ? 'Enviar nota' : 'Enviar avaliação'}</button>
          </div>
          {message && <p className="reviews-panel__message reviews-panel__message--success" role="status">{message}</p>}
          {error && <p className="reviews-panel__message reviews-panel__message--error" role="alert">{error}</p>}
        </form>
        )
      ) : (
        <div className="reviews-panel__login">
          <p>Entre na sua conta para avaliar e comentar.</p>
          <Link className="button button--secondary" to={`/entrar?retorno=${encodeURIComponent(returnPath)}`}>Entrar para avaliar</Link>
        </div>
      )}

      {entityType !== 'build' && <div className="reviews-panel__list">
        {loading ? <p className="reviews-panel__state">Carregando avaliações…</p> : items.length ? items.map((item) => (
          <article className="reviews-panel__item" key={item.id}>
            <div className="reviews-panel__avatar" aria-hidden="true">{safeInitials(item.author, 'US')}</div>
            <div>
              <header><strong>{asText(item.author, 'Usuário')}</strong><span>★ {formatRating(item.rating)} · {formatDate(item.createdAt)}</span></header>
              {item.title && <h3>{item.title}</h3>}
              <p>{item.comment || 'Avaliação sem comentário.'}</p>
            </div>
          </article>
        )) : <p className="reviews-panel__state">Ainda não há comentários individuais disponíveis.</p>}
      </div>}
    </section>
  )
}
