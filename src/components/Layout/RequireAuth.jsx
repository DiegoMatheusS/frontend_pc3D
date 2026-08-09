import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page-container" style={{ padding: '72px 0' }}>
        <p style={{ color: 'var(--color-text-soft)' }}>Validando sua sessão…</p>
      </div>
    )
  }

  if (!user) {
    const from = `${location.pathname}${location.search}`
    return <Navigate to={`/entrar?retorno=${encodeURIComponent(from)}`} replace state={{ from }} />
  }

  return children
}
