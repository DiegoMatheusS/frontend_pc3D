import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { getProductLikeSummary, likeProduct, unlikeProduct } from '../../services/productsService'
import { asArray, asNumber, asText, formatCurrency, formatRating } from '../../utils/display'
import './ProductCard.css'

const productReference = (product) => product.slug || product.id
const productHref = (product) => `/produto/${encodeURIComponent(productReference(product))}`

export default function ProductCard({ product = {}, onCompare, selected = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userIdentity = String(user?.id ?? user?.email ?? '')
  const currentUserIdentityRef = useRef(userIdentity)
  const [liked, setLiked] = useState(product.likedByUser === true)
  const [likeCount, setLikeCount] = useState(Number(product.likesCount) || 0)
  const [likePending, setLikePending] = useState(false)
  const category = asText(product.category, 'Produto')
  const name = asText(product.name, 'Produto')
  const group = asText(product.group, 'hardwares')
  const price = asNumber(product.price, 0)
  const previousPrice = asNumber(product.previousPrice, 0)
  const offers = asArray(product.offers)
  const tags = asArray(product.tags)
  const href = productHref(product)
  const hoverImage = product.hoverImage && product.hoverImage !== product.image ? product.hoverImage : null
  const discount = previousPrice > price && price > 0
    ? Math.round((1 - price / previousPrice) * 100)
    : 0

  useEffect(() => {
    currentUserIdentityRef.current = userIdentity
  }, [userIdentity])

  useEffect(() => {
    let active = true
    const productId = Number(product.id)

    setLiked(false)
    setLikeCount(Number(product.likesCount) || 0)

    if (!Number.isInteger(productId) || productId <= 0) {
      return () => { active = false }
    }

    getProductLikeSummary([productId])
      .then((items) => {
        if (!active || currentUserIdentityRef.current !== userIdentity) return
        const summary = items.find((item) => Number(item?.produtoId) === productId)
        if (!summary) return
        setLiked(Boolean(user) && summary.likedByUser === true)
        setLikeCount(Number(summary.likesCount) || 0)
      })
      .catch(() => {})

    return () => { active = false }
  }, [product.id, product.likesCount, userIdentity, user])

  function openCard(event) {
    if (event.target.closest('a, button, input, select, textarea, label')) return
    navigate(href)
  }

  function handleKeyDown(event) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      navigate(href)
    }
  }

  async function handleLike() {
    if (likePending || !user) return

    const productId = Number(product.id)
    if (!Number.isInteger(productId) || productId <= 0) return

    const requestUserIdentity = userIdentity
    setLikePending(true)
    try {
      const result = liked
        ? await unlikeProduct(productId)
        : await likeProduct(productId)

      if (currentUserIdentityRef.current !== requestUserIdentity) return

      // O retorno da gravação já contém o total, mas consultamos novamente o
      // resumo para exibir sempre a contagem autoritativa do banco. Isso evita
      // que uma troca de conta ou renderização antiga deixe o contador defasado.
      const items = await getProductLikeSummary([productId]).catch(() => [])
      const summary = items.find((item) => Number(item?.produtoId) === productId)
      const authoritative = summary || result

      if (currentUserIdentityRef.current !== requestUserIdentity) return
      setLiked(authoritative.likedByUser === true)
      setLikeCount(Number(authoritative.likesCount) || 0)
    } finally {
      setLikePending(false)
    }
  }

  return (
    <article
      className={`product-card ${selected ? 'product-card--selected' : ''}`}
      onClick={openCard}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={`Abrir ${name}`}
    >
      <Link className="product-card__visual" to={href} aria-label={`Ver ${name}`}>
        {discount > 0 && <span className="product-card__discount">-{discount}%</span>}
        {product.image ? (
          <>
            <img
              className={`product-card__image product-card__image--primary ${hoverImage ? 'product-card__image--has-hover' : ''}`}
              src={product.image}
              alt=""
              loading="lazy"
              decoding="async"
              onError={(event) => {
                event.currentTarget.hidden = true
                event.currentTarget.parentElement?.querySelector('.product-card__symbol')?.removeAttribute('hidden')
              }}
            />
            {hoverImage && (
              <img
                className="product-card__image product-card__image--hover"
                src={hoverImage}
                alt=""
                loading="lazy"
                decoding="async"
                onError={(event) => { event.currentTarget.hidden = true }}
              />
            )}
          </>
        ) : null}
        <div className={`product-card__symbol product-card__symbol--${group}`} aria-hidden="true" hidden={Boolean(product.image)}>
          {group === 'notebooks' ? <span className="product-card__laptop-placeholder" /> : <span>{category.slice(0, 2).toUpperCase()}</span>}
        </div>
      </Link>

      <div className="product-card__content">
        <div className="product-card__topline">
          <span>{category}</span>
          <span>★ {formatRating(product.rating)}</span>
        </div>

        <Link className="product-card__title" to={href}>{name}</Link>
        <p>{asText(product.description, '')}</p>
        {product.registeredBy && (
          <div className="product-card__registered-by">Cadastrado por <strong>{product.registeredBy}</strong></div>
        )}

        <div className="product-card__tags">
          {tags.slice(0, 3).map((tag, index) => <span key={`${asText(tag, 'tag')}-${index}`}>{asText(tag, '')}</span>)}
        </div>

        <div className="product-card__commerce">
          <div><span>{price > 0 ? 'A partir de' : 'Preço'}</span><strong>{price > 0 ? formatCurrency(price) : 'Sem oferta ativa'}</strong></div>
          <span>{offers.length} oferta{offers.length === 1 ? '' : 's'}</span>
        </div>

        <div className="product-card__social">
          <button
            className={`product-card__like ${liked ? 'is-liked' : ''}`}
            type="button"
            aria-pressed={user ? liked : false}
            aria-busy={likePending}
            aria-label={!user ? `Entre na sua conta para dar Like em ${name}` : liked ? `Remover Like de ${name}` : `Dar Like em ${name}`}
            title={!user ? 'Entre na sua conta para dar Like' : undefined}
            disabled={!user || likePending}
            onClick={handleLike}
          >
            <span aria-hidden="true">♥</span>
            <span>Like</span>
            <b>{likeCount}</b>
          </button>
        </div>

        <div className="product-card__actions">
          <Link className="button button--primary" to={href}>Ver produto</Link>
          {onCompare && (
            <button className="button button--secondary" type="button" aria-pressed={selected} onClick={() => onCompare(product)}>
              {selected ? 'Selecionado' : 'Comparar'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
