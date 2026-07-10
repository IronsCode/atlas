export function Card({ className = '', ...props }) {
  return (
    <div
      className={`rounded-card border border-border bg-surface ${className}`}
      {...props}
    />
  )
}
