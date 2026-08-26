import { format } from 'date-fns'
import { es, ptBR } from 'date-fns/locale'
import type { CalendarEvent } from '../types'
import { useLocale } from '../i18n/LocaleContext'

interface EventDetailsModalProps {
  isOpen: boolean
  event: CalendarEvent | null
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
  onConfirm?: () => void
  onDecline?: () => void
  onToggleCleaning?: () => void
  isProcessing?: boolean
  errorMessage?: string | null
}

export const EventDetailsModal = ({
  isOpen,
  event,
  onClose,
  onEdit,
  onDelete,
  onConfirm,
  onDecline,
  onToggleCleaning,
  isProcessing = false,
  errorMessage,
}: EventDetailsModalProps) => {
  const { t, locale } = useLocale()
  const dateFnsLocale = locale === 'pt' ? ptBR : es

  const formatDateRange = (start: Date, end: Date) => {
    const startLabel = format(start, "EEEE d 'de' MMMM yyyy", { locale: dateFnsLocale })
    const endLabel = format(end, "EEEE d 'de' MMMM yyyy", { locale: dateFnsLocale })
    return `${startLabel} → ${endLabel}`
  }

  if (!isOpen || !event) return null

  const showRequesterInfo = event.source === 'public'
  const cleaningStatusLabel =
    event.cleaningStatus === 'pending' ? t('eventDetailsCleaningPending') :
    event.cleaningStatus === 'done' ? t('eventDetailsCleaningDone') : t('eventDetailsCleaningNone')

  const originLabel =
    event.source === 'airbnb' ? t('eventDetailsOriginAirbnb') :
    event.source === 'public' ? t('eventDetailsOriginPublic') : t('eventDetailsOriginManual')

  const statusLabel = {
    confirmed: t('eventDetailsStatusConfirmed'),
    tentative: t('eventDetailsTentative'),
    pending: t('eventDetailsPending'),
    declined: t('eventDetailsDeclined'),
  }[event.status]

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="event-details-title">
        <h2 id="event-details-title">{event.title}</h2>
        <p className="modal-range">{formatDateRange(event.start, event.end)}</p>
        <dl className="event-details-list">
          <div>
            <dt>{t('eventDetailsStatus')}</dt>
            <dd>{statusLabel}</dd>
          </div>
          <div>
            <dt>{t('eventDetailsOrigin')}</dt>
            <dd>{originLabel}</dd>
          </div>
          {event.status === 'confirmed' && (
            <div>
              <dt>{t('eventDetailsCleaning')}</dt>
              <dd>{cleaningStatusLabel}</dd>
            </div>
          )}
          {event.description && (
            <div>
              <dt>{t('eventDetailsDescription')}</dt>
              <dd>{event.description}</dd>
            </div>
          )}
          {event.location && (
            <div>
              <dt>{t('eventDetailsLocation')}</dt>
              <dd>{event.location}</dd>
            </div>
          )}
          {showRequesterInfo && (
            <>
              {event.requesterName && (
                <div><dt>{t('eventDetailsName')}</dt><dd>{event.requesterName}</dd></div>
              )}
              {event.requesterEmail && (
                <div><dt>{t('eventDetailsEmail')}</dt><dd>{event.requesterEmail}</dd></div>
              )}
              {event.requesterPhone && (
                <div><dt>{t('eventDetailsPhone')}</dt><dd>{event.requesterPhone}</dd></div>
              )}
              {event.notes && (
                <div><dt>{t('eventDetailsNotes')}</dt><dd>{event.notes}</dd></div>
              )}
            </>
          )}
        </dl>
        <div className="modal-errors" role="alert">
          {errorMessage && <span>{errorMessage}</span>}
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={isProcessing}>
            {t('close')}
          </button>
          {onEdit && (
            <button type="button" className="secondary" onClick={onEdit} disabled={isProcessing}>
              {t('edit')}
            </button>
          )}
          {onDecline && (
            <button type="button" className="secondary" onClick={onDecline} disabled={isProcessing}>
              {t('eventDetailsDecline')}
            </button>
          )}
          {onConfirm && (
            <button type="button" className="primary" onClick={onConfirm} disabled={isProcessing}>
              {t('eventDetailsAccept')}
            </button>
          )}
          {onToggleCleaning && event.status === 'confirmed' && (
            <button type="button" className="secondary" onClick={onToggleCleaning} disabled={isProcessing}>
              {event.cleaningStatus === 'pending' ? t('eventDetailsMarkCleaningDone') : t('eventDetailsMarkCleaningPending')}
            </button>
          )}
          {onDelete && (
            <button type="button" className="danger" onClick={onDelete} disabled={isProcessing}>
              {t('delete')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
