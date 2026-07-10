const VARIANTS = {
  primary: 'bg-sage text-white hover:bg-sage/90 disabled:opacity-50',
  secondary: 'bg-surface text-ink border border-border hover:bg-surface2 disabled:opacity-50',
  danger: 'bg-danger text-white hover:bg-danger/90 disabled:opacity-50',
  link: 'text-sage hover:underline disabled:opacity-40 disabled:hover:no-underline'
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const base =
    variant === 'link'
      ? 'text-sm font-medium'
      : 'rounded-sm px-4 py-2 text-sm font-medium transition-colors'
  return <button className={`${base} ${VARIANTS[variant]} ${className}`} {...props} />
}
