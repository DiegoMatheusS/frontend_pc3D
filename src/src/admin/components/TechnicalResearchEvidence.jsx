import { researchEvidenceRows, technicalResearchFromPreview } from '../utils/technicalResearch'

const displayValue = (value) => typeof value === 'boolean' ? (value ? 'Sim' : 'Não')
  : Array.isArray(value) ? value.join(', ') : String(value ?? '')

export default function TechnicalResearchEvidence({ preview }) {
  const research = technicalResearchFromPreview(preview)
  const rows = researchEvidenceRows(research)
  if (!research) return null
  return <div className="admin-import-preview" aria-live="polite">
    <strong>{rows.length ? `${rows.length} especificação(ões) confirmada(s)` : 'Nenhuma especificação nova confirmada'}</strong>
    {!rows.length && <p className="admin-help">Informe o modelo completo ou o código do fabricante para consultar a ficha exata.</p>}
    {rows.length > 0 && <details><summary>Ver especificações e fontes</summary>
      <table><thead><tr><th>Campo</th><th>Valor</th><th>Fonte e comprovação</th></tr></thead>
        <tbody>{rows.map((item) => <tr key={item.field}><td>{item.field}</td><td>{displayValue(item.valor)}</td><td><a href={item.url} target="_blank" rel="noopener noreferrer">{item.fonte}</a><small className="admin-help">{item.trecho}</small></td></tr>)}</tbody>
      </table>
    </details>}
    {research.camposAusentes?.length > 0 && <p className="admin-help">Ainda sem confirmação: {research.camposAusentes.join(', ')}.</p>}
    {research.conflitos?.length > 0 && <p className="admin-inline-warning">Há divergências entre fontes. Os campos em conflito precisam de revisão.</p>}
  </div>
}
