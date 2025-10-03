import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SlotInfo } from 'react-big-calendar'

import { createEvent, deleteEvent, fetchEvents } from './api/events'
import { EventFormModal } from './components/EventFormModal'
import { MultiMonthCalendar, type CalendarEventPropGetter } from './components/MultiMonthCalendar'
import type { CalendarEvent, CalendarEventDTO } from './types'

import './App.css'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const toCalendarEvent = (event: CalendarEventDTO): CalendarEvent => ({
  id: event.id,
  title: event.title,
  start: new Date(event.start),
  end: new Date(event.end),
  source: event.source ?? 'manual',
  status: event.status ?? 'confirmed',
})

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

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [pendingRange, setPendingRange] = useState<{
    start: Date
    end: Date
    displayEnd: Date
  } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const propertyId = useMemo(() => (import.meta.env.VITE_PROPERTY_ID as string | undefined) ?? 'default-property', [])

  const loadEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchEvents(propertyId)
      setEvents(data.map(toCalendarEvent))
      setGlobalError(null)
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'No se pudieron cargar los eventos.')
    } finally {
      setIsLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const handleSelectSlot = useCallback((slot: SlotInfo) => {
    const slots = Array.isArray(slot.slots) ? slot.slots : []
    const rawDisplayEnd = slots.length > 0 ? slots[slots.length - 1] : slot.end

    setPendingRange({
      start: slot.start,
      end: slot.end,
      displayEnd: new Date(rawDisplayEnd),
    })
    setModalError(null)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setPendingRange(null)
    setModalError(null)
  }, [])

  const handleCreateEvent = useCallback(
    async (title: string) => {
      if (!pendingRange) return

      setIsSubmitting(true)
      setModalError(null)

      try {
        const payload = await createEvent({
          title,
          start: pendingRange.start.toISOString(),
          end: pendingRange.end.toISOString(),
        }, propertyId)

        setEvents((prev) => {
          const next = [...prev, toCalendarEvent(payload)]
          return next.sort((a, b) => a.start.getTime() - b.start.getTime())
        })
        handleCloseModal()
      } catch (error) {
        setModalError(error instanceof Error ? error.message : 'No se pudo crear el evento.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [handleCloseModal, pendingRange, propertyId],
  )

  const handleRemoveEvent = useCallback(async (event: CalendarEvent) => {
    const shouldDelete = window.confirm(`¿Eliminar el evento "${event.title}"?`)
    if (!shouldDelete) return

    try {
      await deleteEvent(event.id, propertyId)
      setEvents((prev) => prev.filter((item) => item.id !== event.id))
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'No se pudo eliminar el evento.')
    }
  }, [propertyId])

  const eventColors = useMemo(() => {
    const palette = ['#2563eb', '#0ea5e9', '#14b8a6', '#f97316', '#a855f7']
    const sortedEvents = [...events].sort((a, b) => a.start.getTime() - b.start.getTime())
    const colorMap = new Map<string, string>()

    let lastColorIndex = -1

    sortedEvents.forEach((event) => {
      const baseIndex =
        event.id
          .split('')
          .reduce((acc, char) => acc + char.charCodeAt(0), 0) % palette.length
      let colorIndex = baseIndex

      if (palette.length > 1 && colorIndex === lastColorIndex) {
        colorIndex = (colorIndex + 1) % palette.length
      }

      lastColorIndex = colorIndex
      colorMap.set(event.id, palette[colorIndex])
    })

    return { palette, colorMap }
  }, [events])

  const eventPropGetter = useCallback<CalendarEventPropGetter>(
    (event) => {
      const color = eventColors.colorMap.get(event.id) ?? eventColors.palette[0]

      return {
        style: {
          backgroundColor: color,
          borderColor: color,
          color: '#ffffff',
        },
      }
    },
    [eventColors],
  )

  return (
    <div className="app-layout">
      <header className="app-header">
        <div>
          <h1>Calendario de Alquileres</h1>
          <p className="subtitle">Selecciona un rango de fechas en el calendario para crear un evento.</p>
        </div>
        <button type="button" className="secondary" onClick={loadEvents} disabled={isLoading}>
          Recargar eventos
        </button>
      </header>

      {globalError && (
        <div className="alert" role="alert">
          <span>{globalError}</span>
          <button type="button" onClick={() => setGlobalError(null)}>
            Cerrar
          </button>
        </div>
      )}

      <main className="main-content">
        <section className="calendar-card">
          {isLoading ? (
            <div className="loading">Cargando eventos...</div>
          ) : (
            <MultiMonthCalendar
              events={events}
              messages={calendarMessages}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleRemoveEvent}
              eventPropGetter={eventPropGetter}
            />
          )}
        </section>
      </main>

      <EventFormModal
        isOpen={isModalOpen && Boolean(pendingRange)}
        range={pendingRange}
        onSubmit={handleCreateEvent}
        onCancel={handleCloseModal}
        isSubmitting={isSubmitting}
        errorMessage={modalError}
      />
    </div>
  )
}

export default App
