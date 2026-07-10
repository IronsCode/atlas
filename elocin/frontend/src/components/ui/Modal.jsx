import { useEffect } from 'react'
import { IconX } from './Icon.jsx'

// Base modal: backdrop + centered card, Escape to close, title + optional
// footer. Used by Create Classroom, the confirm dialog, and global search.
export function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-ink/40 p-4 pt-24"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-card border border-border bg-surface shadow-lg`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <button onClick={onClose} className="text-ink3 hover:text-ink" aria-label="Close">
              <IconX />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}
