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
  return { notificationSent: Boolean(data.notificationSent) }
}
