/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  text: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (text: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((text: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts((prev) => [...prev, { id, text, type }])

    setTimeout(() => {
      removeToast(id)
    }, 4000)
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item toast-item--${toast.type}`}>
            <span className="toast-item__icon">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="toast-item__text">{toast.text}</span>
            <button
              type="button"
              className="toast-item__close"
              onClick={() => removeToast(toast.id)}
              aria-label="Cerrar notificación"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
