import { Link } from 'react-router-dom'
import { asNumber, asText, formatCurrency } from '../../utils/display'
import './OfferCard.css'

const calculateDiscount = (price, previousPrice) => {
  const current = asNumber(price, 0)
  const previous = asNumber(previousPrice, 0)
  if (!current || !previous || previous <= current) return null
  return Math.round(((previous - current) / previous) * 100)
}

export default function OfferCard({ product = {}, anchorId = '', highlighted = false }) {
  const category = asText(product.category, 'Produto')
  const name = asText(product.name, 'Produto')
  const brand = asText(product.brand)
  const price = asNumber(product.price, 0)
  const previousPrice = asNumber(product.previousPrice, 0)
  const offersCount = Math.max(0, asNumber(product.offersCount, 0))
  const discount = calculateDiscount(price, previousPrice)

  return (
    <article id={anchorId || undefined} className={`offer-card${highlighted ? ' offer-card--highlighted' : ''}`}>
      <div className="offer-card__visual" aria-hidden="true">
        {product.image ? <img src={product.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <span>{category.slice(0, 2).toUpperCase()}</span>}
      </div>

      <div className="offer-card__content">
        <div className="offer-card__topline">
          <span>{category}</span>
          {discount ? <strong>-{discount}%</strong> : null}
        </div>

        <div>
          <small>{brand}</small>
          <h3>{name}</h3>
        </div>

        {product.context ? <p className="offer-card__context">{asText(product.context, '')}</p> : null}

        <div className="offer-card__prices">
          {previousPrice > price && price > 0 ? <del>{formatCurrency(previousPrice)}</del> : null}
          <strong>{price > 0 ? formatCurrency(price) : 'Preço indisponível'}</strong>
          <span>{offersCount} oferta{offersCount === 1 ? '' : 's'} disponível{offersCount === 1 ? '' : 'is'}</span>
          {product.registeredBy ? <span>Cadastrado por {product.registeredBy}</span> : null}
        </div>

        {product.id != null && product.id !== '' ? (
          <Link className="button button--secondary" to={`/produto/${encodeURIComponent(product.id)}#onde-comprar`}>Ver ofertas na loja</Link>
        ) : (
          <button className="button button--secondary" type="button" disabled>Oferta indisponível</button>
        )}
      </div>
    </article>
  )
}
