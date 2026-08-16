import { Link, useNavigate } from 'react-router-dom'
import { asArray, asNumber, asText, formatCurrency, formatRating } from '../../utils/display'
import './ProductCard.css'

const productReference = (product) => product.slug || product.id
const productHref = (product) => `/produto/${encodeURIComponent(productReference(product))}`

export default function ProductCard({ product = {}, onCompare, selected = false }) {
  const navigate = useNavigate()
  const category = asText(product.category, 'Produto')
  const name = asText(product.name, 'Produto')
  const price = asNumber(product.price, 0)
  const previousPrice = asNumber(product.previousPrice, 0)
  const offers = asArray(product.offers)
  const tags = asArray(product.tags)
  const href = productHref(product)
  const hoverImage = product.hoverImage && product.hoverImage !== product.image ? product.hoverImage : null
  const discount = previousPrice > price && price > 0
    ? Math.round((1 - price / previousPrice) * 100)
    : 0

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
            />
            {hoverImage && (
              <img
                className="product-card__image product-card__image--hover"
                src={hoverImage}
                alt=""
                loading="lazy"
                decoding="async"
              />
            )}
          </>
        ) : (
          <div className={`product-card__symbol product-card__symbol--${asText(product.group, 'hardwares')}`} aria-hidden="true">
            <span>{category.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
      </Link>

      <div className="product-card__content">
        <div className="product-card__topline">
          <span>{category}</span>
          <span>★ {formatRating(product.rating)}</span>
        </div>

        <Link className="product-card__title" to={href}>{name}</Link>
        <p>{asText(product.description, '')}</p>

        <div className="product-card__tags">
          {tags.slice(0, 3).map((tag, index) => <span key={`${asText(tag, 'tag')}-${index}`}>{asText(tag, '')}</span>)}
        </div>

        <div className="product-card__commerce">
          <div><span>{price > 0 ? 'A partir de' : 'Preço'}</span><strong>{price > 0 ? formatCurrency(price) : 'Sem oferta ativa'}</strong></div>
          <span>{offers.length} oferta{offers.length === 1 ? '' : 's'}</span>
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
