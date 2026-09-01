import { Link } from 'react-router-dom'
import './NotFound.css'

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="page-container not-found-page__content">
        <span className="eyebrow">Erro 404</span>
        <h1>Página não encontrada</h1>
        <p>O endereço informado não existe ou não está mais disponível.</p>
        <div>
          <Link className="button button--primary" to="/">Ir para o início</Link>
          <Link className="button button--secondary" to="/montar">Abrir o montador</Link>
        </div>
      </div>
    </main>
  )
}
