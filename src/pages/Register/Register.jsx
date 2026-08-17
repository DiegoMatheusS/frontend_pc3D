import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { safeHttpUrl } from '../../utils/safeUrl'
import './Auth.css'

const PASSWORD_RULES = [
  ['length', '8 caracteres', (value) => value.length >= 8],
  ['upper', 'Uma maiúscula', (value) => /[A-ZÀ-Ý]/.test(value)],
  ['lower', 'Uma minúscula', (value) => /[a-zà-ÿ]/.test(value)],
  ['number', 'Um número', (value) => /\d/.test(value)],
  ['symbol', 'Um símbolo', (value) => /[^\p{L}\p{N}\s]/u.test(value)],
]

function safeReturnPath(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/conta'
  return value
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function googleRegistrationUrl(returnPath) {
  const configured = String(import.meta.env.VITE_GOOGLE_AUTH_URL || '').trim()
  if (!configured) return ''

  const safeConfigured = safeHttpUrl(configured)
  if (!safeConfigured) return ''

  try {
    const target = new URL(safeConfigured)
    target.searchParams.set('retorno', returnPath)
    return target.toString()
  } catch {
    return ''
  }
}

function getRegistrationError(error) {
  if (error?.status === 409) return 'Já existe uma conta cadastrada com este e-mail.'
  if (error?.status === 404 || error?.status === 405) {
    return 'O cadastro está indisponível no momento. Tente novamente mais tarde.'
  }
  if (error?.status === 0) return 'Não foi possível acessar o serviço de cadastro. Tente novamente em instantes.'
  return error?.message || 'Não foi possível criar a conta.'
}

export default function Register() {
  const { user, loading, register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnPath = useMemo(() => safeReturnPath(searchParams.get('retorno')), [searchParams])
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmacao: '' })
  const [accepted, setAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState({})
  const googleUrl = googleRegistrationUrl(returnPath)

  if (!loading && user) return <Navigate to={returnPath} replace />

  const ruleState = Object.fromEntries(PASSWORD_RULES.map(([key, , test]) => [key, test(form.senha)]))
  const passwordValid = Object.values(ruleState).every(Boolean)
  const nameValid = form.nome.trim().length >= 2
  const emailValid = isValidEmail(form.email)
  const confirmationValid = Boolean(form.confirmacao) && form.senha === form.confirmacao
  const formValid = nameValid && emailValid && passwordValid && confirmationValid && accepted

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    if (error) setError('')
  }

  function markTouched(key) {
    setTouched((current) => ({ ...current, [key]: true }))
  }

  function handleGoogleRegistration() {
    setError('')
    if (!googleUrl) {
      setError('O cadastro com Google ainda precisa ser habilitado no backend.')
      return
    }
    window.location.assign(googleUrl)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setTouched({ nome: true, email: true, senha: true, confirmacao: true })

    if (!nameValid) return setError('Informe seu nome.')
    if (!emailValid) return setError('Informe um e-mail válido.')
    if (!passwordValid) return setError('A senha ainda não atende a todos os requisitos.')
    if (!confirmationValid) return setError('As senhas não são iguais.')
    if (!accepted) return setError('Você precisa aceitar os Termos de uso e a Política de privacidade.')

    setSubmitting(true)
    try {
      await register({
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        senha: form.senha,
      })
      navigate(returnPath, { replace: true })
    } catch (requestError) {
      setError(getRegistrationError(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="page-container auth-layout">
        <aside className="auth-intro">
          <div>
            <span className="eyebrow">Nova conta</span>
            <h1>Suas builds com você.</h1>
            <p>Crie sua conta para salvar configurações e participar das Builds da Comunidade.</p>
            <ul className="auth-benefits">
              <li>Salve configurações do montador</li>
              <li>Compartilhe suas próprias builds</li>
              <li>Comente e responda dúvidas</li>
            </ul>
          </div>
        </aside>

        <div className="auth-card">
          <header className="auth-card__header">
            <h2>Cadastre-se</h2>
            <p>Preencha seus dados para criar a conta.</p>
          </header>

          <button className="auth-google" type="button" onClick={handleGoogleRegistration}>
            <span className="auth-google__icon" aria-hidden="true">G</span>
            <span>Cadastrar com Google</span>
          </button>
          <div className="auth-divider"><span>ou use e-mail</span></div>

          <form className="auth-form auth-form--after-social" onSubmit={handleSubmit} noValidate>
            <label className="auth-field">
              <span>Nome</span>
              <input
                value={form.nome}
                onChange={(event) => updateField('nome', event.target.value)}
                onBlur={() => markTouched('nome')}
                autoComplete="name"
                placeholder="Como devemos chamar você?"
                aria-invalid={touched.nome && !nameValid}
                required
              />
              {touched.nome && !nameValid && <small className="auth-field__error">Use pelo menos 2 caracteres.</small>}
            </label>

            <label className="auth-field">
              <span>E-mail</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                onBlur={() => markTouched('email')}
                autoComplete="email"
                inputMode="email"
                placeholder="voce@exemplo.com"
                aria-invalid={touched.email && !emailValid}
                required
              />
              {touched.email && !emailValid && <small className="auth-field__error">Digite um e-mail válido.</small>}
            </label>

            <label className="auth-field">
              <span>Senha</span>
              <div className="auth-password">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.senha}
                  onChange={(event) => updateField('senha', event.target.value)}
                  onBlur={() => markTouched('senha')}
                  autoComplete="new-password"
                  placeholder="Crie uma senha segura"
                  aria-invalid={touched.senha && !passwordValid}
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
              </div>
            </label>

            <ul className="password-rules" aria-label="Requisitos da senha">
              {PASSWORD_RULES.map(([key, label]) => (
                <li key={key} className={ruleState[key] ? 'is-valid' : ''}>{ruleState[key] ? '✓' : '○'} {label}</li>
              ))}
            </ul>

            <label className="auth-field">
              <span>Confirmar senha</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirmacao}
                onChange={(event) => updateField('confirmacao', event.target.value)}
                onBlur={() => markTouched('confirmacao')}
                autoComplete="new-password"
                placeholder="Repita sua senha"
                aria-invalid={touched.confirmacao && !confirmationValid}
                required
              />
              {touched.confirmacao && form.confirmacao && !confirmationValid && <small className="auth-field__error">As senhas precisam ser iguais.</small>}
              {confirmationValid && <small className="auth-field__success">As senhas coincidem.</small>}
            </label>

            <label className="auth-check auth-terms">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>Li e aceito os <Link to="/termos" target="_blank" rel="noreferrer">Termos de uso</Link> e a <Link to="/privacidade" target="_blank" rel="noreferrer">Política de privacidade</Link>.</span>
            </label>

            {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}

            <button className="button button--primary auth-submit" type="submit" disabled={submitting || !formValid}>
              {submitting ? 'Criando conta…' : 'Criar minha conta'}
            </button>
          </form>

          <p className="auth-switch">Já possui uma conta? <Link to={`/entrar?retorno=${encodeURIComponent(returnPath)}`}>Entrar</Link></p>
        </div>
      </div>
    </section>
  )
}
