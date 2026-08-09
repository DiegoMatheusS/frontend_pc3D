/* eslint-disable react-refresh/only-export-components */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { AdminLoading } from './AdminCommon'

export const ADMIN_ROLES = ['ADMIN', 'EDITOR', 'REVISOR']

export default function AdminAccess({ children, roles = ADMIN_ROLES }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="admin-root"><AdminLoading text="Verificando sessão..." /></div>
  if (!user) return <Navigate to="/admin/entrar" replace state={{ from: location.pathname + location.search }} />
  if (!roles.includes(String(user.papel || '').toUpperCase())) {
    return (
      <div className="admin-root">
        <section className="admin-permission-denied">
          <h1>Acesso administrativo indisponível</h1>
          <p>Sua conta não possui permissão para acessar esta área.</p>
          <a className="btn btn-primario" href="/">Voltar ao site</a>
        </section>
      </div>
    )
  }
  return children
}
