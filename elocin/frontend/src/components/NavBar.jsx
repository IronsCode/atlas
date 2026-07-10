import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export function NavBar() {
  const { user, organization, signOut } = useAuth()

  return (
    <nav className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
      <Link to="/" className="text-lg font-semibold text-sage">
        Elocin
      </Link>
      {user && (
        <div className="flex items-center gap-4 text-sm text-ink2">
          <span>{organization?.name}</span>
          <span>{user.full_name}</span>
          <button onClick={signOut} className="font-medium text-danger hover:underline">
            Sign out
          </button>
        </div>
      )}
    </nav>
  )
}
