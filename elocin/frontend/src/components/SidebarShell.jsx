import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useScope } from '../context/ScopeContext.jsx'
import { GlobalSearch } from './GlobalSearch.jsx'
import {
  IconDashboard,
  IconPencilPlus,
  IconUsers,
  IconUserPlus,
  IconFileReport,
  IconChecklist,
  IconChartPie,
  IconSignOut,
  IconSearch,
  IconSettings,
  IconNotes,
  IconTarget,
  IconAlertTriangle
} from './ui/Icon.jsx'

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
      { to: '/observations/new', label: 'Add observation', icon: IconPencilPlus },
      { to: '/students', label: 'Students', icon: IconUsers }
    ]
  },
  {
    label: 'Tracking',
    items: [
      { to: '/observations', label: 'Observations', icon: IconNotes },
      { to: '/goals', label: 'Goals', icon: IconTarget },
      { to: '/interventions', label: 'Interventions', icon: IconAlertTriangle }
    ]
  },
  {
    label: 'Reports',
    items: [
      { to: '/conference', label: 'Conference', icon: IconFileReport },
      { to: '/milestones', label: 'Milestones', icon: IconChecklist }
    ]
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin', label: 'Admin', icon: IconChartPie, roles: ['owner', 'admin'] },
      { to: '/users', label: 'Users', icon: IconUserPlus, roles: ['owner', 'admin'] },
      { to: '/settings', label: 'Settings', icon: IconSettings }
    ]
  }
]

export function SidebarShell() {
  const { user, organization, signOut } = useAuth()
  const { teams, teamId, setTeamId } = useScope()
  const role = user?.role || user?.org_role || null
  const [searchOpen, setSearchOpen] = useState(false)

  // Global Cmd/Ctrl-K opens search from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex min-h-screen bg-bg">
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <aside className="flex w-52 flex-shrink-0 flex-col bg-ink">
        <div className="px-4 pb-3 pt-5">
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            <span className="h-2 w-2 rounded-full bg-sage" />
            Elocin
          </div>
          <div className="mt-1 text-xs text-ink3">{organization?.name}</div>
          {teams.length > 0 && (
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              aria-label="Filter by classroom"
              className="mt-2 w-full rounded-sm border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90 focus:border-sage focus:outline-none"
            >
              <option value="">All classrooms</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id} className="text-ink">
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setSearchOpen(true)}
            className="mt-2 flex w-full items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-ink3 hover:text-white"
          >
            <IconSearch />
            <span className="flex-1 text-left">Search…</span>
            <span className="rounded border border-white/15 px-1 text-[10px] text-ink3">⌘K</span>
          </button>
        </div>
        <div className="mx-4 h-px bg-white/10" />
        <nav className="flex-1 py-2">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((item) => !item.roles || item.roles.includes(role))
            if (!items.length) return null
            return (
              <div key={section.label}>
                <div className="px-4 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-ink2">
                  {section.label}
                </div>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 border-l-2 px-4 py-2 text-sm transition-colors ${
                        isActive
                          ? 'border-sage bg-sage/20 text-sage'
                          : 'border-transparent text-ink3 hover:text-white'
                      }`
                    }
                  >
                    <item.icon />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="border-t border-white/10 px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-ink3">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" />
            {user?.full_name} {role ? `· ${role}` : ''}
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-xs font-medium text-danger hover:underline"
          >
            <IconSignOut />
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
