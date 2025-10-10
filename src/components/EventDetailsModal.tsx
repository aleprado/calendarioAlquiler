import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { CalendarEvent } from '../types'

const formatDateRange = (start: Date, end: Date) => {
  const startLabel = format(start, "EEEE d 'de' MMMM yyyy", { locale: es })
  const endLabel = format(end, "EEEE d 'de' MMMM yyyy", { locale: es })
  return `${startLabel} → ${endLabel}`
}

const statusLabels: Record<CalendarEvent['status'], string> = {
  confirmed: 'Confirmado',
  tentative: 'Tentativo',
  pending: 'Pendiente',
  declined: 'Declinado',
}

interface EventDetailsModalProps {
  isOpen: boolean
  event: CalendarEvent | null
  onClose: () => void
  onDelete?: () => void
  onConfirm?: () => void
  onDecline?: () => void
  isProcessing?: boolean
  errorMessage?: string | null
}

export const EventDetailsModal = ({
  isOpen,
  event,
  onClose,
  onDelete,
  onConfirm,
  onDecline,
  isProcessing = false,
  errorMessage,
}: EventDetailsModalProps) => {
  if (!isOpen || !event) {
    return null
  }

  const showRequesterInfo = event.source === 'public'

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="event-details-title">
        <h2 id="event-details-title">{event.title}</h2>
        <p className="modal-range">{formatDateRange(event.start, event.end)}</p>
        <dl className="event-details-list">
          <div>
            <dt>Estado</dt>
            <dd>{statusLabels[event.status]}</dd>
          </div>
          <div>
            <dt>Origen</dt>
            <dd>{event.source === 'airbnb' ? 'Airbnb (sincronizado)' : event.source === 'public' ? 'Solicitud pública' : 'Manual'}</dd>
          </div>
          {event.description && (
            <div>
              <dt>Descripción</dt>
              <dd>{event.description}</dd>
            </div>
          )}
          {event.location && (
            <div>
              <dt>Ubicación</dt>
              <dd>{event.location}</dd>
            </div>
          )}
          {showRequesterInfo && (
            <>
              {event.requesterName && (
                <div>
                  <dt>Nombre</dt>
                  <dd>{event.requesterName}</dd>
                </div>
              )}
              {event.requesterEmail && (
                <div>
                  <dt>Email</dt>
                  <dd>{event.requesterEmail}</dd>
                </div>
              )}
              {event.requesterPhone && (
                <div>
                  <dt>Teléfono</dt>
                  <dd>{event.requesterPhone}</dd>
                </div>
              )}
              {event.notes && (
                <div>
                  <dt>Notas</dt>
                  <dd>{event.notes}</dd>
                </div>
              )}
            </>
          )}
        </dl>
        <div className="modal-errors" role="alert">
          {errorMessage && <span>{errorMessage}</span>}
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={isProcessing}>
            Cerrar
          </button>
          {onDecline && (
            <button type="button" className="secondary" onClick={onDecline} disabled={isProcessing}>
              Declinar
            </button>
          )}
          {onConfirm && (
            <button type="button" className="primary" onClick={onConfirm} disabled={isProcessing}>
              Aceptar solicitud
            </button>
          )}
          {onDelete && (
            <button type="button" className="danger" onClick={onDelete} disabled={isProcessing}>
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
