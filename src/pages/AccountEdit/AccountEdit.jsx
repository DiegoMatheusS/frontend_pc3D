import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { authService } from '../../services/authService'
import './AccountEdit.css'

function strongPassword(value) {
  return value.length >= 8
    && value.length <= 128
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value)
}

export default function AccountEdit() {
  const { user, refresh, logout } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(user.nome || '')
  const [email, setEmail] = useState(user.email || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  async function saveProfile(event) {
    event.preventDefault()
    setProfileMessage('')
    setProfileError('')
    if (name.trim().length < 2) return setProfileError('Informe um nome válido.')
    if (!email.trim()) return setProfileError('Informe um e-mail válido.')
    setSavingProfile(true)
    try {
      await authService.updateProfile({ nome: name.trim(), email: email.trim() })
      const updated = await refresh()
      setName(updated?.nome || name.trim())
      setEmail(updated?.email || email.trim())
      setProfileMessage('Cadastro atualizado com sucesso.')
    } catch (error) {
      setProfileError(error?.message || 'Não foi possível atualizar o cadastro.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    setPasswordError('')
    if (!currentPassword) return setPasswordError('Informe sua senha atual.')
    if (!strongPassword(newPassword)) return setPasswordError('A nova senha deve ter 8 a 128 caracteres, maiúscula, minúscula, número e símbolo.')
    if (newPassword !== confirmPassword) return setPasswordError('A confirmação da nova senha não confere.')
    setSavingPassword(true)
    try {
      await authService.changePassword({ senhaAtual: currentPassword, novaSenha: newPassword })
      await logout()
      navigate('/entrar?senhaAlterada=1', { replace: true })
    } catch (error) {
      setPasswordError(error?.message || 'Não foi possível alterar a senha.')
      setSavingPassword(false)
    }
  }

  return (
    <section className="account-edit-page">
      <div className="page-container account-edit-layout">
        <Link className="account-edit-back" to="/conta">← Voltar para minha conta</Link>
        <header className="account-edit-heading"><span className="eyebrow">Perfil e segurança</span><h1>Alterar cadastro</h1><p>Atualize seus dados pessoais e, quando necessário, troque sua senha.</p></header>

        <section className="account-edit-panel" aria-labelledby="profile-data-title">
          <div className="account-edit-panel__heading"><div><span className="eyebrow">Cadastro</span><h2 id="profile-data-title">Dados da conta</h2></div><p>Nome e e-mail são atualizados no seu cadastro.</p></div>
          <form className="account-edit-form" onSubmit={saveProfile}>
            <label><span>Nome</span><input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength="2" maxLength="120" required /></label>
            <label><span>E-mail</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <div className="account-edit-actions"><button className="button button--primary" type="submit" disabled={savingProfile}>{savingProfile ? 'Salvando…' : 'Salvar alterações'}</button>{profileMessage && <span className="account-edit-message is-success" role="status">{profileMessage}</span>}{profileError && <span className="account-edit-message is-error" role="alert">{profileError}</span>}</div>
          </form>
        </section>

        <section className="account-edit-panel" aria-labelledby="profile-password-title">
          <div className="account-edit-panel__heading"><div><span className="eyebrow">Segurança</span><h2 id="profile-password-title">Alterar senha</h2></div><p>Depois da alteração, as sessões são revogadas e será necessário entrar novamente.</p></div>
          <form className="account-edit-form account-edit-form--password" onSubmit={changePassword}>
            <label><span>Senha atual</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
            <label><span>Nova senha</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength="8" maxLength="128" required /></label>
            <label><span>Confirmar nova senha</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength="8" maxLength="128" required /></label>
            <small>Use pelo menos 8 caracteres, com maiúscula, minúscula, número e símbolo.</small>
            <div className="account-edit-actions"><button className="button button--secondary" type="submit" disabled={savingPassword}>{savingPassword ? 'Alterando…' : 'Alterar senha'}</button>{passwordError && <span className="account-edit-message is-error" role="alert">{passwordError}</span>}</div>
          </form>
        </section>
      </div>
    </section>
  )
}
