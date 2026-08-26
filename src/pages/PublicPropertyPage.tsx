import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SlotInfo } from 'react-big-calendar'
import { Link, useParams } from 'react-router-dom'
import { MultiMonthCalendar, type CalendarEventPropGetter, type MonthEventComponentProps } from '../components/MultiMonthCalendar'
import { RequestFormModal } from '../components/RequestFormModal'
import { CotizadorWidget } from '../components/CotizadorWidget'
import { fetchPublicAvailability, submitPublicRequest, recordPublicView, recordPublicQuote } from '../api/public'
import type { CalendarEvent, PublicAvailabilityDTO } from '../types'
import { useLocale } from '../i18n/LocaleContext'
import { LanguageSelector } from '../components/LanguageSelector'

const formatDateLocal = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toIsoDateString = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T00:00:00.000Z`
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

const startOfDayLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const normalizeSlotSelection = (start: Date, end: Date) => {
  const normalizedStart = startOfDayLocal(start)
  const normalizedEnd = startOfDayLocal(end)
  const diffDays = Math.round((normalizedEnd.getTime() - normalizedStart.getTime()) / MS_IN_DAY)

  const effectiveEnd = diffDays > 1 ? new Date(normalizedEnd.getTime() - MS_IN_DAY) : ensureEndAfterStart(normalizedStart, normalizedEnd)

  return {
    start: normalizedStart,
    end: effectiveEnd,
    displayEnd: effectiveEnd,
  }
}

const normalizeDirectRange = (start: Date, end: Date) => {
  const normalizedStart = startOfDayLocal(start)
  const normalizedEnd = startOfDayLocal(end)
  const effectiveEnd = ensureEndAfterStart(normalizedStart, normalizedEnd)

  return {
    start: normalizedStart,
    end: effectiveEnd,
    displayEnd: effectiveEnd,
  }
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
  const { t } = useLocale()
  
  const calendarMessages = useMemo(() => ({
    date: t('calDate'),
    time: t('calTime'),
    event: t('calEvent'),
    allDay: t('calAllDay'),
    week: t('calWeek'),
    work_week: t('calWorkWeek'),
    day: t('calDay'),
    month: t('calMonth'),
    previous: t('calPrevious'),
    next: t('calNext'),
    yesterday: t('calYesterday'),
    tomorrow: t('calTomorrow'),
    today: t('calToday'),
    agenda: t('calAgenda'),
    showMore: (total: number) => `+${total}`,
    noEventsInRange: t('calNoEvents'),
  }), [t])

  const [data, setData] = useState<PublicAvailabilityDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingRange, setPendingRange] = useState<{ start: Date; end: Date; displayEnd: Date } | null>(null)
  const [selectedDatesStr, setSelectedDatesStr] = useState<{ start: string; end: string } | null>(null)
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
      const sessionKey = `viewed_${publicSlug}`
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, '1')
        void recordPublicView(publicSlug)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('publicLoadError'))
    } finally {
      setIsLoading(false)
    }
  }, [publicSlug, t])

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
      const range = normalizeSlotSelection(slot.start, slot.end)

      const startStr = formatDateLocal(range.start)
      const endStr = formatDateLocal(range.end)
      setSelectedDatesStr({ start: startStr, end: endStr })

      const overlapsBlocked = events.some((event) => rangesOverlap(event, range.start, range.end) && event.status !== 'declined')
      if (overlapsBlocked) {
        setFeedback(null)
        setCalendarHint(t('publicDatesOccupied'))
        return
      }

      setCalendarHint(null)
      setFeedback(null)
      setPendingRange(range)
      setModalError(null)
    },
    [data, events, t],
  )

  const handleCotizadorDatesChange = (s: string, e: string) => {
    setSelectedDatesStr({ start: s, end: e })
    const sP = s.split('-').map(Number)
    const eP = e.split('-').map(Number)
    if (sP.length === 3 && eP.length === 3) {
      const sDate = new Date(sP[0], sP[1] - 1, sP[2])
      const eDate = new Date(eP[0], eP[1] - 1, eP[2])
      if (!Number.isNaN(sDate.getTime()) && !Number.isNaN(eDate.getTime()) && eDate > sDate) {
        const range = normalizeDirectRange(sDate, eDate)
        setPendingRange(range)
      }
    }
  }

  const handleOpenReservationModalFor = (s: string, e: string) => {
    const sP = s.split('-').map(Number)
    const eP = e.split('-').map(Number)
    if (sP.length === 3 && eP.length === 3) {
      const sDate = new Date(sP[0], sP[1] - 1, sP[2])
      const eDate = new Date(eP[0], eP[1] - 1, eP[2])
      if (!Number.isNaN(sDate.getTime()) && !Number.isNaN(eDate.getTime()) && eDate > sDate) {
        const range = normalizeDirectRange(sDate, eDate)
        setPendingRange(range)
        setIsModalOpen(true)
      }
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setPendingRange(null)
    setModalError(null)
  }

  const handleSubmitRequest = async (payload: {
    name: string
    email?: string
    phone?: string
    notes?: string
    start: Date
    end: Date
  }) => {
    if (!data) return
    setIsSubmitting(true)
    setModalError(null)
    try {
      const overlapsBlocked = events.some((event) => rangesOverlap(event, payload.start, payload.end) && event.status !== 'declined')
      if (overlapsBlocked) {
        throw new Error(t('publicDatesTaken'))
      }

      const response = await submitPublicRequest(data.publicSlug, {
        start: toIsoDateString(payload.start),
        end: toIsoDateString(payload.end),
        requesterName: payload.name,
        requesterEmail: payload.email,
        requesterPhone: payload.phone,
        notes: payload.notes,
      })
      setFeedback(
        response.notificationSent
          ? t('publicRequestSentNotified')
          : t('publicRequestSent'),
      )
      handleCloseModal()
      await loadAvailability()
    } catch (err) {
      setModalError(err instanceof Error ? err.message : t('publicRequestError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="public-calendar-layout">
      {isLoading ? (
        <div className="loading">{t('publicLoadingAvail')}</div>
      ) : error ? (
        <div className="alert" role="alert">
          <span>{error}</span>
        </div>
      ) : data ? (
        <>
          <header className="public-calendar-header">
            <div>
              <p className="promo-label">{t('publicCalendarLabel')}</p>
              <h1>{data.propertyName}</h1>
              <p>{t('publicCalendarDesc')}</p>
            </div>
            <div className="public-calendar-header__actions">
              <LanguageSelector />
              <Link className="secondary" to={`/public/${data.publicSlug}`}>
                {t('publicBackToPage')}
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

          <div className={`public-calendar-main-grid${data.showQuoterPublic ? ' public-calendar-main-grid--with-quoter' : ''}`}>
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

            {data.showQuoterPublic && (
              <aside className="calendar-sidebar-quoter">
                <CotizadorWidget
                  mode="public"
                  monthlyRatesUSD={data.quoterMonthlyRatesUSD}
                  adminCommissionPercent={data.quoterAdminCommissionPercent}
                  cleaningFeeUSD={data.quoterCleaningFeeUSD}
                  customExchangeRates={data.quoterCustomExchangeRates}
                  blockedEvents={data.events}
                  checkInTime={data.defaultCheckInTime ?? '15:00'}
                  checkOutTime={data.defaultCheckOutTime ?? '11:00'}
                  initialStartDate={selectedDatesStr?.start}
                  initialEndDate={selectedDatesStr?.end}
                  onDatesChange={(s, e) => handleCotizadorDatesChange(s, e)}
                  onQuoteCalculated={(s, e) => {
                    const sessionKey = `quoted_${publicSlug}_${s}_${e}`
                    if (!sessionStorage.getItem(sessionKey)) {
                      sessionStorage.setItem(sessionKey, '1')
                      void recordPublicQuote(publicSlug)
                    }
                  }}
                  onRequestReservation={(s, e) => handleOpenReservationModalFor(s, e)}
                />
              </aside>
            )}
          </div>
        </>
      ) : null}

      <footer className="public-mini-footer">
        <p className="public-powered-by">
          {t('poweredBy')}{' '}
          <a href="https://simplealquiler.net" target="_blank" rel="noopener noreferrer">
            simplealquiler.net
          </a>
        </p>
      </footer>

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
