import { apiRequest } from './http'
import type { NewPublicRequestPayload, PublicAvailabilityDTO } from '../types'

export const fetchPublicAvailability = async (publicSlug: string): Promise<PublicAvailabilityDTO> => {
  return await apiRequest<PublicAvailabilityDTO>(`/public/properties/${encodeURIComponent(publicSlug)}`)
}

export const submitPublicRequest = async (
  publicSlug: string,
  payload: NewPublicRequestPayload,
): Promise<{ notificationSent: boolean }> => {
  const data = await apiRequest<{ notificationSent: boolean }>(`/public/properties/${encodeURIComponent(publicSlug)}/requests`, {
    method: 'POST',
    json: payload,
  })

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel('reservation_events')
      channel.postMessage({
        type: 'RESERVATION_REQUEST_CREATED',
        publicSlug,
        requesterName: payload.requesterName,
        start: payload.start,
        end: payload.end,
      })
      channel.close()
    } catch {
      // Ignore broadcast errors
    }
  }

  return { notificationSent: Boolean(data.notificationSent) }
}

export const recordPublicView = async (publicSlug: string): Promise<void> => {
  try {
    await apiRequest<void>(`/public/properties/${encodeURIComponent(publicSlug)}/view`, {
      method: 'POST',
    })
  } catch (err) {
    console.error('No se pudo registrar la vista pública:', err)
  }
}

export const recordPublicQuote = async (publicSlug: string): Promise<void> => {
  try {
    await apiRequest<void>(`/public/properties/${encodeURIComponent(publicSlug)}/quote`, {
      method: 'POST',
    })
  } catch (err) {
    console.error('No se pudo registrar la cotización pública:', err)
  }
}
