import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

interface EventFormModalProps {
  isOpen: boolean
  range: { start: Date; end: Date; displayEnd: Date } | null
  onSubmit: (payload: { title: string; description?: string; location?: string; start: Date; end: Date }) => void
  onCancel: () => void
  isSubmitting?: boolean
  errorMessage?: string | null
  mode?: 'create' | 'edit'
  initialValues?: { title?: string; description?: string; location?: string } | null
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
  mode = 'create',
  initialValues,
}: EventFormModalProps) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && range) {
      setTitle(initialValues?.title ?? '')
      setDescription(initialValues?.description ?? '')
      setLocation(initialValues?.location ?? '')
      setStartDate(toDateInputValue(range.start))
      setEndDate(toDateInputValue(range.displayEnd))
      setLocalError(null)
      inputRef.current?.focus()
    }
  }, [initialValues?.description, initialValues?.location, initialValues?.title, isOpen, range])

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
      title: trimmedTitle,
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      start: parsedStart,
      end: addDays(parsedEndInclusive, 1),
    })
  }

  const previewStart = fromDateInputValue(startDate)
  const previewEnd = fromDateInputValue(endDate)
  const hasValidPreview = Boolean(previewStart && previewEnd && previewEnd >= previewStart)
  const rangeLabel = hasValidPreview && previewStart && previewEnd ? formatRange(previewStart, previewEnd) : formatRange(range.start, range.displayEnd)

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">{mode === 'edit' ? 'Editar evento' : 'Nuevo evento'}</h2>
        <p className="modal-range">{rangeLabel}</p>
        <form onSubmit={handleSubmit} className="modal-form">
          <label htmlFor="event-start-date">Fecha de inicio</label>
          <input
            id="event-start-date"
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value)
              setLocalError(null)
            }}
            disabled={isSubmitting}
          />
          <label htmlFor="event-end-date">Fecha de fin</label>
          <input
            id="event-end-date"
            type="date"
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value)
              setLocalError(null)
            }}
            disabled={isSubmitting}
          />
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
            required
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
              {isSubmitting ? 'Guardando...' : mode === 'edit' ? 'Guardar cambios' : 'Crear evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
