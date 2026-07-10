import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useAuth } from './AuthContext.jsx'

// App-wide roster scope. A classroom (team) selected in the sidebar, under
// the org name, narrows every roster view (Students, Conference) and the
// Dashboard aggregates to that one classroom. Empty string = all classrooms
// the user belongs to (the default, unscoped behaviour). The teams list is
// the same set GET /teams returns — the teams the caller is a member of, so
// the picker can never scope to a classroom the user can't already see.
//
// Subject filtering is a deliberate follow-up: subjects only exist through
// logged observations (the `domain` field), not as a student attribute, so
// scoping by subject needs a backend change the classroom scope doesn't.
const ScopeContext = createContext(null)
const STORAGE_KEY = 'elocin_scope_team'

export function ScopeProvider({ children }) {
  const { user } = useAuth()
  const [teams, setTeams] = useState([])
  const [teamId, setTeamIdState] = useState(() => localStorage.getItem(STORAGE_KEY) || '')

  function setTeamId(id) {
    setTeamIdState(id)
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  }

  function reloadTeams() {
    if (!user) return Promise.resolve()
    return api
      .listTeams()
      .then(({ data }) => setTeams(data))
      .catch(() => setTeams([]))
  }

  useEffect(() => {
    if (!user) {
      setTeams([])
      return
    }
    reloadTeams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Drop a persisted selection that's no longer a classroom the user can see
  // (team archived, membership removed, or a different account signed in).
  useEffect(() => {
    if (teamId && teams.length && !teams.some((t) => t.id === teamId)) {
      setTeamIdState('')
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [teams, teamId])

  const activeTeam = teams.find((t) => t.id === teamId) || null

  return (
    <ScopeContext.Provider value={{ teams, teamId, setTeamId, activeTeam, reloadTeams }}>
      {children}
    </ScopeContext.Provider>
  )
}

export function useScope() {
  const ctx = useContext(ScopeContext)
  if (!ctx) throw new Error('useScope must be used within ScopeProvider')
  return ctx
}
