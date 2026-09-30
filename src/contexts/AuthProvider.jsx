import { useCallback, useEffect, useMemo, useState } from 'react'
import { authService } from '../services/authService'
import { AuthContext } from './authContext'
import { userInitials } from '../utils/userInitials'
import './user-avatar.css'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    authService.profile()
      .then((profile) => {
        if (active) setUser(profile)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Compatibilidade com avatares existentes: o Header, a tela de Conta e o
  // Admin usam agora as mesmas iniciais reais, mesmo ao alternar de rota.
  // Não modificar nós de texto gerenciados pelo React; a camada visual lê
  // exclusivamente o atributo data-user-initials.
  useEffect(() => {
    if (!user) return undefined
    const sigla = userInitials(user)
    const atualizar = () => {
      document.querySelectorAll('.account-menu__avatar, .admin-avatar, .account-avatar').forEach((avatar) => {
        if (avatar.dataset.userInitials !== sigla) avatar.dataset.userInitials = sigla
      })
    }
    atualizar()
    const observer = new MutationObserver(atualizar)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [user])

  const refresh = useCallback(async () => {
    try {
      const profile = await authService.profile()
      setUser(profile)
      return profile
    } catch (error) {
      if (error?.status === 401) {
        setUser(null)
        return null
      }
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const profile = await authService.login(credentials)
    setUser(profile)
    return profile
  }, [])

  const register = useCallback(async (data) => {
    const profile = await authService.register(data)
    setUser(profile)
    return profile
  }, [])

  const googleLogin = useCallback(async (credential) => {
    const profile = await authService.google(credential)
    setUser(profile)
    return profile
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    googleLogin,
    logout,
    refresh,
  }), [user, loading, login, register, googleLogin, logout, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
