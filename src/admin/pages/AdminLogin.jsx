import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { ADMIN_ROLES } from '../components/AdminAccess'
import '../Admin.css'

export default function AdminLogin() {
  const { user, loading, login, completeMfa } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [challenge, setChallenge] = useState(null)
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    document.title = 'Entrar | Administração CriaByte'
    let robots = document.head.querySelector('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement('meta')
      robots.setAttribute('name', 'robots')
      document.head.appendChild(robots)
    }
    robots.setAttribute('content', 'noindex,nofollow')
  }, [])

  if (!loading && user && ADMIN_ROLES.includes(String(user.papel || '').toUpperCase())) return <Navigate to="/admin" replace />

  async function submit(event) {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      const profile = challenge ? await completeMfa(challenge, otp) : await login({ email, senha })
      if (profile?.requires2fa) { setChallenge(profile.desafio); setSenha(''); return }
      if (!ADMIN_ROLES.includes(String(profile?.papel || '').toUpperCase())) {
        setError('Esta conta não possui acesso ao painel administrativo.')
        return
      }
      navigate(location.state?.from || '/admin', { replace: true })
    } catch (err) {
      setError(err?.message || 'Não foi possível entrar no painel.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="admin-root admin-login-page">
      <section className="admin-login-card">
        <div className="admin-login-side">
          <span className="admin-brand-mark">CB</span>
          <h1>Painel administrativo</h1>
          <p>Gerencie catálogo, hardwares, ofertas, parceiros, modelos 3D, PCs montados e usuários usando a mesma sessão do site.</p>
          <Link className="admin-back-site" to="/">← Voltar ao CriaByte</Link>
        </div>
        <div className="admin-login-panel">
          <h2>Entrar</h2>
          <p>Use uma conta com papel ADMIN, EDITOR ou REVISOR.</p>
          <form className="admin-login-form" onSubmit={submit}>
            <div className="admin-field"><label htmlFor="admin-email">E-mail</label><input className="admin-input" id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
            <div className="admin-field"><label htmlFor="admin-senha">Senha</label><input className="admin-input" id="admin-senha" type="password" disabled={Boolean(challenge)} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required /></div>
            {challenge && <label className="admin-field">Código do autenticador ou de recuperação<input className="admin-input" autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value)} minLength={6} maxLength={32} required /></label>}
            {error && <p className="admin-form-error">{error}</p>}
            <button className="btn btn-primario" type="submit" disabled={sending}>{sending ? 'Entrando...' : 'Entrar no painel'}</button>
          </form>
          <div className="admin-login-note">Sua sessão administrativa é protegida e usa a mesma conta do site.</div>
        </div>
      </section>
    </div>
  )
}
