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

  // Signup no longer logs in — it only triggers the verification email. The
  // session is established later by completeSignup (after the email link).
  const signUp = useCallback(async (fields) => {
    return api.signup(fields)
  }, [])

  const completeSignup = useCallback(async (verifyToken, password) => {
    const data = await api.completeSignup(verifyToken, { password })
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
      value={{ user, organization, loading, signIn, signUp, completeSignup, signOut, acceptInvite, updateUser, updateOrganization }}
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
