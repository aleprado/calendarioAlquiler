import axios from 'axios'
import ical, { CalendarComponent, ParamList } from 'ical'
import { addMilliseconds } from 'date-fns'
import { AirbnbCalendarEvent } from './types'

const USER_AGENT = 'CalendarioAlquilerBot/1.0 (contact: soporte@calendarioalquiler.com)'
const REQUEST_TIMEOUT_MS = 15000

const normalizeStatus = (rawStatus?: string): AirbnbCalendarEvent['status'] => {
  const status = (rawStatus ?? '').toLowerCase()

  switch (status) {
    case 'cancelled':
    case 'canceled':
      return 'cancelled'
    case 'tentative':
      return 'tentative'
    default:
      return 'confirmed'
  }
}

const isParamList = (value: unknown): value is ParamList =>
  typeof value === 'object' && value !== null && 'val' in (value as Record<string, unknown>)

const hasToJsDate = (value: unknown): value is { toJSDate: () => Date } =>
  typeof value === 'object' && value !== null && 'toJSDate' in (value as Record<string, unknown>)

const normalizeDate = (dateLike: CalendarComponent['start']) => {
  if (!dateLike) {
    return null
  }

  const value: unknown = dateLike

  if (value instanceof Date) {
    return value
  }

  if (hasToJsDate(value)) {
    return value.toJSDate()
  }

  if (isParamList(value)) {
    const parsed = new Date(value.val)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

const ensureExclusiveEnd = (start: Date, end: Date) => {
  if (end > start) {
    return end
  }

  // Airbnb ICS feeds occasionally omit end times for all-day events; assume 1 day duration
  return addMilliseconds(start, 24 * 60 * 60 * 1000)
}

export const downloadIcs = async (icalUrl: string): Promise<string> => {
  const response = await axios.get<string>(icalUrl, {
    responseType: 'text',
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5',
    },
  })

  return response.data
}

const normalizeText = (value: string | ParamList | undefined) => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  return value.val
}

export const parseAirbnbIcs = (icsRaw: string, includeTentative = false) => {
  const parsed = ical.parseICS(icsRaw)

  const confirmed: AirbnbCalendarEvent[] = []
  const tentative: AirbnbCalendarEvent[] = []

  Object.entries(parsed).forEach(([uid, component]) => {
    if (!component || component.type !== 'VEVENT') {
      return
    }

    const start = normalizeDate(component.start)
    const end = normalizeDate(component.end)

    if (!start || !end) {
      return
    }

    const event: AirbnbCalendarEvent = {
      uid: normalizeText(component.uid) ?? uid,
      summary: 'Reservado o bloqueado desde Airbnb',
      description: normalizeText(component.description),
      start,
      end: ensureExclusiveEnd(start, end),
      status: normalizeStatus(normalizeText(component.status)),
      lastModified: normalizeDate(component.lastmodified) ?? undefined,
      location: normalizeText(component.location),
    }

    if (event.status === 'tentative') {
      tentative.push(event)
      return
    }

    if (event.status === 'cancelled') {
      return
    }

    confirmed.push(event)
  })

  return {
    confirmed,
    tentative: includeTentative ? tentative : [],
  }
}
