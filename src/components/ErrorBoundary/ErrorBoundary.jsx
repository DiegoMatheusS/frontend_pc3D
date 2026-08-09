import { Component } from 'react'
import './ErrorBoundary.css'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erro não tratado no frontend React:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="app-error-boundary" role="alert">
        <div>
          <span>CriaByte</span>
          <h1>Esta tela encontrou um erro.</h1>
          <p>O restante do site continua disponível. Recarregue a página e, se o problema persistir, tente novamente mais tarde.</p>
          {import.meta.env.DEV && <pre>{String(this.state.error?.message || this.state.error)}</pre>}
          <div className="app-error-boundary__actions">
            <button type="button" onClick={() => window.location.reload()}>Recarregar</button>
            <a href="/">Ir para o início</a>
          </div>
        </div>
      </main>
    )
  }
}
