/* eslint-disable react-refresh/only-export-components */
import { Link } from 'react-router-dom'

export function AdminPageHeader({ title, description, children }) {
  return (
    <header className="admin-page-header">
      <div><h1>{title}</h1><p>{description}</p></div>
      {children ? <div className="admin-actions">{children}</div> : null}
    </header>
  )
}

export function AdminStatus({ value, active, published }) {
  let label = value
  if (!label && active === false) label = 'INATIVO'
  if (!label && published !== undefined) label = published ? 'PUBLICADO' : 'RASCUNHO'
  if (!label && active !== undefined) label = active ? 'ATIVO' : 'INATIVO'
  label = String(label || '—').toUpperCase()
  const css = label.toLowerCase().replaceAll('_', '-')
  return <span className={`admin-status status-${css}`}>{label.replaceAll('_', ' ')}</span>
}

export function AdminLoading({ text = 'Carregando dados...' }) {
  return <div className="admin-loading">{text}</div>
}

export function AdminError({ error }) {
  return <div className="admin-error-box">{error?.message || String(error || 'Não foi possível carregar os dados.')}</div>
}

export function EmptyRow({ columns, text = 'Nenhum item encontrado.' }) {
  return <tr><td colSpan={columns}><div className="admin-empty">{text}</div></td></tr>
}

export function AdminBack({ to, children = 'Voltar' }) {
  return <Link className="btn btn-secundario" to={to}>{children}</Link>
}

export function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
