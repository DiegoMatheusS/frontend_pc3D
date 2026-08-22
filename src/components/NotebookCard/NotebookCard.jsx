import { Link } from 'react-router-dom'
import { asArray, asNumber, asText, formatCurrency, formatRating } from '../../utils/display'
import './NotebookCard.css'

export default function NotebookCard({ notebook = {}, onCompare, selected = false }) {
  const specs = notebook.specs && typeof notebook.specs === 'object' ? notebook.specs : {}
  const offers = asArray(notebook.offers)
  const price = asNumber(notebook.price, 0)
  const previousPrice = asNumber(notebook.previousPrice, 0)
  const discount = previousPrice > price && price > 0 ? Math.round((1 - price / previousPrice) * 100) : 0
  const name = asText(notebook.name, 'Notebook')

  return (
    <article className={`notebook-card ${selected ? 'notebook-card--selected' : ''}`}>
      <Link className="notebook-card__visual" to={`/notebooks/${notebook.id}`} aria-label={`Ver ${name}`}>
        {discount > 0 && <span className="notebook-card__discount">-{discount}%</span>}
        {notebook.image ? <img className={`notebook-card__image ${notebook.hoverImage ? 'has-hover' : ''}`} src={notebook.image} alt="" loading="lazy" onError={(event) => {
          event.currentTarget.hidden = true
          event.currentTarget.parentElement?.querySelector('.notebook-card__device')?.removeAttribute('hidden')
        }} /> : null}
        {notebook.hoverImage ? <img className="notebook-card__image notebook-card__image--hover" src={notebook.hoverImage} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true }} /> : null}
        <div className="notebook-card__device" aria-hidden="true" hidden={Boolean(notebook.image)}><span>NB</span></div>
      </Link>

      <div className="notebook-card__content">
        <div className="notebook-card__topline">
          <span>{asText(notebook.use, 'Uso geral')}</span>
          <span>★ {formatRating(notebook.rating)} <small>({asNumber(notebook.reviewsCount, 0)})</small></span>
        </div>

        <Link className="notebook-card__title" to={`/notebooks/${notebook.id}`}>{name}</Link>
        <p>{asText(notebook.description, '')}</p>

        <dl className="notebook-card__quick-specs">
          <div><dt>CPU</dt><dd>{asText(specs.cpu)}</dd></div>
          <div><dt>GPU</dt><dd>{asText(specs.gpu, 'Vídeo integrado')}</dd></div>
          <div><dt>Memória</dt><dd>{asNumber(specs.ramGb, 0) || '—'}{asNumber(specs.ramGb, 0) ? ` GB ${asText(specs.ramType, '')}` : ''}</dd></div>
          <div><dt>Tela</dt><dd>{asNumber(specs.screenInches, 0) || '—'}{asNumber(specs.screenInches, 0) ? `” · ${asNumber(specs.refreshRateHz, 0) || '—'} Hz` : ''}</dd></div>
        </dl>

        <div className="notebook-card__commerce">
          <div><span>A partir de</span><strong>{formatCurrency(price)}</strong></div>
          <span>{offers.length} oferta{offers.length === 1 ? '' : 's'}</span>
        </div>

        <div className="notebook-card__actions">
          <Link className="button button--primary" to={`/notebooks/${notebook.id}`}>Ver notebook</Link>
          {onCompare && <button className="button button--secondary" type="button" aria-pressed={selected} onClick={() => onCompare(notebook)}>{selected ? 'Selecionado' : 'Comparar'}</button>}
        </div>
      </div>
    </article>
  )
}
