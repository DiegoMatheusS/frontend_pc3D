import { identicalOffersSources } from '../utils/identicalOffers'

export default function IdenticalOffersReport({ report, onClose }) {
  if (!report) return null
  return (
    <section className="admin-card admin-offers-report" aria-label="Resultado da busca em outras lojas" role="status">
      <div className="admin-card-header">
        <div><h2>Resultado da busca em outras lojas</h2><p>{report.productName}</p></div>
        <button className="admin-action-button" type="button" onClick={onClose}>Fechar resultado</button>
      </div>
      {report.error ? <div className="admin-card-body">{report.error}</div> : (
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Loja</th><th>Resultado</th><th>Confirmadas</th><th>Novas ofertas</th></tr></thead>
          <tbody>{identicalOffersSources(report.result).map((source) => (
            <tr key={source.key}>
              <td data-label="Loja"><strong>{source.name}</strong></td>
              <td data-label="Resultado">{source.message}</td><td data-label="Confirmadas">{source.found}</td><td data-label="Novas ofertas">{source.created}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  )
}
