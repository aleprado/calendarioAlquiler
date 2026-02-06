import { createElement, useMemo, useState } from 'react'
import { addMonths, format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, Views, type CalendarProps, type Components, type SlotInfo, type EventProps } from 'react-big-calendar'
import type { CalendarEvent } from '../types'
import { localizer } from '../lib/dateLocalizer'

type CalendarMessages = NonNullable<CalendarProps<CalendarEvent>['messages']>
export type CalendarEventPropGetter = NonNullable<CalendarProps<CalendarEvent>['eventPropGetter']>
export type MonthEventComponentProps = EventProps<CalendarEvent> & { monthDate: Date }

type MultiMonthCalendarProps = {
  events: CalendarEvent[]
  messages: CalendarMessages
  onSelectSlot: (slot: SlotInfo) => void
  onSelectEvent: (event: CalendarEvent) => void
  eventPropGetter?: CalendarEventPropGetter
  renderMonthEvent?: React.ComponentType<MonthEventComponentProps>
  dayPropGetter?: CalendarProps<CalendarEvent>['dayPropGetter']
  monthsToShow?: number
  showNavigator?: boolean
}

const DEFAULT_TOTAL_MONTHS = 12

const toolbar: Components<CalendarEvent>['toolbar'] = () => null

// Keep cross-month events intact while only rendering those that intersect the current month.
const filterEventsForMonth = <T extends CalendarEvent>(events: T[], monthDate: Date): T[] => {
  const monthStart = startOfMonth(monthDate)
  const monthEndExclusive = addMonths(monthStart, 1)
  const monthStartTime = monthStart.getTime()
  const monthEndExclusiveTime = monthEndExclusive.getTime()

  return events.filter((event) => {
    const eventStartTime = event.start.getTime()
    const eventEndTime = event.end.getTime()
    return eventEndTime > monthStartTime && eventStartTime < monthEndExclusiveTime
  })
}

export const MultiMonthCalendar = ({
  events,
  messages,
  onSelectSlot,
  onSelectEvent,
  eventPropGetter,
  renderMonthEvent,
  dayPropGetter,
  monthsToShow = DEFAULT_TOTAL_MONTHS,
  showNavigator = false,
}: MultiMonthCalendarProps) => {
  const todayMonth = useMemo(() => startOfMonth(new Date()), [])
  const [anchorMonth, setAnchorMonth] = useState(todayMonth)

  const months = useMemo(
    () =>
      Array.from({ length: Math.max(1, monthsToShow) }, (_, index) => ({
        id: index,
        date: addMonths(anchorMonth, index),
      })),
    [anchorMonth, monthsToShow],
  )

  return (
    <div className="multi-month-calendar">
      {showNavigator && (
        <div className="calendar-navigator">
          <button type="button" className="secondary" onClick={() => setAnchorMonth((current) => addMonths(current, -1))}>
            Mes anterior
          </button>
          <button type="button" className="secondary" onClick={() => setAnchorMonth(todayMonth)}>
            Hoy
          </button>
          <button type="button" className="secondary" onClick={() => setAnchorMonth((current) => addMonths(current, 1))}>
            Mes siguiente
          </button>
        </div>
      )}
      <div className="multi-month-calendar__grid">
        {months.map(({ id, date }) => (
          <div key={id} className="multi-month-calendar__cell">
            <div className="multi-month-calendar__cell-header">{format(date, 'MMMM yyyy', { locale: es })}</div>
            <Calendar<CalendarEvent>
              localizer={localizer}
              events={filterEventsForMonth(events, date)}
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
                ...(renderMonthEvent
                  ? {
                      month: {
                        event: (eventProps: EventProps<CalendarEvent>) =>
                          createElement(renderMonthEvent, { ...eventProps, monthDate: date }),
                      },
                    }
                  : {}),
              }}
              culture="es"
              eventPropGetter={eventPropGetter}
              dayPropGetter={
                dayPropGetter
                  ? (currentDate) =>
                      currentDate.getMonth() === date.getMonth() ? dayPropGetter(currentDate) : {}
                  : undefined
              }
            />
          </div>
        ))}
      </div>
    </div>
  )
}
