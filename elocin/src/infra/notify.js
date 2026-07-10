/**
 * notify.js
 * Delivery for the parent opt-in invite link — intended to send via
 * Twilio (SMS) / SendGrid (email), but this environment has no
 * credentials for either and no way to test a live send, so
 * sendOptinInvite() runs in SAMPLE MODE ONLY: it builds the real
 * message content (not a hardcoded string — reflects the actual invite
 * link and channel) and logs it instead of calling an external API,
 * clearly labeled as a sample.
 *
 * Wiring up real delivery later means: add the `twilio` and/or
 * `@sendgrid/mail` dependencies, add `TWILIO_*`/`SENDGRID_API_KEY` env
 * vars, and replace this function's body with real API calls per
 * channel — the call site (api/routes/parentContacts.js) doesn't need
 * to change.
 */

export async function sendOptinInvite(contact, optinUrl) {
  const channel = contact.invited_email && contact.invited_phone ? 'both'
    : contact.invited_phone ? 'sms' : 'email'

  const message = `You've been invited to opt in to updates. Follow this link to confirm: ${optinUrl}`

  console.log(
    `[SAMPLE — not a live send] Would deliver via ${channel} — ` +
    `email: ${contact.invited_email || 'n/a'}, phone: ${contact.invited_phone || 'n/a'} — "${message}"`
  )

  return { sent: false, sample: true, channel, message }
}

// Same SAMPLE MODE approach as sendOptinInvite() above, for the staff
// teammate-invite flow (api/routes/users.js) — builds the real invite
// link and logs it instead of a live email send.
export async function sendStaffInvite(user, acceptUrl) {
  const message = `You've been invited to join ${user.org_name || 'an organisation'} on Elocin as ${user.role}. Follow this link to set your password: ${acceptUrl}`

  console.log(
    `[SAMPLE — not a live send] Would deliver via email — email: ${user.email} — "${message}"`
  )

  return { sent: false, sample: true, channel: 'email', message }
}

// ---------------------------------------------------------------------------
// Password reset email — Resend (production) with a dev SAMPLE MODE fallback.
//
// Transport is Resend's REST API called directly with the built-in fetch — no
// SDK dependency (the SDK is just a wrapper over this call). Synchronous, no
// queue, no worker. Live mode requires RESEND_API_KEY + FROM_EMAIL; without
// them we stay in SAMPLE MODE (dev only). assertEmailConfig() makes that fatal
// at boot in production. See api/routes/auth.js for the (unchanged) call site.
// ---------------------------------------------------------------------------
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

// live only when both are configured; otherwise SAMPLE MODE.
function emailIsLive() {
  return !!(process.env.RESEND_API_KEY && process.env.FROM_EMAIL)
}

// Boot guard: production must have real email config. Throws (server.js exits).
export function assertEmailConfig() {
  if (process.env.NODE_ENV !== 'production') return
  const missing = ['RESEND_API_KEY', 'FROM_EMAIL', 'FRONTEND_URL'].filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(`Email delivery not configured for production: missing ${missing.join(', ')}.`)
  }
}

// The email content. No account information, no password hints — only the
// action link, the 1-hour expiry, and an "ignore this if it wasn't you" note.
export function buildResetEmail(resetUrl) {
  const subject = 'Reset your Elocin password'
  const text =
    `We received a request to reset your Elocin password.\n\n` +
    `Reset it here (this link expires in 1 hour):\n${resetUrl}\n\n` +
    `If you didn't request this, you can safely ignore this email — your password won't change.`
  const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#33322e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td style="font-size:18px;font-weight:600;padding-bottom:8px;">Reset your password</td></tr>
      <tr><td style="font-size:14px;line-height:1.6;color:#5c5a52;padding-bottom:24px;">
        We received a request to reset your Elocin password. This link expires in <strong>1 hour</strong>.
      </td></tr>
      <tr><td style="padding-bottom:24px;">
        <a href="${resetUrl}" style="display:inline-block;background:#6b8f71;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">Reset password</a>
      </td></tr>
      <tr><td style="font-size:12px;line-height:1.6;color:#8a887f;">
        If the button doesn't work, copy this link into your browser:<br>
        <span style="color:#6b8f71;word-break:break-all;">${resetUrl}</span>
      </td></tr>
      <tr><td style="font-size:12px;line-height:1.6;color:#8a887f;padding-top:24px;border-top:1px solid #eceae3;">
        If you didn't request this, you can safely ignore this email — your password won't change.
      </td></tr>
    </table>
  </td></tr></table></body></html>`
  return { subject, text, html }
}

export async function sendPasswordReset(user, resetUrl) {
  const { subject, text, html } = buildResetEmail(resetUrl)

  // SAMPLE MODE (dev only): print the link so a developer can complete the flow
  // locally. Never runs in production (assertEmailConfig guards boot).
  if (!emailIsLive()) {
    console.log(`[SAMPLE — not a live send] password reset link for ${user.email}: ${resetUrl}`)
    return { sent: false, sample: true, channel: 'email' }
  }

  // Live send via Resend REST API. Never throws to the caller — on any failure
  // we log (without the token/URL) and return, so the route's generic response
  // is preserved and no partial state is corrupted.
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: process.env.FROM_EMAIL, to: user.email, subject, text, html })
    })
    if (!res.ok) {
      // Log status only — never the response body (could echo the link/token).
      console.error(`[email] password reset send failed (status ${res.status})`)
      return { sent: false, sample: false, channel: 'email', error: true }
    }
    console.log('[email] password reset email sent')
    return { sent: true, sample: false, channel: 'email' }
  } catch (err) {
    console.error(`[email] password reset transport error: ${err.message}`)
    return { sent: false, sample: false, channel: 'email', error: true }
  }
}
