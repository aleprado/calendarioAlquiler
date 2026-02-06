import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

interface EventFormModalProps {
  isOpen: boolean
  range: { start: Date; end: Date; displayEnd: Date } | null
  onSubmit: (payload: { title: string; description?: string; location?: string }) => void
  onCancel: () => void
  isSubmitting?: boolean
  errorMessage?: string | null
}

const formatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' })
const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

const formatWithFallback = (fmt: Intl.DateTimeFormat, start: Date, end: Date) => {
  const maybeRangeFormatter = fmt as Intl.DateTimeFormat & {
    formatRange?: (start: Date, end: Date) => string
  }

  if (typeof maybeRangeFormatter.formatRange === 'function') {
    return maybeRangeFormatter.formatRange(start, end)
  }

  return `${fmt.format(start)} → ${fmt.format(end)}`
}

const hasExplicitTime = (date: Date) => date.getHours() !== 0 || date.getMinutes() !== 0

const formatRange = (start: Date, displayEnd: Date) => {
  const sameDay = start.toDateString() === displayEnd.toDateString()
  const includesTime = hasExplicitTime(start) || hasExplicitTime(displayEnd)

  if (sameDay) {
    return includesTime ? formatWithFallback(dateTimeFormatter, start, displayEnd) : formatter.format(start)
  }

  if (includesTime) {
    return formatWithFallback(dateTimeFormatter, start, displayEnd)
  }

  return `${formatter.format(start)} → ${formatter.format(displayEnd)}`
}

export const EventFormModal = ({
  isOpen,
  range,
  onSubmit,
  onCancel,
  isSubmitting = false,
  errorMessage,
}: EventFormModalProps) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setDescription('')
      setLocation('')
      setLocalError(null)
      inputRef.current?.focus()
    }
  }, [isOpen, range])

  if (!isOpen || !range) {
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      setLocalError('Necesitas ingresar un nombre para el evento.')
      return
    }

    onSubmit({
      title: trimmedTitle,
      description: description.trim() || undefined,
      location: location.trim() || undefined,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">Nuevo evento</h2>
        <p className="modal-range">{formatRange(range.start, range.displayEnd)}</p>
        <form onSubmit={handleSubmit} className="modal-form">
          <label htmlFor="event-title">Nombre del evento</label>
          <input
            id="event-title"
            type="text"
            ref={inputRef}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setLocalError(null)
            }}
            placeholder="Ej. Check-in familia Perez"
            disabled={isSubmitting}
          />
          <label htmlFor="event-location">Ubicacion (opcional)</label>
          <input
            id="event-location"
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Ej. Departamento 3B"
            disabled={isSubmitting}
          />
          <label htmlFor="event-description">Descripcion (opcional)</label>
          <textarea
            id="event-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Notas internas del evento"
            rows={3}
            disabled={isSubmitting}
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
              {isSubmitting ? 'Guardando...' : 'Crear evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
