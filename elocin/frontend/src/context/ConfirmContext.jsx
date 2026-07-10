import { createContext, useCallback, useContext, useState } from 'react'
import { Modal } from '../components/ui/Modal.jsx'
import { Button } from '../components/ui/Button.jsx'

// useConfirm() returns an async confirm(options) → Promise<boolean>. Renders
// a single shared dialog so destructive actions get a consistent confirm
// flow instead of window.confirm() or unguarded deletes.
const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null) // { options, resolve }

  const confirm = useCallback(
    (options = {}) => new Promise((resolve) => setState({ options, resolve })),
    []
  )

  function close(result) {
    state?.resolve(result)
    setState(null)
  }

  const o = state?.options || {}

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={o.title || 'Are you sure?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {o.cancelLabel || 'Cancel'}
            </Button>
            <Button variant={o.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {o.confirmLabel || 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink2">{o.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
