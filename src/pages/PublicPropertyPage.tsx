import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SlotInfo } from 'react-big-calendar'
import { useParams } from 'react-router-dom'
import { MultiMonthCalendar, type CalendarEventPropGetter, type MonthEventComponentProps } from '../components/MultiMonthCalendar'
import { RequestFormModal } from '../components/RequestFormModal'
import { fetchPublicAvailability, submitPublicRequest } from '../api/public'
import { AboutAppModal } from '../components/AboutAppModal'
import type { CalendarEvent, PublicAvailabilityDTO } from '../types'

const calendarMessages = {
  date: 'Fecha',
  time: 'Hora',
  event: 'Evento',
  allDay: 'Todo el día',
  week: 'Semana',
  work_week: 'Semana laboral',
  day: 'Día',
  month: 'Mes',
  previous: 'Anterior',
  next: 'Siguiente',
  yesterday: 'Ayer',
  tomorrow: 'Mañana',
  today: 'Hoy',
  agenda: 'Agenda',
  showMore: (total: number) => `+${total} más`,
  noEventsInRange: 'No hay eventos en este rango.',
}

const MS_IN_DAY = 24 * 60 * 60 * 1000

const toUtcDateKey = (date: Date) => date.toISOString().slice(0, 10)

const toLocalMidnight = (date: Date) => new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())

const ensureEndAfterStart = (start: Date, end: Date) => {
  if (end <= start) {
    return new Date(start.getTime() + MS_IN_DAY)
  }
  return end
}

const toCalendarEvents = (data: PublicAvailabilityDTO): CalendarEvent[] =>
  data.events.map((item, index) => {
    const rawStart = new Date(item.start)
    const rawEnd = new Date(item.end)
    const start = toLocalMidnight(rawStart)
    const end = ensureEndAfterStart(start, toLocalMidnight(rawEnd))

    return {
      id: `${data.propertyId}-${index}`,
      title: '',
      start,
      end,
      source: 'public',
      status: item.status === 'pending' ? 'pending' : 'confirmed',
    }
  })

const InstagramIcon = () => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className="social-icon social-icon--instagram"
  >
    <defs>
      <linearGradient id="igrad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#f58529" />
        <stop offset="50%" stopColor="#dd2a7b" />
        <stop offset="100%" stopColor="#515bd4" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#igrad)" />
    <path
      d="M12 9.3A2.7 2.7 0 1 0 14.7 12 2.7 2.7 0 0 0 12 9.3Zm0 4.5A1.8 1.8 0 1 1 13.8 12 1.8 1.8 0 0 1 12 13.8Zm3.48-4.86a.63.63 0 1 0-.63-.63.63.63 0 0 0 .63.63ZM16.8 8a3 3 0 0 0-3-3h-3.6a3 3 0 0 0-3 3v3.6a3 3 0 0 0 3 3h3.6a3 3 0 0 0 3-3Zm-1 3.6a2 2 0 0 1-2 2h-3.6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.6a2 2 0 0 1 2 2Z"
      fill="#fff"
    />
  </svg>
)

const GooglePhotosIcon = () => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className="social-icon social-icon--google"
  >
    <path d="M12 2a5 5 0 0 1 5 5h-5Z" fill="#ea4335" />
    <path d="M12 2a5 5 0 0 0-5 5h5Z" fill="#fbbc05" />
    <path d="M7 7a5 5 0 0 0 5 5V7Z" fill="#34a853" />
    <path d="M12 12a5 5 0 0 0-5 5h5Z" fill="#4285f4" />
    <path d="M12 12a5 5 0 0 1 5-5v5Z" fill="#c5221f" />
    <path d="M12 12a5 5 0 0 1 5 5h-5Z" fill="#0f9d58" />
    <circle cx="12" cy="12" r="2.2" fill="#fff" />
  </svg>
)

const rangesOverlap = (a: CalendarEvent, start: Date, end: Date) => {
  const aStart = a.start
  const aEnd = a.end
  return aStart < end && aEnd > start
}

const eventPropGetter: CalendarEventPropGetter = () => {
  return {
    style: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      color: 'transparent',
      pointerEvents: 'none',
    },
  }
}

