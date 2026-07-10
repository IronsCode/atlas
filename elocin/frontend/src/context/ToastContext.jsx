import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { IconCheck, IconAlertCircle, IconX } from '../components/ui/Icon.jsx'

// Lightweight app-wide toast system. useToast() returns { success, error, info }
// helpers; toasts auto-dismiss after 4s and stack top-right. No dependency.
const ToastContext = createContext(null)

const TONE = {
  success: { icon: IconCheck, cls: 'border-sage/30 bg-sageLight text-ink2', iconCls: 'text-sage' },
  error: { icon: IconAlertCircle, cls: 'border-danger/30 bg-dangerLight text-ink2', iconCls: 'text-danger' },
  info: { icon: IconAlertCircle, cls: 'border-info/30 bg-infoLight text-ink2', iconCls: 'text-info' }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback((tone, message) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, tone, message }])
    return id
  }, [])

  const api = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m)
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }) {
  const tone = TONE[toast.tone] || TONE.info
  const Icon = tone.icon
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4000)
    return () => window.clearTimeout(timer)
  }, [onDismiss])
  return (
    <div
      className={`pointer-events-auto flex items-start gap-2 rounded-card border p-3 shadow-sm ${tone.cls}`}
      role="status"
    >
      <Icon className={`mt-0.5 flex-shrink-0 ${tone.iconCls}`} />
      <span className="flex-1 text-sm">{toast.message}</span>
      <button onClick={onDismiss} className="flex-shrink-0 text-ink3 hover:text-ink" aria-label="Dismiss">
        <IconX />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
