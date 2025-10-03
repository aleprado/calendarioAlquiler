import type { CalendarEventDTO, NewEventPayload, SyncAirbnbPayload } from '../types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
const DEFAULT_PROPERTY_ID = (import.meta.env.VITE_PROPERTY_ID as string | undefined) ?? 'default-property'
const BASIC_AUTH_TOKEN = (import.meta.env.VITE_API_BASIC_AUTH as string | undefined) ?? ''

if (!API_BASE_URL) {
  console.warn('VITE_API_BASE_URL no está definido. Las llamadas a la API fallarán.')
}

const normalizeBaseUrl = (url: string) => (url.endsWith('/') ? url.slice(0, -1) : url)

const baseUrl = normalizeBaseUrl(API_BASE_URL)

const buildHeaders = (extra?: Record<string, string>) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  }

  if (BASIC_AUTH_TOKEN) {
    headers.Authorization = `Basic ${BASIC_AUTH_TOKEN}`
  }

  return headers
}

const handleResponse = async (response: Response) => {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : 'No se pudo completar la operación.'
    throw new Error(message)
  }

  return payload
}

const buildPropertyPath = (propertyId?: string) => {
  const id = propertyId?.trim() || DEFAULT_PROPERTY_ID
  return `${baseUrl}/properties/${encodeURIComponent(id)}`
}

export const fetchEvents = async (propertyId?: string): Promise<CalendarEventDTO[]> => {
  const response = await fetch(`${buildPropertyPath(propertyId)}/events`, {
    headers: buildHeaders(),
  })
  const data = await handleResponse(response)
  return Array.isArray(data.events) ? data.events : []
}

export const createEvent = async (
  event: NewEventPayload,
  propertyId?: string,
): Promise<CalendarEventDTO> => {
  const response = await fetch(`${buildPropertyPath(propertyId)}/events`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(event),
  })

  const data = await handleResponse(response)
  if (!data.event) {
    throw new Error('Respuesta inesperada del servidor.')
  }

  return data.event
}

export const deleteEvent = async (id: string, propertyId?: string): Promise<void> => {
  const response = await fetch(`${buildPropertyPath(propertyId)}/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message = typeof payload?.message === 'string' ? payload.message : 'No se pudo eliminar el evento.'
    throw new Error(message)
  }
}

export const syncAirbnb = async (
  payload: SyncAirbnbPayload,
  propertyId?: string,
): Promise<void> => {
  const response = await fetch(`${buildPropertyPath(propertyId)}/airbnb/sync`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  })

  await handleResponse(response)
}