export const PublicPropertyPage = () => {
  const { publicSlug = '' } = useParams()
  const [data, setData] = useState<PublicAvailabilityDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingRange, setPendingRange] = useState<{ start: Date; end: Date; displayEnd: Date } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isAboutOpen, setIsAboutOpen] = useState(false)

  const loadAvailability = useCallback(async () => {
    if (!publicSlug) return
    setIsLoading(true)
    setError(null)
    try {
      const payload = await fetchPublicAvailability(publicSlug)
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la disponibilidad.')
    } finally {
      setIsLoading(false)
    }
  }, [publicSlug])

  useEffect(() => {
    void loadAvailability()
  }, [loadAvailability])

  const events = useMemo(() => (data ? toCalendarEvents(data) : []), [data])

  const dayStatuses = useMemo(() => {
    const days = new Map<string, 'pending' | 'blocked'>()

    events.forEach((event) => {
      const start = toLocalMidnight(event.start)
      const endExclusive = ensureEndAfterStart(start, toLocalMidnight(event.end))
      const status = event.status === 'pending' ? 'pending' : 'blocked'

      for (let cursor = start; cursor < endExclusive; cursor = new Date(cursor.getTime() + MS_IN_DAY)) {
        const key = toUtcDateKey(cursor)
        if (status === 'blocked') {
          days.set(key, 'blocked')
        } else if (!days.has(key)) {
          days.set(key, 'pending')
        }
      }
    })

    return days
  }, [events])

  const dayPropGetter = useCallback(
    (date: Date) => {
      const key = toUtcDateKey(date)
      const status = dayStatuses.get(key)
      if (status === 'pending') {
        return { className: 'calendar-day--pending' }
      }
      if (status === 'blocked') {
        return { className: 'calendar-day--blocked' }
      }
      return {}
    },
    [dayStatuses],
  )

  const renderPublicMonthEvent = useCallback(({ monthDate, slotStart }: MonthEventComponentProps) => {
    if (!slotStart || slotStart.getMonth() !== monthDate.getMonth()) {
      return <span aria-hidden="true" />
    }
    return <span aria-hidden="true" />
  }, [])

  const handleSelectSlot = useCallback(
    (slot: SlotInfo) => {
      if (!data) return
      const slots = Array.isArray(slot.slots) ? slot.slots : []
      const displayEndRaw = slots.length > 0 ? slots[slots.length - 1] : slot.end

      const start = slot.start
      const end = slot.end

      const overlapsBlocked = events.some((event) => rangesOverlap(event, start, end) && event.status !== 'declined')
      if (overlapsBlocked) {
        setFeedback('Las fechas seleccionadas ya no están disponibles.')
        return
      }

      setFeedback(null)
      setPendingRange({ start, end, displayEnd: new Date(displayEndRaw) })
      setModalError(null)
      setIsModalOpen(true)
    },
    [data, events],
  )

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setPendingRange(null)
    setModalError(null)
  }

  const handleSubmitRequest = async (payload: { name: string; email?: string; phone?: string; notes?: string }) => {
    if (!pendingRange || !data) return
    setIsSubmitting(true)
    setModalError(null)
    try {
      const response = await submitPublicRequest(data.publicSlug, {
        start: pendingRange.start.toISOString(),
        end: pendingRange.end.toISOString(),
        requesterName: payload.name,
        requesterEmail: payload.email,
        requesterPhone: payload.phone,
        notes: payload.notes,
      })
      const notificationSent = response.notificationSent
      setFeedback(
        notificationSent
          ? 'Tu solicitud quedó pendiente y avisamos al anfitrión por correo. Te contactarán a la brevedad.'
          : 'Tu solicitud quedó pendiente. Comunícate con el anfitrión para que sepa que enviaste la reserva.',
      )
      handleCloseModal()
      await loadAvailability()
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="public-layout">
      {isLoading ? (
        <div className="loading">Cargando disponibilidad...</div>
      ) : error ? (
        <div className="alert" role="alert">
          <span>{error}</span>
        </div>
      ) : data ? (
        <>
          <header className="public-header">
            <h1>{data.propertyName}</h1>
            <p>Selecciona fechas disponibles para enviar una solicitud de reserva.</p>
            {(data.instagramUrl || data.googlePhotosUrl) && (
              <div className="public-social-logos" aria-label="Redes sociales">
                {data.instagramUrl && (
                  <a href={data.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                    <InstagramIcon />
                  </a>
                )}
                {data.googlePhotosUrl && (
                  <a href={data.googlePhotosUrl} target="_blank" rel="noopener noreferrer" aria-label="Google Fotos">
                    <GooglePhotosIcon />
                  </a>
                )}
              </div>
            )}
            {feedback && (
              <div className="alert alert--inline" role="status">
                <span>{feedback}</span>
              </div>
            )}
          </header>
          <section className="calendar-card">
            <MultiMonthCalendar
              events={events}
              messages={calendarMessages}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={() => undefined}
              eventPropGetter={eventPropGetter}
              renderMonthEvent={renderPublicMonthEvent}
              dayPropGetter={dayPropGetter}
            />
          </section>
          <div className="public-footer">
            <button type="button" className="link-button" onClick={() => setIsAboutOpen(true)}>
              Gestiona tus alquileres con SimpleAlquiler.net
            </button>
          </div>
        </>
      ) : null}

      <RequestFormModal
        isOpen={isModalOpen && Boolean(pendingRange)}
        range={pendingRange}
        onSubmit={handleSubmitRequest}
        onCancel={handleCloseModal}
        isSubmitting={isSubmitting}
        errorMessage={modalError}
      />

      <AboutAppModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  )
}
