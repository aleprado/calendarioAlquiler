import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

interface RequestFormModalProps {
  isOpen: boolean
  range: { start: Date; end: Date; displayEnd: Date } | null
  onSubmit: (payload: { name: string; email?: string; phone?: string; notes?: string; start: Date; end: Date }) => void
  onCancel: () => void
  isSubmitting?: boolean
  errorMessage?: string | null
}

const formatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' })
const formatRange = (start: Date, end: Date) => formatter.formatRange?.(start, end) ?? `${formatter.format(start)} → ${formatter.format(end)}`

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fromDateInputValue = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null
  return parsed
}

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
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && range) {
      setName('')
      setEmail('')
      setPhone('')
      setNotes('')
      setStartDate(toDateInputValue(range.start))
      setEndDate(toDateInputValue(range.end))
      setLocalError(null)
      nameRef.current?.focus()
    }
  }, [isOpen, range])

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

    const sMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate)
    const eMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endDate)
    if (!sMatch || !eMatch) {
      setLocalError('Debes completar una fecha de entrada y una fecha de salida válidas.')
      return
    }

    const sY = Number(sMatch[1])
    const sM = Number(sMatch[2])
    const sD = Number(sMatch[3])

    const eY = Number(eMatch[1])
    const eM = Number(eMatch[2])
    const eD = Number(eMatch[3])

    const startLocal = new Date(sY, sM - 1, sD)
    const endLocal = new Date(eY, eM - 1, eD)

    if (endLocal <= startLocal) {
      setLocalError('La fecha de salida debe ser posterior a la fecha de entrada.')
      return
    }

    onSubmit({
      name: trimmed,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      start: startLocal,
      end: endLocal,
    })
  }

  const previewStart = fromDateInputValue(startDate)
  const previewEnd = fromDateInputValue(endDate)
  const rangeLabel =
    previewStart && previewEnd && previewEnd >= previewStart ? formatRange(previewStart, previewEnd) : formatRange(range.start, range.end)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div className="modal modal--request" role="dialog" aria-modal="true" aria-labelledby="request-modal-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div>
            <h2 id="request-modal-title">Solicitar reserva</h2>
            <p className="modal-range">{rangeLabel}</p>
          </div>
          <button type="button" className="secondary modal-header-close" onClick={onCancel} disabled={isSubmitting}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="coordinate-row">
            <div>
              <label htmlFor="request-start-date">Fecha de inicio</label>
              <input
                id="request-start-date"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value)
                  setLocalError(null)
                }}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="request-end-date">Fecha de fin</label>
              <input
                id="request-end-date"
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value)
                  setLocalError(null)
                }}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <label htmlFor="request-name">Nombre completo *</label>
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
            required
          />

          <div className="coordinate-row">
            <div>
              <label htmlFor="request-email">Email (opcional)</label>
              <input
                id="request-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label htmlFor="request-phone">Teléfono (opcional)</label>
              <input
                id="request-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={isSubmitting}
                placeholder="+54 11 1234 5678"
              />
            </div>
          </div>

          <label htmlFor="request-notes">Notas (opcional)</label>
          <textarea
            id="request-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={isSubmitting}
            placeholder="Detalles adicionales sobre tu estadía"
            rows={2}
          />

          {(localError || errorMessage) && (
            <div className="modal-errors" role="alert">
              <span>{localError || errorMessage}</span>
            </div>
          )}

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
