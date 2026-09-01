import './CatalogState.css'

export default function CatalogState({ loading = false, error = '', onRetry, label = 'conteúdo' }) {
  if (loading) {
    return (
      <div className="catalog-state catalog-state--loading" role="status" aria-live="polite">
        <span className="catalog-state__spinner" aria-hidden="true" />
        <div>
          <strong>Carregando {label}…</strong>
          <span>Aguarde um instante.</span>
        </div>
      </div>
    )
  }

  if (!error) return null

  return (
    <div className="catalog-state catalog-state--error" role="alert">
      <span className="catalog-state__icon" aria-hidden="true">!</span>
      <div>
        <strong>Não foi possível carregar {label}.</strong>
        <span>{error}</span>
      </div>
      {onRetry && <button className="button button--secondary" type="button" onClick={onRetry}>Tentar novamente</button>}
    </div>
  )
}
