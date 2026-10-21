import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../../services/httpClient'
import { useAuth } from '../../contexts/authContext'
import '../Register/Auth.css'

export default function AccountSecurity() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [setup, setSetup] = useState(null)
  const [codes, setCodes] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { apiRequest('/api/auth/2fa').then(setStatus).catch(e => setError(e.message)) }, [])
  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      if (status?.habilitado) {
        await apiRequest('/api/auth/2fa/desativar', { method: 'POST', body: { senha: password, codigo: code } })
        await logout(); navigate('/entrar', { replace: true })
      } else if (setup) {
        const result = await apiRequest('/api/auth/2fa/ativar', { method: 'POST', body: { desafio: setup.desafio, codigo: code } })
        setCodes(result.codigosRecuperacao); setPassword(''); setCode(''); setSetup(null)
      } else setSetup(await apiRequest('/api/auth/2fa/configurar', { method: 'POST', body: { senha: password } }))
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <section className="auth-page"><div className="page-container"><div className="auth-card" style={{ maxWidth: 620, margin: 'auto' }}>
    <h1>Segurança da conta</h1><p>A autenticação em duas etapas protege sua conta e seu acesso administrativo.</p>
    {codes.length ? <><h2>Guarde seus códigos de recuperação</h2><p>Cada código funciona uma vez. Guarde-os em um lugar seguro antes de sair.</p><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{codes.join('\n')}</pre><button className="button button--primary" onClick={async () => { await logout(); navigate('/entrar', { replace: true }) }}>Já guardei. Entrar novamente</button></> : <form className="auth-form" onSubmit={submit}>
      <p>{status ? status.habilitado ? `Ativa · ${status.codigosRestantes} códigos de recuperação disponíveis.` : 'Ainda não ativada.' : 'Carregando…'}</p>
      {!setup && <label className="auth-field"><span>Senha atual</span><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={128} /></label>}
      {setup && <><p>Adicione esta chave no seu aplicativo autenticador:</p><code style={{ overflowWrap: 'anywhere' }}>{setup.segredo}</code><a href={setup.uri}>Abrir no aplicativo autenticador</a></>}
      {(setup || status?.habilitado) && <label className="auth-field"><span>Código do autenticador{status?.habilitado ? ' ou de recuperação' : ''}</span><input autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} required minLength={6} maxLength={32} /></label>}
      {error && <p role="alert" className="auth-message auth-message--error">{error}</p>}
      <button className="button button--primary" disabled={busy || !status}>{busy ? 'Aguarde…' : status?.habilitado ? 'Desativar duas etapas' : setup ? 'Confirmar ativação' : 'Configurar duas etapas'}</button>
      <Link to="/recuperar-senha">Definir ou recuperar minha senha</Link><Link to="/conta">Voltar à conta</Link>
    </form>}
  </div></div></section>
}
