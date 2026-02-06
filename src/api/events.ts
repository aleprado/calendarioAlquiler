import { apiRequest } from './http'
import type { CalendarEventDTO, NewEventPayload, SyncAirbnbPayload, UpdateEventPayload, UpdateEventStatusPayload } from '../types'

const buildPath = (propertyId: string, suffix: string) => `/properties/${encodeURIComponent(propertyId)}${suffix}`

export const fetchEvents = async (propertyId: string): Promise<CalendarEventDTO[]> => {
  const data = await apiRequest<{ events: CalendarEventDTO[] }>(buildPath(propertyId, '/events'), { auth: true })
  return Array.isArray(data.events) ? data.events : []
}

export const createEvent = async (propertyId: string, payload: NewEventPayload): Promise<CalendarEventDTO> => {
  const data = await apiRequest<{ event: CalendarEventDTO }>(buildPath(propertyId, '/events'), {
    method: 'POST',
    auth: true,
    json: payload,
  })
  if (!data.event) {
    throw new Error('Respuesta inesperada del servidor.')
  }
  return data.event
}

export const updateEvent = async (
  propertyId: string,
  eventId: string,
  payload: UpdateEventPayload,
): Promise<CalendarEventDTO> => {
  const data = await apiRequest<{ event: CalendarEventDTO }>(buildPath(propertyId, `/events/${encodeURIComponent(eventId)}`), {
    method: 'PATCH',
    auth: true,
    json: payload,
  })
  if (!data.event) {
    throw new Error('Respuesta inesperada del servidor.')
  }
  return data.event
}

export const updateEventStatus = async (
  propertyId: string,
  eventId: string,
  payload: UpdateEventStatusPayload,
): Promise<CalendarEventDTO> => updateEvent(propertyId, eventId, payload)

export const deleteEvent = async (propertyId: string, eventId: string): Promise<void> => {
  await apiRequest(buildPath(propertyId, `/events/${encodeURIComponent(eventId)}`), {
    method: 'DELETE',
    auth: true,
  })
}

export const syncAirbnb = async (propertyId: string, payload: SyncAirbnbPayload): Promise<void> => {
  await apiRequest(buildPath(propertyId, '/airbnb/sync'), {
    method: 'POST',
    auth: true,
    json: payload,
  })
}
