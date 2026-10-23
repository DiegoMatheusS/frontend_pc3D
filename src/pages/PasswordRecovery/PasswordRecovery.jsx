import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../../services/httpClient'
import '../Register/Auth.css'

export default function PasswordRecovery({ reset = false }) {
  const [token] = useState(() => {
    if (!reset) return ''
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
    // O token não fica no histórico do navegador, referrer ou links de retorno.
    return value
  })
  useEffect(() => { if (reset) window.history.replaceState(window.history.state, '', window.location.pathname) }, [reset])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (reset && password !== confirm) throw new Error('As senhas não coincidem.')
      const result = await apiRequest(reset ? '/api/auth/redefinir-senha' : '/api/auth/recuperar-senha', { method: 'POST', body: reset ? { token, senha: password } : { email } })
      setMessage(result.mensagem); setPassword(''); setConfirm('')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <section className="auth-page"><div className="page-container"><div className="auth-card" style={{ maxWidth: 520, margin: 'auto' }}>
    <h1>{reset ? 'Definir nova senha' : 'Recuperar senha'}</h1>
    {message ? <p role="status">{message}</p> : <form className="auth-form" onSubmit={submit}>
      {reset ? <><p>Use pelo menos 8 caracteres, com maiúscula, minúscula, número e símbolo.</p><label className="auth-field"><span>Nova senha</span><input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></label><label className="auth-field"><span>Repetir senha</span><input type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></label></> : <label className="auth-field"><span>E-mail da conta</span><input type="email" autoComplete="email" maxLength={255} required value={email} onChange={e => setEmail(e.target.value)} /></label>}
      {error && <p role="alert" className="auth-message auth-message--error">{error}</p>}
      <button className="button button--primary" disabled={busy || (reset && !token)}>{busy ? 'Aguarde…' : reset ? 'Salvar nova senha' : 'Enviar instruções'}</button>
      {reset && !token && <p role="alert">Link inválido. Solicite outro e-mail de recuperação.</p>}
    </form>}
    <Link to="/entrar">Voltar para entrar</Link>
  </div></div></section>
}
