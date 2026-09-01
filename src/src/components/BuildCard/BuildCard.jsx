import { Link } from 'react-router-dom'
import { savedBuildsService } from '../../services/savedBuildsService'
import { asArray, asNumber, asText, formatCurrency, formatRating, safeInitials } from '../../utils/display'
import './BuildCard.css'

export default function BuildCard({ build = {} }) {
  const builderPath = savedBuildsService.createBuilderPath({ configuracao: build.builderConfiguration })
  const tags = asArray(build.tags)
  const title = asText(build.title, 'Build da comunidade')
  const author = asText(build.author, 'Usuário')
  const detailRef = build.id ?? build.slug
  const reviewsCount = asNumber(build.reviewsCount, 0)
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

  return (
    <article className="build-card">
      <header className="build-card__header">
        <div className="build-card__avatar" aria-hidden="true">{asText(build.authorInitials, safeInitials(author))}</div>
        <div><h2><Link to={`/comunidade/${detailRef}`}>{title}</Link></h2><p>por {author}</p></div>
      </header>

      {tags.length > 0 && <div className="build-card__tags" aria-label="Tags da build">
        {tags.slice(0, 3).map((tag, index) => <span key={`${asText(tag, 'tag')}-${index}`}>{asText(tag, '')}</span>)}
      </div>}

      <dl className="build-card__specs">
        <div><dt>CPU</dt><dd>{asText(build.cpu)}</dd></div><div><dt>GPU</dt><dd>{asText(build.gpu)}</dd></div><div><dt>RAM</dt><dd>{asText(build.ram)}</dd></div><div><dt>SSD</dt><dd>{asText(build.storage)}</dd></div>
      </dl>

      <div className="build-card__metrics">
        <div>
          <span>{priceLabel}</span>
          <strong>{displayedPrice > 0 ? formatCurrency(displayedPrice) : 'Sem oferta'}</strong>
          {publicationPrice <= 0 && currentPrice > 0 && !build.currentPriceComplete && (
            <small>{asNumber(currentCoverage.priced, 0)}/{asNumber(currentCoverage.total, 0)} peça(s) com preço</small>
          )}
        </div>
        <div>
          <span>{reviewsCount > 0 ? 'Avaliação' : 'Visualizações'}</span>
          {reviewsCount > 0
            ? <strong className="build-card__rating">★ {formatRating(build.rating)} <small>({reviewsCount})</small></strong>
            : <strong>{asNumber(build.views, 0)}</strong>}
        </div>
      </div>

      <div className="build-card__social">
        {asNumber(build.commentsCount, 0) > 0 && <span>{asNumber(build.commentsCount, 0)} comentários</span>}
        <span>{asNumber(build.copies, 0)} cópias</span>
        <span>{asNumber(build.views, 0)} visualizações</span>
      </div>

      <footer className="build-card__actions"><Link className="button button--primary" to={`/comunidade/${detailRef}`}>Ver build</Link><Link className="button button--secondary" to={builderPath}>Abrir no 3D</Link></footer>
    </article>
  )
}
