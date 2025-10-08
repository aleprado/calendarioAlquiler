import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SlotInfo } from 'react-big-calendar'

import { createEvent, deleteEvent, fetchEvents } from './api/events'
import { EventFormModal } from './components/EventFormModal'
import { MultiMonthCalendar, type CalendarEventPropGetter } from './components/MultiMonthCalendar'
import type { CalendarEvent, CalendarEventDTO } from './types'

import './App.css'
import 'react-big-calendar/lib/css/react-big-calendar.css'

/* ---------- Helpers de solapamiento (end exclusivo como iCal) ---------- */
const startOfDayLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const normRange = (ev: CalendarEvent) => {
  const s = startOfDayLocal(ev.start)
  const e0 = startOfDayLocal(ev.end)
  const e = e0 <= s ? addDays(s, 1) : e0 // garantizamos al menos 1 día exclusivo
  return { s, e }
}
const rangesOverlap = (a: CalendarEvent, b: CalendarEvent) => {
  const A = normRange(a)
  const B = normRange(b)
  return A.s < B.e && A.e > B.s
}

const isAirbnb = (e: CalendarEvent) => e.source === 'airbnb'
const isManual = (e: CalendarEvent) => e.source === 'manual'
const isAirbnbReserved = (e: CalendarEvent) => isAirbnb(e) && /reserved/i.test(e.title)
const isAirbnbBlocked = (e: CalendarEvent) => isAirbnb(e) && /not\s*available/i.test(e.title)

type ViewEvent = CalendarEvent & { duplicateWithAirbnb?: boolean }

function computeVisibleEvents(all: CalendarEvent[]): ViewEvent[] {
  const manuals = all.filter(isManual)
  const airbnbs = all.filter(isAirbnb)

  // marca manuales que se solapan con cualquier bloqueo/airbnb (no reserved)
  for (const m of manuals) {
    const linked = airbnbs.some((a) => (isAirbnbBlocked(a) || !isAirbnbReserved(a)) && rangesOverlap(m, a))
    if (linked) (m as ViewEvent).duplicateWithAirbnb = true
  }

  // por ahora mostramos ambos (manual + airbnb). Si querés ocultar airbnb duplicados, se puede filtrar aquí.
  return all as ViewEvent[]
}

/* ---------- Mapeo desde DTO ---------- */
const toCalendarEvent = (event: CalendarEventDTO): CalendarEvent => ({
  id: event.id,
  title: event.title,
  start: new Date(event.start),
  end: new Date(event.end),
  source: event.source ?? 'manual',
  status: event.status ?? 'confirmed',
})

/* ---------- i18n calendario ---------- */
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

/* ---------- Renderer para Month: texto solo en el primer segmento ---------- */
type RBCMonthEventProps<T> = { event: T; title: string; continuesPrior?: boolean; continuesAfter?: boolean }

const MonthEventRenderer: React.FC<RBCMonthEventProps<ViewEvent>> = ({ event, title, continuesPrior }) => {
  if (continuesPrior) return <span />

  const isAirbnbSrc = event.source === 'airbnb'
  const isManualSrc = event.source === 'manual'
  const isReserved = isAirbnbSrc && /reserved/i.test(title)
  const isLinked = !!event.duplicateWithAirbnb

  let label: React.ReactNode
  if (isAirbnbSrc && isReserved) {
    label = <strong>Reservado en Airbnb</strong>
  } else if (isManualSrc && isLinked) {
    label = (
      <>
        <strong>{title}</strong> — <span className="status-badge">Bloqueado en Airbnb</span>
      </>
    )
  } else if (isManualSrc && !isLinked) {
    label = (
      <>
        <strong>{title}</strong> — <span className="status-badge status--warning">No bloqueado en Airbnb</span>
      </>
    )
  } else {
    label = <strong>{title}</strong>
  }

  return <div className="month-event-line">{label}</div>
}

