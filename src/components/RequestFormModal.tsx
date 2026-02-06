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
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

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
      setEndDate(toDateInputValue(range.displayEnd))
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

    const parsedStart = fromDateInputValue(startDate)
    const parsedEndInclusive = fromDateInputValue(endDate)
    if (!parsedStart || !parsedEndInclusive) {
      setLocalError('Debes completar una fecha de inicio y una fecha de fin válidas.')
      return
    }

    if (parsedEndInclusive < parsedStart) {
      setLocalError('La fecha de fin no puede ser anterior a la de inicio.')
      return
    }

    onSubmit({
      name: trimmed,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      start: parsedStart,
      end: addDays(parsedEndInclusive, 1),
    })
  }

  const previewStart = fromDateInputValue(startDate)
  const previewEnd = fromDateInputValue(endDate)
  const rangeLabel =
    previewStart && previewEnd && previewEnd >= previewStart ? formatRange(previewStart, previewEnd) : formatRange(range.start, range.displayEnd)

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="request-modal-title">
        <h2 id="request-modal-title">Solicitar reserva</h2>
        <p className="modal-range">{rangeLabel}</p>
        <form onSubmit={handleSubmit} className="modal-form">
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
            required
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
