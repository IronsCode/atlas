export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink3 focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage ${className}`}
      {...props}
    />
  )
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink3 focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage ${className}`}
      {...props}
    />
  )
}
