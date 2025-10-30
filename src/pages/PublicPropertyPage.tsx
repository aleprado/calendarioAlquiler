import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { SlotInfo } from 'react-big-calendar'
import { useParams } from 'react-router-dom'
import { MultiMonthCalendar, type CalendarEventPropGetter, type MonthEventComponentProps } from '../components/MultiMonthCalendar'
import { RequestFormModal } from '../components/RequestFormModal'
import { fetchPublicAvailability, submitPublicRequest } from '../api/public'
import { AboutAppModal } from '../components/AboutAppModal'
import type { CalendarEvent, PublicAvailabilityDTO } from '../types'
import instagramLogo from '../../insta-logo.png'
import googlePhotosLogo from '../../Google-photos-logo.png'

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
  const [infoModalVariant, setInfoModalVariant] = useState<'welcome' | 'unavailable' | 'about' | null>(null)
  const [hasShownWelcome, setHasShownWelcome] = useState(false)

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

  useEffect(() => {
    if (data && !hasShownWelcome) {
      setInfoModalVariant('welcome')
      setHasShownWelcome(true)
    }
  }, [data, hasShownWelcome])

  const events = useMemo(() => (data ? toCalendarEvents(data) : []), [data])

  const socialLinksContent = useMemo(() => {
    if (!data) return null
    const links: ReactNode[] = []
    if (data.instagramUrl) {
      links.push(
        <a key="instagram" href={data.instagramUrl} target="_blank" rel="noopener noreferrer">
          Instagram
        </a>,
      )
    }
    if (data.googlePhotosUrl) {
      links.push(
        <a key="google" href={data.googlePhotosUrl} target="_blank" rel="noopener noreferrer">
          Google Fotos
        </a>,
      )
    }
    if (links.length === 0) return null
    if (links.length === 1) return links[0]
    return (
      <>
        {links[0]} y {links[1]}
      </>
    )
  }, [data])

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
        setFeedback(null)
        setInfoModalVariant('unavailable')
        return
      }

      setInfoModalVariant((current) => (current === 'unavailable' ? null : current))
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
                    <img src={instagramLogo} alt="" className="social-icon social-icon--instagram" />
                  </a>
                )}
                {data.googlePhotosUrl && (
                  <a href={data.googlePhotosUrl} target="_blank" rel="noopener noreferrer" aria-label="Google Fotos">
                    <img src={googlePhotosLogo} alt="" className="social-icon social-icon--google" />
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
            <button type="button" className="link-button" onClick={() => setInfoModalVariant('about')}>
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

      <AboutAppModal
        isOpen={infoModalVariant !== null}
        onClose={() => setInfoModalVariant(null)}
        title={
          infoModalVariant === 'welcome'
            ? 'Cómo usar este calendario'
            : infoModalVariant === 'unavailable'
              ? 'Fechas no disponibles'
              : undefined
        }
        primaryLabel={infoModalVariant && infoModalVariant !== 'about' ? 'Entendido' : undefined}
      >
        {infoModalVariant === 'welcome' ? (
          <>
            <p>
              Aquí puedes revisar la disponibilidad de {data?.propertyName ?? 'esta propiedad'} y enviar una solicitud de reserva
              sin iniciar sesión.
            </p>
            <p>
              Selecciona un rango de fechas disponible y completa el formulario para generar una reserva pendiente de validación. El
              anfitrión revisará la solicitud antes de confirmarla.
            </p>
            {socialLinksContent && <p>Mira más detalles y fotos en {socialLinksContent}.</p>}
          </>
        ) : null}
        {infoModalVariant === 'unavailable' ? (
          <>
            <p>Las fechas seleccionadas están reservadas o pendientes de confirmación.</p>
            <p>Elige otro rango disponible y envía la solicitud para generar una reserva pendiente de validación.</p>
          </>
        ) : null}
      </AboutAppModal>
    </div>
  )
}
