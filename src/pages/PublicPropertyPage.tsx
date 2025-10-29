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

const toUtcMidnight = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())

const toCalendarEvents = (data: PublicAvailabilityDTO): CalendarEvent[] =>
  data.events.map((item, index) => ({
    id: `${data.propertyId}-${index}`,
    title: '',
    start: new Date(item.start),
    end: new Date(item.end),
    source: 'public',
    status: item.status === 'pending' ? 'pending' : 'confirmed',
  }))

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
      // Work in UTC to avoid local timezone offsets shifting blocked days earlier.
      const startUtc = toUtcMidnight(event.start)
      let end = event.end <= event.start ? event.start : event.end

      const endIsUtcMidnight =
        end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0 && end.getUTCMilliseconds() === 0

      if (endIsUtcMidnight && end > event.start) {
        end = new Date(end.getTime() - 1)
      }

      const endUtc = toUtcMidnight(end)

      if (endUtc < startUtc) {
        const key = toUtcDateKey(event.start)
        const status = event.status === 'pending' ? 'pending' : 'blocked'
        if (status === 'blocked' || !days.has(key)) {
          days.set(key, status)
        }
        return
      }

      const status = event.status === 'pending' ? 'pending' : 'blocked'

      for (let cursor = startUtc; cursor <= endUtc; cursor += MS_IN_DAY) {
        const key = toUtcDateKey(new Date(cursor))
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

  const renderPublicMonthEvent = useCallback(
    ({ continuesPrior, monthDate, slotStart }: MonthEventComponentProps) => {
      if (continuesPrior && slotStart.getMonth() !== monthDate.getMonth()) {
        return <span aria-hidden="true" />
      }
      return <span aria-hidden="true" />
    },
    [],
  )

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
