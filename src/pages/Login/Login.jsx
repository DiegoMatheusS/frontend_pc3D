import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import GoogleAuthButton from '../../components/GoogleAuthButton/GoogleAuthButton'
import '../Register/Auth.css'

function safeReturnPath(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/conta'
  return value
}

export default function Login() {
  const { user, loading, login, googleLogin, completeMfa } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [challenge, setChallenge] = useState(null)
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState(() => localStorage.getItem('pcBuilderEmailLembrado') || '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(Boolean(localStorage.getItem('pcBuilderEmailLembrado')))
  const [showPassword, setShowPassword] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const passwordChanged = searchParams.get('senhaAlterada') === '1'

  const returnPath = useMemo(() => safeReturnPath(
    searchParams.get('retorno') || location.state?.from,
  ), [location.state, searchParams])

  if (!loading && user) return <Navigate to={returnPath} replace />

  async function handleGoogleCredential(credential) {
    setError('')
    const result = await googleLogin(credential)
    if (result?.requires2fa) { setChallenge(result.desafio); return }
    navigate(returnPath, { replace: true })
  }

  function handleGoogleError(requestError) {
    setError(requestError?.message || 'Não foi possível entrar com Google.')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = challenge ? await completeMfa(challenge, otp) : await login({ email: email.trim(), senha: password })
      if (result?.requires2fa) { setChallenge(result.desafio); setPassword(''); return }
      if (remember) localStorage.setItem('pcBuilderEmailLembrado', email.trim())
      else localStorage.removeItem('pcBuilderEmailLembrado')
      navigate(returnPath, { replace: true })
    } catch (requestError) {
      setError(requestError?.message || 'Não foi possível entrar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="page-container auth-layout">
        <aside className="auth-intro">
          <div>
            <span className="eyebrow">Conta CriaByte</span>
            <h1>Continue de onde parou.</h1>
            <p>Entre para acessar suas builds, participar da comunidade e manter sua experiência ligada ao montador.</p>
            <ul className="auth-benefits">
              <li>Builds organizadas em um só lugar</li>
              <li>Participação nas discussões da comunidade</li>
              <li>Integração gradual com o Montador 3D</li>
            </ul>
            <div className={`auth-mascots ${passwordFocused ? 'auth-mascots--password' : ''} ${showPassword ? 'auth-mascots--visible' : ''}`} aria-hidden="true">
              {[0, 1, 2, 3].map((item) => (
                <span className={`auth-mascot auth-mascot--${item + 1}`} key={item}>
                  <span className="auth-mascot__eyes"><i /><i /></span>
                </span>
              ))}
            </div>
          </div>
          <p className="auth-intro__note">Sua sessão é protegida e permanece vinculada à sua conta.</p>
        </aside>

        <div className="auth-card">
          <header className="auth-card__header">
            <h2>Entrar</h2>
            <p>Use Google ou entre com seu e-mail e senha.</p>
          </header>

          <GoogleAuthButton mode="login" onCredential={handleGoogleCredential} onError={handleGoogleError} />
          <div className="auth-divider"><span>ou use e-mail</span></div>

          <form className="auth-form auth-form--after-social" onSubmit={handleSubmit} noValidate>
            <label className="auth-field">
              <span>E-mail</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@exemplo.com"
                required
              />
            </label>

            <label className="auth-field">
              <span>Senha</span>
              <div className="auth-password">
                <input
                  type={showPassword ? 'text' : 'password'}
                  disabled={Boolean(challenge)} autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="Digite sua senha"
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </label>

            <div className="auth-row">
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>Lembrar meu e-mail</span>
              </label>
              <Link to="/recuperar-senha">Esqueci minha senha</Link>
            </div>

            {challenge && <label className="auth-field"><span>Código do autenticador ou de recuperação</span><input autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value)} minLength={6} maxLength={32} required /></label>}
            {passwordChanged && <p className="auth-message auth-message--success" role="status">Senha alterada. Entre novamente com a nova senha.</p>}
            {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}

            <button className="button button--primary auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar na conta'}
            </button>
          </form>

          <p className="auth-switch">Ainda não tem uma conta? <Link to={`/cadastro?retorno=${encodeURIComponent(returnPath)}`}>Cadastre-se</Link></p>
        </div>
      </div>
    </section>
  )
}
