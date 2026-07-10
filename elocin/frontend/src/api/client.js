/**
 * client.js
 * Thin fetch wrapper for the Elocin API. Token lives in localStorage;
 * every authenticated request attaches it as a Bearer header.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const TOKEN_KEY = 'elocin_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  if (res.status === 204) return null

  const data = await res.json().catch(() => null)

  // Expired/invalidated session on an authenticated request: clear the dead
  // token and send the user to sign in, instead of leaving them stuck on a page
  // where every action fails with "Unauthorised". (auth:false requests like
  // signin keep their 401 as a normal credential error.)
  if (res.status === 401 && auth) {
    setToken(null)
    if (typeof window !== 'undefined' && window.location.pathname !== '/signin') {
      window.location.href = '/signin'
    }
    throw new Error('Your session has expired. Please sign in again.')
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}

// Downloads the report PDF as a blob (a plain <a href> can't attach the
// Authorization header the route requires) and triggers a save.
async function downloadReportPdf(id) {
  const token = getToken()
  const res = await fetch(`${API_URL}/reports/${id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!res.ok) throw new Error('Failed to download PDF')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report-${id}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  signup: (body) => request('/auth/signup', { method: 'POST', body, auth: false }),
  signin: (body) => request('/auth/signin', { method: 'POST', body, auth: false }),
  me: () => request('/auth/me'),
  updateProfile: (body) => request('/auth/me', { method: 'PATCH', body }),
  // change-password reissues the JWT (all older tokens are invalidated
  // server-side), so store the fresh token to keep this device signed in.
  changePassword: async (body) => {
    const data = await request('/auth/change-password', { method: 'POST', body })
    if (data?.token) setToken(data.token)
    return data
  },
  forgotPassword: (body) => request('/auth/forgot-password', { method: 'POST', body, auth: false }),
  resetPassword: (body) => request('/auth/reset-password', { method: 'POST', body, auth: false }),
  // Invalidates all other sessions and returns a fresh token for this device.
  signOutOthers: async () => {
    const data = await request('/auth/sign-out-others', { method: 'POST' })
    if (data?.token) setToken(data.token)
    return data
  },
  updateOrg: (body) => request('/auth/org', { method: 'PATCH', body }),
  getInvite: (token) => request(`/auth/invite/${token}`, { auth: false }),
  acceptInvite: (token, body) =>
    request(`/auth/invite/${token}/accept`, { method: 'POST', body, auth: false }),

  // Fire-and-forget product telemetry (M1B). Never awaited, never throws —
  // a telemetry failure must never affect the UI. Only IDs/enums/durations;
  // never raw text or names (the server also strips anything else).
  track: (event, props = {}) => {
    request('/events', { method: 'POST', body: { event, ...props } }).catch(() => {})
  },

  getDashboard: (teamId) => request(`/dashboard${teamId ? `?team_id=${teamId}` : ''}`),

  getPersonInsights: (personId) => request(`/insights/people/${personId}`),
  getTeamPatterns: (teamId) => request(`/insights/teams/${teamId}`),
  getLexiconMisses: () => request('/insights/lexicon-misses'),

  listUsers: () => request('/users'),
  inviteUser: (body) => request('/users/invite', { method: 'POST', body }),
  deactivateUser: (id) => request(`/users/${id}/deactivate`, { method: 'PATCH' }),

  listParentContacts: (personId) => request(`/parent-contacts/people/${personId}`),
  createParentContact: (body) => request('/parent-contacts', { method: 'POST', body }),
  sendParentInvite: (id) => request(`/parent-contacts/${id}/send-invite`, { method: 'POST' }),

  listTeams: () => request('/teams'),
  createTeam: (body) => request('/teams', { method: 'POST', body }),
  getTeam: (id) => request(`/teams/${id}`),
  updateTeam: (id, body) => request(`/teams/${id}`, { method: 'PATCH', body }),
  deleteTeam: (id) => request(`/teams/${id}`, { method: 'DELETE' }),

  listAllPeople: () => request('/people'),
  listPeople: (teamId) => request(`/people/teams/${teamId}`),
  createPerson: (body) => request('/people', { method: 'POST', body }),
  getPerson: (id) => request(`/people/${id}`),
  updatePerson: (id, body) => request(`/people/${id}`, { method: 'PATCH', body }),
  deletePerson: (id) => request(`/people/${id}`, { method: 'DELETE' }),
  setPersonClassroom: (id, team_id) => request(`/people/${id}/enrollment`, { method: 'PATCH', body: { team_id } }),

  listObservations: (personId) => request(`/observations/people/${personId}`),
  createObservation: (body) => request('/observations', { method: 'POST', body }),
  previewObservation: (body) => request('/observations/preview', { method: 'POST', body }),
  getTaxonomy: () => request('/observations/taxonomy'),
  searchObservations: (q) => request(`/observations/search?q=${encodeURIComponent(q)}`),
  listRecentObservations: (teamId, range) => {
    const qs = new URLSearchParams()
    if (teamId) qs.set('team_id', teamId)
    if (range) qs.set('range', range)
    const s = qs.toString()
    return request(`/observations${s ? `?${s}` : ''}`)
  },

  listGoals: (personId) => request(`/goals/people/${personId}`),
  listActiveGoals: (teamId) => request(`/goals${teamId ? `?team_id=${teamId}` : ''}`),
  createGoal: (body) => request('/goals', { method: 'POST', body }),
  updateGoal: (id, body) => request(`/goals/${id}`, { method: 'PATCH', body }),
  listGoalStatusHistory: (personId) => request(`/goals/people/${personId}/status-history`),

  listInterventions: (personId) => request(`/interventions/people/${personId}`),
  listActiveInterventions: (teamId) => request(`/interventions${teamId ? `?team_id=${teamId}` : ''}`),
  createIntervention: (body) => request('/interventions', { method: 'POST', body }),
  updateIntervention: (id, body) => request(`/interventions/${id}`, { method: 'PATCH', body }),

  listReports: (personId, reportType) =>
    request(`/reports/people/${personId}${reportType ? `?report_type=${reportType}` : ''}`),
  getReport: (id) => request(`/reports/${id}`),
  createReport: (body) => request('/reports', { method: 'POST', body }),
  regenerateReport: (id) => request(`/reports/${id}/regenerate`, { method: 'POST' }),
  generateNarrative: (id) => request(`/reports/${id}/narrative`, { method: 'POST' }),
  toggleReportLock: (id, is_locked) => request(`/reports/${id}`, { method: 'PATCH', body: { is_locked } }),
  downloadReportPdf,

  listMilestones: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/milestones${qs ? `?${qs}` : ''}`)
  },
  createMilestone: (body) => request('/milestones', { method: 'POST', body }),
  updateMilestone: (id, body) => request(`/milestones/${id}`, { method: 'PATCH', body }),
  deleteMilestone: (id) => request(`/milestones/${id}`, { method: 'DELETE' }),
  listPersonMilestones: (personId) => request(`/milestones/people/${personId}`),
  setMilestoneStatus: (milestoneId, personId, body) =>
    request(`/milestones/${milestoneId}/people/${personId}`, { method: 'PATCH', body })
}
