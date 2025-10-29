import { createElement, useMemo } from 'react'
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
}

const TOTAL_MONTHS = 12

const toolbar: Components<CalendarEvent>['toolbar'] = () => null

const clampEventsToMonth = <T extends CalendarEvent>(events: T[], monthDate: Date): T[] => {
  const monthStart = startOfMonth(monthDate)
  const monthEndExclusive = addMonths(monthStart, 1)
  const monthStartTime = monthStart.getTime()
  const monthEndExclusiveTime = monthEndExclusive.getTime()

  return events.reduce<T[]>((acc, event) => {
    const eventStartTime = event.start.getTime()
    const eventEndTime = event.end.getTime()

    if (eventEndTime <= monthStartTime || eventStartTime >= monthEndExclusiveTime) {
      return acc
    }

    const start = eventStartTime < monthStartTime ? new Date(monthStartTime) : event.start
    const end = eventEndTime > monthEndExclusiveTime ? new Date(monthEndExclusiveTime) : event.end

    if (start === event.start && end === event.end) {
      acc.push(event)
    } else {
      acc.push({ ...event, start, end })
    }

    return acc
  }, [])
}

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
              events={clampEventsToMonth(events, date)}
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
              dayPropGetter={dayPropGetter}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
