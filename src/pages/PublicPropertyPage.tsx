import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SlotInfo } from 'react-big-calendar'
import { Link, useParams } from 'react-router-dom'
import { MultiMonthCalendar, type CalendarEventPropGetter, type MonthEventComponentProps } from '../components/MultiMonthCalendar'
import { RequestFormModal } from '../components/RequestFormModal'
import { fetchPublicAvailability, submitPublicRequest } from '../api/public'
import type { CalendarEvent, PublicAvailabilityDTO } from '../types'

const calendarMessages = {
  date: 'Fecha',
  time: 'Hora',
  event: 'Evento',
  allDay: 'Todo el dia',
  week: 'Semana',
  work_week: 'Semana laboral',
  day: 'Dia',
  month: 'Mes',
  previous: 'Anterior',
  next: 'Siguiente',
  yesterday: 'Ayer',
  tomorrow: 'Manana',
  today: 'Hoy',
  agenda: 'Agenda',
  showMore: (total: number) => `+${total} mas`,
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

const eventPropGetter: CalendarEventPropGetter = () => ({
  style: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    color: 'transparent',
    pointerEvents: 'none',
  },
})

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
  const [calendarHint, setCalendarHint] = useState<string | null>(null)

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
        setFeedback(null)
        setCalendarHint('Las fechas seleccionadas ya estan ocupadas o pendientes de confirmacion.')
        return
      }

      setCalendarHint(null)
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
      setFeedback(
        response.notificationSent
          ? 'Tu solicitud quedo pendiente y avisamos al anfitrion por correo.'
          : 'Tu solicitud quedo pendiente. El anfitrion la revisara pronto.',
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
    <div className="public-calendar-layout">
      {isLoading ? (
        <div className="loading">Cargando disponibilidad...</div>
      ) : error ? (
        <div className="alert" role="alert">
          <span>{error}</span>
        </div>
      ) : data ? (
        <>
          <header className="public-calendar-header">
            <div>
              <p className="promo-label">Calendario de reservas</p>
              <h1>{data.propertyName}</h1>
              <p>Selecciona fechas disponibles para solicitar tu reserva.</p>
            </div>
            <div className="public-calendar-header__actions">
              <Link className="secondary" to={`/public/${data.publicSlug}`}>
                Volver a la pagina
              </Link>
            </div>
          </header>

          {calendarHint && (
            <div className="alert alert--inline" role="status">
              <span>{calendarHint}</span>
            </div>
          )}
          {feedback && (
            <div className="alert alert--inline" role="status">
              <span>{feedback}</span>
            </div>
          )}

          <section className="calendar-card">
            <MultiMonthCalendar
              events={events}
              messages={calendarMessages}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={() => undefined}
              eventPropGetter={eventPropGetter}
              renderMonthEvent={renderPublicMonthEvent}
              dayPropGetter={dayPropGetter}
              monthsToShow={1}
              showNavigator
            />
          </section>
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
    </div>
  )
}
