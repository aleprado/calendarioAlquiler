import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

interface RequestFormModalProps {
  isOpen: boolean
  range: { start: Date; end: Date; displayEnd: Date } | null
  onSubmit: (payload: { name: string; email?: string; phone?: string; notes?: string }) => void
  onCancel: () => void
  isSubmitting?: boolean
  errorMessage?: string | null
}

const formatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' })
const formatRange = (start: Date, end: Date) => formatter.formatRange?.(start, end) ?? `${formatter.format(start)} → ${formatter.format(end)}`

export const RequestFormModal = ({
  isOpen,
  range,
  onSubmit,
  onCancel,
  isSubmitting = false,
  errorMessage,
}: RequestFormModalProps) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setEmail('')
      setPhone('')
      setNotes('')
      setLocalError(null)
      nameRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen || !range) {
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setLocalError('Ingresa tu nombre para enviar la solicitud.')
      return
    }

    onSubmit({
      name: trimmed,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="request-modal-title">
        <h2 id="request-modal-title">Solicitar reserva</h2>
        <p className="modal-range">{formatRange(range.start, range.displayEnd)}</p>
        <form onSubmit={handleSubmit} className="modal-form">
          <label htmlFor="request-name">Nombre</label>
          <input
            id="request-name"
            type="text"
            ref={nameRef}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setLocalError(null)
            }}
            disabled={isSubmitting}
            placeholder="Tu nombre"
          />
          <label htmlFor="request-email">Email (opcional)</label>
          <input
            id="request-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
            placeholder="tu@email.com"
          />
          <label htmlFor="request-phone">Teléfono (opcional)</label>
          <input
            id="request-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={isSubmitting}
            placeholder="+54 11 1234 5678"
          />
          <label htmlFor="request-notes">Notas (opcional)</label>
          <textarea
            id="request-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={isSubmitting}
            placeholder="Detalles adicionales"
            rows={3}
          />
          <div className="modal-errors" role="alert">
            {localError && <span>{localError}</span>}
            {!localError && errorMessage && <span>{errorMessage}</span>}
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
