import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, getToken, setToken } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .me()
      .then((data) => {
        setUser(data.user)
        setOrganization(data.organization)
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (email, password) => {
    const data = await api.signin({ email, password })
    setToken(data.token)
    setUser(data.user)
    setOrganization(data.organization)
  }, [])

  const signUp = useCallback(async (fields) => {
    const data = await api.signup(fields)
    setToken(data.token)
    setUser(data.user)
    setOrganization(data.organization)
  }, [])

  const acceptInvite = useCallback(async (inviteToken, password) => {
    const data = await api.acceptInvite(inviteToken, { password })
    setToken(data.token)
    setUser(data.user)
    setOrganization(data.organization)
  }, [])

  const signOut = useCallback(() => {
    setToken(null)
    setUser(null)
    setOrganization(null)
  }, [])

  const updateUser = useCallback((patch) => setUser((u) => ({ ...u, ...patch })), [])
  const updateOrganization = useCallback((patch) => setOrganization((o) => ({ ...o, ...patch })), [])

  return (
    <AuthContext.Provider
      value={{ user, organization, loading, signIn, signUp, signOut, acceptInvite, updateUser, updateOrganization }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
