import { Link } from 'react-router-dom'
import { getMountedPcBuilderPath } from '../../services/mountedPcsService'
import { asNumber, asText, formatCurrency, formatRating } from '../../utils/display'
import './MountedPcCard.css'

export default function MountedPcCard({ pc = {}, onCompare, selected = false, compact = false }) {
  const builderPath = getMountedPcBuilderPath(pc)
  const name = asText(pc.name, 'PC Montado')
  const offersCount = Math.max(0, asNumber(pc.offersCount, 0))

  return (
    <article className={`mounted-card ${selected ? 'mounted-card--selected' : ''} ${compact ? 'mounted-card--compact' : ''}`}>
      <div className="mounted-card__visual" aria-hidden="true">
        {pc.highlight ? <span className="mounted-card__chip">{asText(pc.highlight, '')}</span> : null}
        <div className="mounted-card__case"><span className="mounted-card__fan mounted-card__fan--one" /><span className="mounted-card__fan mounted-card__fan--two" /><span className="mounted-card__gpu" /></div>
      </div>

      <div className="mounted-card__content">
        <span className="mounted-card__category">{asText(pc.category, 'PC Montado')}</span>
        <h3>{name}</h3>

        <dl className="mounted-card__specs">
          <div><dt>CPU</dt><dd>{asText(pc.cpu)}</dd></div>
          <div><dt>GPU</dt><dd>{asText(pc.gpu)}</dd></div>
          <div><dt>RAM</dt><dd>{asText(pc.ram)}</dd></div>
          <div><dt>SSD</dt><dd>{asText(pc.storage)}</dd></div>
        </dl>

        <div className="mounted-card__meta">
          <span className="mounted-card__rating">★ {formatRating(pc.rating)} <small>({asNumber(pc.reviewsCount, 0)})</small></span>
          <span>{offersCount} oferta{offersCount === 1 ? '' : 's'}</span>
        </div>

        <div className="mounted-card__price"><span>{asNumber(pc.price, 0) > 0 ? 'A partir de' : 'Preço'}</span><strong>{asNumber(pc.price, 0) > 0 ? formatCurrency(pc.price) : 'Sem oferta ativa'}</strong></div>

        <div className="mounted-card__actions">
          <Link className="button button--primary" to={`/montados/${pc.id}`}>Ver PC</Link>
          <Link className="button button--secondary" to={builderPath}>Abrir no 3D</Link>
          {onCompare ? (
            <button className="button button--secondary mounted-card__compare" type="button" aria-pressed={selected} onClick={() => onCompare(pc)}>
              {selected ? 'Selecionado' : 'Comparar'}
            </button>
          ) : <Link className="button button--secondary mounted-card__compare" to={`/montados?comparar=${pc.id}`}>Comparar</Link>}
        </div>
      </div>
    </article>
  )
}