/* ======================================================================= */

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const visibleEvents = useMemo(() => computeVisibleEvents(events), [events])
  const [isLoading, setIsLoading] = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [pendingRange, setPendingRange] = useState<{ start: Date; end: Date; displayEnd: Date } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const propertyId = useMemo(
    () => (import.meta.env.VITE_PROPERTY_ID as string | undefined) ?? 'default-property',
    [],
  )

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

  const syncAirbnb = useCallback(async () => {
    setIsSyncing(true)
    setGlobalError(null)
    try {
      const r = await fetch(`/properties/${propertyId}/airbnb/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!r.ok) {
        const msg = await r.text().catch(() => '')
        throw new Error(msg || `Sync falló con status ${r.status}`)
      }
      await loadEvents()
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'No se pudo sincronizar con Airbnb.')
    } finally {
      setIsSyncing(false)
    }
  }, [propertyId, loadEvents])

  useEffect(() => {
    ;(async () => {
      await loadEvents()
      if (!globalError && events.length === 0) {
        await syncAirbnb()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectSlot = useCallback((slot: SlotInfo) => {
    const slots = Array.isArray(slot.slots) ? slot.slots : []
    const rawDisplayEnd = slots.length > 0 ? slots[slots.length - 1] : slot.end
    setPendingRange({ start: slot.start, end: slot.end, displayEnd: new Date(rawDisplayEnd) })
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
        const payload = await createEvent(
          { title, start: pendingRange.start.toISOString(), end: pendingRange.end.toISOString() },
          propertyId,
        )
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

  const handleRemoveEvent = useCallback(
    async (event: CalendarEvent) => {
      const shouldDelete = window.confirm(`¿Eliminar el evento "${event.title}"?`)
      if (!shouldDelete) return
      try {
        await deleteEvent(event.id, propertyId)
        setEvents((prev) => prev.filter((item) => item.id !== event.id))
      } catch (error) {
        setGlobalError(error instanceof Error ? error.message : 'No se pudo eliminar el evento.')
      }
    },
    [propertyId],
  )

  /* ---------- Colores y estilo de eventos ---------- */
  const eventColors = useMemo(() => {
    const palette = ['#2563eb', '#0ea5e9', '#14b8a6', '#f97316', '#a855f7', '#2569eb', '#0ee91dff', '#87b814ff', '#fc5c4eff', '#141414ff', '#9b9ddaff']
    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime())
    const colorMap = new Map<string, string>()
    let last = -1
    sorted.forEach((ev) => {
      const base = ev.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % palette.length
      let idx = base
      if (palette.length > 1 && idx === last) idx = (idx + 1) % palette.length
      last = idx
      colorMap.set(ev.id, palette[idx])
    })
    return { palette, colorMap }
  }, [events])

  const eventPropGetter = useCallback<CalendarEventPropGetter>(
    (event) => {
      const color = eventColors.colorMap.get(event.id) ?? eventColors.palette[0]
      const isLinked = (event as ViewEvent).duplicateWithAirbnb === true
      return {
        style: {
          backgroundColor: color,
          borderColor: color,
          color: '#ffffff',
          outline: isLinked ? '2px dashed rgba(0,0,0,0.35)' : undefined,
          boxShadow: isLinked ? 'inset 0 0 0 2px rgba(255,255,255,0.6)' : undefined,
        },
      }
    },
    [eventColors],
  )

  return (
    <div className="app-layout">
      <header className="app-header">
        <div>
          <h1>Simple Alquiler</h1>
          <p className="subtitle">Selecciona un rango de fechas en el calendario para crear un evento.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="secondary" onClick={loadEvents} disabled={isLoading || isSyncing}>
            {isLoading ? 'Cargando...' : 'Recargar eventos'}
          </button>
          <button type="button" className="secondary" onClick={syncAirbnb} disabled={isSyncing || isLoading}>
            {isSyncing ? 'Sincronizando…' : 'Sincronizar Airbnb'}
          </button>
        </div>
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
              events={visibleEvents}
              messages={calendarMessages}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleRemoveEvent}
              eventPropGetter={eventPropGetter}
              renderMonthEvent={MonthEventRenderer}
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
