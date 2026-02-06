import { useCallback, useEffect, useMemo, useState, type FC } from 'react'
import type { EventProps, SlotInfo } from 'react-big-calendar'
import { addMonths, format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { EventFormModal } from './EventFormModal'
import { EventDetailsModal } from './EventDetailsModal'
import { MultiMonthCalendar, type CalendarEventPropGetter, type MonthEventComponentProps } from './MultiMonthCalendar'
import type { CalendarEvent, CalendarEventDTO, PropertyDTO } from '../types'
import { createEvent, deleteEvent, fetchEvents, syncAirbnb, updateEventStatus } from '../api/events'

const startOfDayLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const isUtcMidnight = (d: Date) =>
  d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
const toUtcDateKey = (date: Date) => date.toISOString().slice(0, 10)
const toLocalMidnightFromKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const toLocalMidnight = (date: Date) => new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
const normalizeSelectionRange = (start: Date, end: Date) => {
  const normalizedStart = startOfDayLocal(start)
  const normalizedEnd = startOfDayLocal(end)
  const endExclusive = normalizedEnd <= normalizedStart ? addDays(normalizedStart, 1) : normalizedEnd
  return {
    start: normalizedStart,
    end: endExclusive,
    displayEnd: addDays(endExclusive, -1),
  }
}

const getMonthLabel = (date: Date) => format(date, 'MMMM yyyy', { locale: es })

const eventStatusLabel = (event: CalendarEvent) => {
  if (event.status === 'confirmed') return 'Confirmado'
  if (event.status === 'pending') return 'Pendiente'
  if (event.status === 'tentative') return 'Tentativo'
  return 'Declinado'
}

const eventSourceLabel = (event: CalendarEvent) => {
  if (event.source === 'airbnb') return 'Airbnb'
  if (event.source === 'public') return 'Solicitud web'
  return 'Manual'
}

const getEventListRangeLabel = (event: CalendarEvent) => {
  const { s, e } = normRange(event)
  const displayEnd = addDays(e, -1)
  return `${format(s, 'd MMM', { locale: es })} - ${format(displayEnd, 'd MMM', { locale: es })}`
}

const normRange = (ev: CalendarEvent) => {
  const s = startOfDayLocal(ev.start)
  const e0 = startOfDayLocal(ev.end)
  const e = e0 <= s ? addDays(s, 1) : e0
  return { s, e }
}
const rangesOverlap = (a: CalendarEvent, b: CalendarEvent) => {
  const A = normRange(a)
  const B = normRange(b)
  return A.s < B.e && A.e > B.s
}

const isAirbnb = (e: CalendarEvent) => e.source === 'airbnb'
const behavesAsManual = (e: CalendarEvent) => e.source === 'manual' || (e.source === 'public' && e.status === 'confirmed')
const isAirbnbReserved = (e: CalendarEvent) => isAirbnb(e) && e.status === 'confirmed'

type ViewEvent = CalendarEvent & { duplicateWithAirbnb?: boolean }

const computeVisibleEvents = (all: CalendarEvent[]): ViewEvent[] => {
  const viewEvents = all.map((event) => ({ ...event, duplicateWithAirbnb: false }))
  const manualLike = viewEvents.filter((event) => event.status !== 'declined' && behavesAsManual(event))
  const airbnbs = viewEvents.filter(isAirbnb)

  manualLike.forEach((manual) => {
    const overlapsAirbnb = airbnbs.some((airbnb) => isAirbnbReserved(airbnb) && rangesOverlap(manual, airbnb))
    if (overlapsAirbnb) {
      manual.duplicateWithAirbnb = true
    }
  })

  return viewEvents
}

const normalizeEventDates = (
  source: CalendarEvent['source'],
  start: Date,
  end: Date,
): { start: Date; end: Date } => {
  const adjustedStart =
    source === 'airbnb' && isUtcMidnight(start) ? toLocalMidnightFromKey(toUtcDateKey(start)) : toLocalMidnight(start)
  let adjustedEnd =
    source === 'airbnb' && isUtcMidnight(end) ? toLocalMidnightFromKey(toUtcDateKey(end)) : toLocalMidnight(end)

  if (adjustedEnd <= adjustedStart) {
    adjustedEnd = addDays(adjustedStart, 1)
  }

  return { start: adjustedStart, end: adjustedEnd }
}

const toCalendarEvent = (dto: CalendarEventDTO): CalendarEvent => {
  const source = dto.source ?? 'manual'
  const start = new Date(dto.start)
  const end = new Date(dto.end)
  const normalized = normalizeEventDates(source, start, end)

  return {
    id: dto.id,
    title: dto.title,
    start: normalized.start,
    end: normalized.end,
    source,
    status: dto.status ?? 'confirmed',
    description: dto.description,
    location: dto.location,
    requesterName: dto.requesterName,
    requesterEmail: dto.requesterEmail,
    requesterPhone: dto.requesterPhone,
    notes: dto.notes,
  }
}

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

type MonthEventProps = MonthEventComponentProps & EventProps<ViewEvent>

const MonthEventRenderer: FC<MonthEventProps> = ({ event, title, continuesPrior, monthDate, slotStart }) => {
  if (!slotStart || slotStart.getMonth() !== monthDate.getMonth()) {
    return <span />
  }

  const baseClassName = continuesPrior ? 'month-event-line month-event-line--continued' : 'month-event-line'
  const eventStartsToday =
    event.start.getFullYear() === slotStart.getFullYear() &&
    event.start.getMonth() === slotStart.getMonth() &&
    event.start.getDate() === slotStart.getDate()
  const shouldShowContent = !continuesPrior || eventStartsToday

  if (!shouldShowContent) {
    return <span aria-hidden="true" />
  }

  if (event.source === 'airbnb') {
    const label = event.status === 'tentative' ? 'Tentativo en Airbnb' : 'Reservado en Airbnb'
    return <div className={baseClassName}>{label}</div>
  }

  if (event.source === 'public' && !behavesAsManual(event)) {
    if (event.status === 'pending') {
      return (
        <div className={baseClassName}>
          <strong>Solicitud pendiente</strong>
        </div>
      )
    }
    if (event.status === 'declined') {
      return <div className={`${baseClassName} declined`}>Solicitud declinada</div>
    }
  }

  const badge = event.duplicateWithAirbnb ? (
    <span className="status-badge">Airbnb OK</span>
  ) : (
    <span className="status-badge status--warning">Sin Airbnb</span>
  )

  return (
    <div className={baseClassName}>
      <strong>{title}</strong> — {badge}
    </div>
  )
}

const getEventStyle = (event: ViewEvent) => {
  if (event.source === 'airbnb') {
    const color = event.status === 'tentative' ? '#facc15' : '#f97316'
    return {
      backgroundColor: color,
      borderColor: color,
      color: '#ffffff',
    }
  }

  if (event.source === 'public' && !behavesAsManual(event)) {
    if (event.status === 'pending') {
      const color = '#22c55e'
      return { backgroundColor: color, borderColor: color, color: '#ffffff' }
    }
    if (event.status === 'declined') {
      const color = '#94a3b8'
      return { backgroundColor: color, borderColor: color, color: '#f3f4f6' }
    }
  }

  const color = '#0ea5e9'
  const style: Record<string, string> = {
    backgroundColor: color,
    borderColor: color,
    color: '#ffffff',
  }

  if (event.duplicateWithAirbnb) {
    style.boxShadow = 'inset 0 0 0 2px rgba(255,255,255,0.65)'
    style.outline = '2px dashed rgba(14,165,233,0.45)'
  }

  return style
}

interface PropertyWorkspaceProps {
  property: PropertyDTO
}

export const PropertyWorkspace = ({ property }: PropertyWorkspaceProps) => {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pendingRange, setPendingRange] = useState<{ start: Date; end: Date; displayEnd: Date } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isProcessingEvent, setIsProcessingEvent] = useState(false)
  const [eventError, setEventError] = useState<string | null>(null)
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(new Date()))

  const visibleEvents = useMemo(() => computeVisibleEvents(events), [events])
  const monthEvents = useMemo(() => {
    const monthStart = startOfMonth(activeMonth)
    const monthEnd = addMonths(monthStart, 1)
    return visibleEvents
      .filter((event) => {
        const range = normRange(event)
        return range.s < monthEnd && range.e > monthStart
      })
      .sort((left, right) => left.start.getTime() - right.start.getTime())
  }, [activeMonth, visibleEvents])

  const loadEvents = useCallback(
    async (options?: { skipClearError?: boolean }) => {
      setIsLoading(true)
      if (!options?.skipClearError) {
        setGlobalError(null)
      }
      try {
        const payload = await fetchEvents(property.id)
        const mapped = payload.map(toCalendarEvent).sort((a, b) => a.start.getTime() - b.start.getTime())
        setEvents(mapped)
      } catch (error) {
        setGlobalError(error instanceof Error ? error.message : 'No se pudieron cargar los eventos.')
      } finally {
        setIsLoading(false)
      }
    },
    [property.id],
  )

  useEffect(() => {
    let active = true
    const bootstrap = async () => {
      if (active) setIsSyncing(true)
      let syncFailed = false
      try {
        await syncAirbnb(property.id, {})
      } catch (error) {
        syncFailed = true
        if (active) {
          setGlobalError(error instanceof Error ? error.message : 'No se pudo sincronizar con Airbnb.')
        }
      }
      await loadEvents(syncFailed ? { skipClearError: true } : undefined)
      if (active) setIsSyncing(false)
    }
    bootstrap()
    return () => {
      active = false
    }
  }, [loadEvents, property.id])

  const handleSelectSlot = useCallback((slot: SlotInfo) => {
    setPendingRange(normalizeSelectionRange(slot.start, slot.end))
    setModalError(null)
    setIsModalOpen(true)
  }, [])

  const handleOpenNewEventModal = useCallback(() => {
    const today = startOfDayLocal(new Date())
    setPendingRange(normalizeSelectionRange(today, addDays(today, 1)))
    setModalError(null)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setPendingRange(null)
    setModalError(null)
  }, [])

  const handleCreateEvent = useCallback(
    async (payload: { title: string; description?: string; location?: string; start: Date; end: Date }) => {
      setIsSubmitting(true)
      setModalError(null)
      try {
        const createdEvent = await createEvent(property.id, {
          title: payload.title,
          start: payload.start.toISOString(),
          end: payload.end.toISOString(),
          description: payload.description,
          location: payload.location,
        })
        setEvents((prev) => {
          const next = [...prev, toCalendarEvent(createdEvent)]
          return next.sort((a, b) => a.start.getTime() - b.start.getTime())
        })
        handleCloseModal()
      } catch (error) {
        setModalError(error instanceof Error ? error.message : 'No se pudo crear el evento.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [handleCloseModal, property.id],
  )

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event)
    setEventError(null)
  }, [])

  const closeDetails = useCallback(() => {
    setSelectedEvent(null)
    setEventError(null)
  }, [])

  const updateEventInState = useCallback((updated: CalendarEvent) => {
    setEvents((prev) => prev.map((event) => (event.id === updated.id ? updated : event)))
  }, [])

  const removeEventFromState = useCallback((eventId: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== eventId))
  }, [])

  const handleConfirmRequest = useCallback(async () => {
    if (!selectedEvent) return
    setIsProcessingEvent(true)
    setEventError(null)
    try {
      const updated = await updateEventStatus(property.id, selectedEvent.id, { status: 'confirmed' })
      const mapped = toCalendarEvent(updated)
      updateEventInState(mapped)
      setSelectedEvent(mapped)
    } catch (error) {
      setEventError(error instanceof Error ? error.message : 'No se pudo actualizar el evento.')
    } finally {
      setIsProcessingEvent(false)
    }
  }, [property.id, selectedEvent, updateEventInState])

  const handleDeclineRequest = useCallback(async () => {
    if (!selectedEvent) return
    setIsProcessingEvent(true)
    setEventError(null)
    try {
      const updated = await updateEventStatus(property.id, selectedEvent.id, { status: 'declined' })
      const mapped = toCalendarEvent(updated)
      updateEventInState(mapped)
      setSelectedEvent(mapped)
    } catch (error) {
      setEventError(error instanceof Error ? error.message : 'No se pudo actualizar el evento.')
    } finally {
      setIsProcessingEvent(false)
    }
  }, [property.id, selectedEvent, updateEventInState])

  const handleDeleteEvent = useCallback(async () => {
    if (!selectedEvent) return
    const shouldDelete = window.confirm(`¿Eliminar el evento "${selectedEvent.title}"?`)
    if (!shouldDelete) return
    setIsProcessingEvent(true)
    setEventError(null)
    try {
      await deleteEvent(property.id, selectedEvent.id)
      removeEventFromState(selectedEvent.id)
      setSelectedEvent(null)
    } catch (error) {
      setEventError(error instanceof Error ? error.message : 'No se pudo eliminar el evento.')
    } finally {
      setIsProcessingEvent(false)
    }
  }, [property.id, removeEventFromState, selectedEvent])

  const eventPropGetter = useCallback<CalendarEventPropGetter>(
    (event) => ({
      style: getEventStyle(event as ViewEvent),
    }),
    [],
  )

  const canDelete = selectedEvent && selectedEvent.source !== 'airbnb'
  const canManageRequest = selectedEvent && selectedEvent.source === 'public' && selectedEvent.status === 'pending'

  return (
    <section className="property-workspace">
      {isSyncing && (
        <div className="info-banner" role="status">
          <span>Sincronizando con Airbnb…</span>
        </div>
      )}

      {globalError && (
        <div className="alert" role="alert">
          <span>{globalError}</span>
          <button type="button" onClick={() => setGlobalError(null)}>
            Cerrar
          </button>
        </div>
      )}

      <div className="calendar-card">
        <div className="calendar-card__toolbar">
          <button type="button" className="primary" onClick={handleOpenNewEventModal}>
            Nuevo evento
          </button>
          <p>Selecciona días o ajusta inicio/fin manualmente para crear eventos entre distintos meses.</p>
        </div>
        {isLoading ? (
          <div className="loading">Cargando eventos...</div>
        ) : (
          <MultiMonthCalendar
            events={visibleEvents}
            messages={calendarMessages}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventPropGetter}
            renderMonthEvent={MonthEventRenderer}
            monthsToShow={1}
            showNavigator
            anchorMonth={activeMonth}
            onAnchorMonthChange={setActiveMonth}
          />
        )}
      </div>

      <section className="card month-events-card">
        <div className="month-events-card__header">
          <h3>Eventos de {getMonthLabel(activeMonth)}</h3>
          <span>{monthEvents.length}</span>
        </div>
        {monthEvents.length === 0 ? (
          <p className="subtitle">No hay eventos para este mes.</p>
        ) : (
          <ul className="month-events-list">
            {monthEvents.map((event) => (
              <li key={event.id}>
                <button type="button" onClick={() => handleSelectEvent(event)} className="month-events-list__item">
                  <span className="month-events-list__range">{getEventListRangeLabel(event)}</span>
                  <strong className="month-events-list__title">{event.title || 'Reserva'}</strong>
                  <span className="month-events-list__meta">
                    {eventSourceLabel(event)} · {eventStatusLabel(event)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EventFormModal
        isOpen={isModalOpen && Boolean(pendingRange)}
        range={pendingRange}
        onSubmit={handleCreateEvent}
        onCancel={handleCloseModal}
        isSubmitting={isSubmitting}
        errorMessage={modalError}
      />

      <EventDetailsModal
        isOpen={Boolean(selectedEvent)}
        event={selectedEvent}
        onClose={closeDetails}
        onDelete={canDelete ? handleDeleteEvent : undefined}
        onConfirm={canManageRequest ? handleConfirmRequest : undefined}
        onDecline={canManageRequest ? handleDeclineRequest : undefined}
        isProcessing={isProcessingEvent}
        errorMessage={eventError}
      />
    </section>
  )
}
