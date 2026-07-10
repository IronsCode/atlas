import { useState } from 'react'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Button } from '../components/ui/Button.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { IconSettings, IconMail } from '../components/ui/Icon.jsx'

const APP_VERSION = '0.1.0'
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@elocin.app'

export function SettingsPage() {
  const { user, organization, updateUser, updateOrganization } = useAuth()
  const toast = useToast()
  const role = user?.role || user?.org_role || null
  const canEditOrg = ['owner', 'admin'].includes(role)

  return (
    <div className="mx-auto max-w-2xl p-6">
      <PageHeader icon={IconSettings} title="Settings" subtitle="Manage your account, security, and organization." />
      <div className="space-y-4">
        <AccountCard user={user} role={role} onSaved={updateUser} toast={toast} />
        <SecurityCard toast={toast} />
        {canEditOrg && <OrgCard organization={organization} onSaved={updateOrganization} toast={toast} />}
        <SupportCard user={user} />
      </div>
    </div>
  )
}

function SettingSection({ title, description, children }) {
  return (
    <Card className="p-5">
      <div className="mb-3">
        <div className="text-sm font-semibold text-ink">{title}</div>
        {description && <p className="mt-0.5 text-xs text-ink3">{description}</p>}
      </div>
      {children}
    </Card>
  )
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-ink3">{label}</div>
      <div className="text-sm text-ink">{value || '—'}</div>
    </div>
  )
}

// -- Account: editable name + read-only email / role / member-since ----------
function AccountCard({ user, role, onSaved, toast }) {
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e.preventDefault()
    if (!fullName.trim()) return
    setSaving(true)
    try {
      const { user: updated } = await api.updateProfile({ full_name: fullName.trim() })
      onSaved({ full_name: updated.full_name })
      toast.success('Profile updated.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : null

  return (
    <SettingSection title="Account" description="Your account details.">
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink3">Full name</label>
          <div className="flex items-end gap-2">
            <Input className="flex-1" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Button disabled={saving || !fullName.trim() || fullName.trim() === user?.full_name}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
          <ReadOnlyField label="Email" value={user?.email} />
          <ReadOnlyField label="Role" value={<span className="capitalize">{role || 'member'}</span>} />
          {memberSince && <ReadOnlyField label="Member since" value={memberSince} />}
        </div>
      </form>
    </SettingSection>
  )
}

// -- Security: change password (confirm + show/hide) + sign out others -------
function SecurityCard({ toast }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const tooShort = next.length > 0 && next.length < 8
  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit = current && next.length >= 8 && next === confirm

  async function save(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      await api.changePassword({ current_password: current, new_password: next })
      setCurrent(''); setNext(''); setConfirm('')
      toast.success('Password changed. Other devices have been signed out.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function signOutOthers() {
    if (!window.confirm('Sign out of all other devices? You’ll stay signed in here.')) return
    setSigningOut(true)
    try {
      await api.signOutOthers()
      toast.success('Signed out of all other devices.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSigningOut(false)
    }
  }

  const pwType = show ? 'text' : 'password'
  return (
    <SettingSection title="Security" description="Change your password or sign out of other devices.">
      <form onSubmit={save} className="space-y-2">
        <Input type={pwType} placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input type={pwType} placeholder="New password (at least 8 characters)" value={next} onChange={(e) => setNext(e.target.value)} />
        <Input type={pwType} placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {tooShort && <p className="text-xs text-danger">Password must be at least 8 characters.</p>}
        {mismatch && <p className="text-xs text-danger">Passwords don’t match.</p>}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-1.5 text-xs text-ink3">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            Show passwords
          </label>
          <Button disabled={saving || !canSubmit}>{saving ? 'Updating…' : 'Change password'}</Button>
        </div>
      </form>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="text-xs text-ink3">Signed in on a shared or lost device? Sign out everywhere else.</div>
        <Button variant="secondary" onClick={signOutOthers} disabled={signingOut}>
          {signingOut ? 'Signing out…' : 'Sign out other devices'}
        </Button>
      </div>
    </SettingSection>
  )
}

// -- Organization (owner/admin) ----------------------------------------------
function OrgCard({ organization, onSaved, toast }) {
  const [name, setName] = useState(organization?.name || '')
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const { organization: updated } = await api.updateOrg({ name: name.trim() })
      onSaved({ name: updated.name })
      toast.success('Organization updated.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingSection title="Organization" description="Shown in the sidebar and on reports.">
      <form onSubmit={save} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink3">Organization name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button disabled={saving || !name.trim() || name.trim() === organization?.name}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </SettingSection>
  )
}

// -- Support -----------------------------------------------------------------
function SupportCard({ user }) {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Elocin support request')}` +
    `&body=${encodeURIComponent(`\n\n---\nAccount: ${user?.email || ''}\nVersion: ${APP_VERSION}`)}`
  return (
    <SettingSection title="Support" description="Get help or report a problem.">
      <a href={mailto} className="inline-flex items-center gap-2 text-sm text-sage hover:underline">
        <IconMail className="text-[14px]" />
        Contact support
      </a>
      <p className="mt-3 text-xs text-ink3">Elocin · v{APP_VERSION}</p>
    </SettingSection>
  )
}
