/**
 * Elocin — Tailwind theme extension for the proposed "Calm Intelligence" identity.
 *
 * Two ways to adopt (see brand guidelines §14):
 *  A) HEX MODE (below): drop these values straight into tailwind.config.js
 *     `theme.extend`. Simple, but a theme flip means editing this file.
 *  B) VARIABLE MODE (recommended for migration): point Tailwind at the CSS
 *     custom properties in tokens.css, e.g. brand: 'var(--color-brand)'. Then
 *     light/dark and future rebrands are a CSS-variable change with zero
 *     class churn. A ready-to-use variable map is exported as `varTheme`.
 *
 * Requires: darkMode: 'class', and the Inter font loaded in index.html.
 */

const ramps = {
  teal: { 50:'#F0FDFA',100:'#CCFBF1',200:'#99F6E4',300:'#5EEAD4',400:'#2DD4BF',500:'#14B8A6',600:'#0D9488',700:'#0F766E',800:'#115E59',900:'#134E4A',950:'#042F2E' },
  slate:{ 50:'#F8FAFC',100:'#F1F5F9',200:'#E2E8F0',300:'#CBD5E1',400:'#94A3B8',500:'#64748B',600:'#475569',700:'#334155',800:'#1E293B',900:'#0F172A',950:'#020617' },
  coral:{ 50:'#FFF3F1',100:'#FFE4E0',200:'#FFCEC7',300:'#FCA89D',400:'#FB8A7B',500:'#F97366',600:'#E85A4D',700:'#C4453A',800:'#A03A31',900:'#83332C' },
  green:{ 50:'#F0FDF4',500:'#22C55E',600:'#16A34A',700:'#15803D' },
  amber:{ 50:'#FFFBEB',500:'#F59E0B',600:'#D97706',700:'#B45309' },
  red:  { 50:'#FEF2F2',500:'#EF4444',600:'#DC2626',700:'#B91C1C' },
  sky:  { 50:'#F0F9FF',500:'#0EA5E9',600:'#0284C7',700:'#0369A1' }
}

/** Option A — direct hex theme (light values; use dark: variants for dark). */
const hexTheme = {
  colors: {
    ...ramps,
    bg: '#FCFCFB',
    surface: '#FFFFFF',
    'surface-sunken': '#F8FAFC',
    border: '#E5E7EB',
    'border-strong': '#CBD5E1',
    text: '#0F172A',
    'text-muted': '#64748B',
    'text-subtle': '#94A3B8',
    brand: '#0F766E',
    'brand-hover': '#115E59',
    'brand-subtle': '#F0FDFA',
    'on-brand': '#FFFFFF',
    accent: '#F97366',
    'accent-strong': '#C4453A',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#DC2626',
    info: '#0284C7'
  }
}

/** Option B — semantic tokens bound to CSS variables (theme-flippable). */
const varTheme = {
  colors: {
    ...ramps, // keep raw ramps available for one-off tints
    bg: 'var(--color-bg)',
    surface: 'var(--color-surface)',
    'surface-sunken': 'var(--color-surface-sunken)',
    border: 'var(--color-border)',
    'border-strong': 'var(--color-border-strong)',
    text: 'var(--color-text)',
    'text-muted': 'var(--color-text-muted)',
    'text-subtle': 'var(--color-text-subtle)',
    brand: 'var(--color-brand)',
    'brand-hover': 'var(--color-brand-hover)',
    'brand-subtle': 'var(--color-brand-subtle)',
    'on-brand': 'var(--color-on-brand)',
    accent: 'var(--color-accent)',
    'accent-strong': 'var(--color-accent-strong)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
    info: 'var(--color-info)'
  }
}

const shared = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
  },
  fontSize: {
    overline: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.08em', fontWeight: '600' }],
    caption: ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '500' }],
    'body-sm': ['0.875rem', { lineHeight: '1.25rem' }],
    body: ['1rem', { lineHeight: '1.5rem' }],
    'body-lg': ['1.125rem', { lineHeight: '1.75rem' }],
    h4: ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.01em', fontWeight: '600' }],
    h3: ['1.375rem', { lineHeight: '1.875rem', letterSpacing: '-0.01em', fontWeight: '600' }],
    h2: ['1.75rem', { lineHeight: '2.25rem', letterSpacing: '-0.015em', fontWeight: '600' }],
    h1: ['2.25rem', { lineHeight: '2.625rem', letterSpacing: '-0.02em', fontWeight: '600' }],
    display: ['3rem', { lineHeight: '3.25rem', letterSpacing: '-0.02em', fontWeight: '600' }]
  },
  borderRadius: {
    xs: '4px', sm: '6px', md: '8px', lg: '10px', xl: '12px', '2xl': '16px', full: '9999px'
  },
  boxShadow: {
    xs: '0 1px 2px rgba(15,23,42,.04)',
    sm: '0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)',
    md: '0 4px 12px rgba(15,23,42,.08)',
    lg: '0 12px 32px -8px rgba(15,23,42,.12)',
    xl: '0 24px 64px -16px rgba(15,23,42,.18)',
    focus: '0 0 0 3px rgba(15,118,110,.35)'
  },
  transitionTimingFunction: {
    standard: 'cubic-bezier(.2,.8,.2,1)',
    exit: 'cubic-bezier(.4,0,1,1)'
  }
}

module.exports = {
  ramps,
  /** Recommended: spread into tailwind.config.js theme.extend */
  hexExtend: { ...shared, colors: hexTheme.colors },
  varExtend: { ...shared, colors: varTheme.colors }
}
