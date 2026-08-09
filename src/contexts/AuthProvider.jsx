import { useCallback, useEffect, useMemo, useState } from 'react'
import { authService } from '../services/authService'
import { AuthContext } from './authContext'

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
    logout,
    refresh,
  }), [user, loading, login, register, logout, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
