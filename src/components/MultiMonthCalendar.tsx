import { useMemo } from 'react'
import { addMonths, format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, Views, type CalendarProps, type Components, type SlotInfo, type EventProps } from 'react-big-calendar'
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
  renderMonthEvent?: React.ComponentType<EventProps<CalendarEvent>>
  dayPropGetter?: CalendarProps<CalendarEvent>['dayPropGetter']
}

const TOTAL_MONTHS = 12

const toolbar: Components<CalendarEvent>['toolbar'] = () => null

export const MultiMonthCalendar = ({
  events,
  messages,
  onSelectSlot,
  onSelectEvent,
  eventPropGetter,
  renderMonthEvent,
  dayPropGetter,
}: MultiMonthCalendarProps) => {
  const visibleStart = useMemo(() => startOfMonth(new Date()), [])

  const months = useMemo(
    () =>
      Array.from({ length: TOTAL_MONTHS }, (_, index) => ({
        id: index,
        date: addMonths(visibleStart, index),
      })),
    [visibleStart],
  )

  return (
    <div className="multi-month-calendar">
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
              components={{
                toolbar,
                month: { event: renderMonthEvent },
              }}
              culture="es"
              eventPropGetter={eventPropGetter}
              dayPropGetter={dayPropGetter}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
