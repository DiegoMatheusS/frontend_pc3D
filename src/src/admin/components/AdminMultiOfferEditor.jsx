export default function AdminMultiOfferEditor({
  rows = [],
  partners = [],
  onChange,
  onAdd,
  onRemove,
  title = 'Ofertas',
  description = 'Cadastre uma ou várias ofertas para este item.',
}) {
  const visibleRows = rows.map((row, index) => ({ row, index })).filter(({ row }) => !row._removed)
  const removedCount = rows.length - visibleRows.length

  return <section className="admin-form-section">
    <div className="admin-section-heading">
      <div><h2>{title}</h2><p>{description}</p></div>
      <div className="admin-offer-heading-actions">
        <span className="admin-muted">{visibleRows.length} oferta(s)</span>
        <button className="btn btn-secundario" type="button" onClick={onAdd}>+ Oferta</button>
      </div>
    </div>

    {removedCount > 0 && <p className="admin-inline-warning">{removedCount} oferta(s) existente(s) serão marcadas como indisponíveis ao salvar.</p>}

    {visibleRows.length ? <div className="admin-offer-editors">
      {visibleRows.map(({ row, index }, visibleIndex) => <div className="admin-offer-editor" key={row.id || `nova-oferta-${index}`}>
        <div className="admin-offer-editor-head">
          <div>
            <strong>Oferta {visibleIndex + 1}</strong>
            <small>{row.id ? `Oferta #${row.id}` : 'Nova oferta'}</small>
          </div>
          <button className="admin-action-button admin-action-button--danger" type="button" onClick={() => onRemove(index)}>{row.id ? 'Desativar' : 'Remover'}</button>
        </div>
        <div className="admin-form-grid">
          <div className="admin-field">
            <label>Parceiro</label>
            <select className="admin-select" required value={row.parceiroId} disabled={Boolean(row.id)} onChange={(event) => onChange(index, 'parceiroId', event.target.value)}>
              <option value="">Selecione</option>
              {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.nome}</option>)}
            </select>
            {row.id && <small className="admin-help">O parceiro de uma oferta existente não pode ser trocado por esta rota.</small>}
          </div>
          <div className="admin-field"><label>Preço atual</label><input className="admin-input" type="number" min="0.01" step="0.01" required value={row.preco} onChange={(event) => onChange(index, 'preco', event.target.value)} placeholder="4999.90" /></div>
          <div className="admin-field"><label>Preço anterior</label><input className="admin-input" type="number" min="0.01" step="0.01" value={row.precoAnterior} onChange={(event) => onChange(index, 'precoAnterior', event.target.value)} placeholder="5499.90" /></div>
          <div className="admin-field"><label>Frete</label><input className="admin-input" type="number" min="0" step="0.01" value={row.frete} onChange={(event) => onChange(index, 'frete', event.target.value)} placeholder="0.00" /></div>
          <div className="admin-field"><label>Vendedor</label><input className="admin-input" value={row.vendedorNome} onChange={(event) => onChange(index, 'vendedorNome', event.target.value)} placeholder="Loja oficial" /></div>
          <div className="admin-field"><label>ID do vendedor</label><input className="admin-input" value={row.vendedorIdentificador} onChange={(event) => onChange(index, 'vendedorIdentificador', event.target.value)} placeholder="Opcional" /></div>
          <div className="admin-field full"><label>URL original</label><input className="admin-input" type="url" required value={row.urlOriginal} onChange={(event) => onChange(index, 'urlOriginal', event.target.value)} placeholder="https://loja.com/produto" /></div>
          <div className="admin-field full"><label>URL afiliada</label><input className="admin-input" type="url" value={row.urlAfiliada} onChange={(event) => onChange(index, 'urlAfiliada', event.target.value)} placeholder="https://link-afiliado..." /></div>
          <div className="admin-field"><label>Validade</label><input className="admin-input" type="datetime-local" value={row.validoAte} onChange={(event) => onChange(index, 'validoAte', event.target.value)} /></div>
        </div>
      </div>)}
    </div> : <div className="admin-info-box"><strong>Nenhuma oferta adicionada</strong><p>O cadastro técnico pode ser salvo sem oferta. Use “+ Oferta” quando quiser informar preço e loja.</p></div>}
  </section>
}
