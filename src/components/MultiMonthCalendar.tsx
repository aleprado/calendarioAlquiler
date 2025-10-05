import { useMemo, useState } from 'react'
import { addMonths, format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, Views, type CalendarProps, type Components, type SlotInfo } from 'react-big-calendar'
import type { CalendarEvent } from '../types'
import { localizer } from '../lib/dateLocalizer'

type CalendarMessages = NonNullable<CalendarProps<CalendarEvent>['messages']>
export type CalendarEventPropGetter = NonNullable<CalendarProps<CalendarEvent>['eventPropGetter']>

type MultiMonthCalendarProps = {
  events: CalendarEvent[]
  messages: CalendarMessages
  onSelectSlot: (slot: SlotInfo) => void
  onSelectEvent: (event: CalendarEvent) => void
  eventPropGetter?: CalendarEventPropGetter
}

const VISIBLE_MONTHS = 2

const toolbar: Components<CalendarEvent>['toolbar'] = () => null

const formatRangeLabel = (date: Date) => {
  const end = addMonths(date, VISIBLE_MONTHS - 1)
  const startLabel = format(date, 'LLLL yyyy', { locale: es })
  const endLabel = format(end, 'LLLL yyyy', { locale: es })
  return `${startLabel} - ${endLabel}`
}

export const MultiMonthCalendar = ({
  events,
  messages,
  onSelectSlot,
  onSelectEvent,
  eventPropGetter,
}: MultiMonthCalendarProps) => {
  const [visibleStart, setVisibleStart] = useState(() => startOfMonth(new Date()))

  const months = useMemo(
    () =>
      Array.from({ length: VISIBLE_MONTHS }, (_, index) => ({
        id: index,
        date: addMonths(visibleStart, index),
      })),
    [visibleStart],
  )

  const handlePrev = () => {
    setVisibleStart((prev) => addMonths(prev, -VISIBLE_MONTHS))
  }

  const handleToday = () => {
    setVisibleStart(startOfMonth(new Date()))
  }

  const handleNext = () => {
    setVisibleStart((prev) => addMonths(prev, VISIBLE_MONTHS))
  }

  return (
    <div className="multi-month-calendar">
      <div className="multi-month-calendar__toolbar">
        <button type="button" className="secondary" onClick={handlePrev}>
          Anteriores
        </button>
        <div className="multi-month-calendar__label">{formatRangeLabel(visibleStart)}</div>
        <div className="multi-month-calendar__actions">
          <button type="button" className="secondary" onClick={handleToday}>
            Hoy
          </button>
          <button type="button" className="secondary" onClick={handleNext}>
            Siguientes
          </button>
        </div>
      </div>
      <div className="multi-month-calendar__grid">
        {months.map(({ id, date }) => (
          <div key={id} className="multi-month-calendar__cell">
            <div className="multi-month-calendar__cell-header">{format(date, 'MMMM yyyy', { locale: es })}</div>
            <Calendar<CalendarEvent>
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              messages={messages}
              selectable
              popup
              view={Views.MONTH}
              date={date}
              style={{ height: '100%' }}
              onSelectSlot={onSelectSlot}
              onSelectEvent={onSelectEvent}
              longPressThreshold={250}
              components={{ toolbar }}
              culture="es"
              eventPropGetter={eventPropGetter}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
