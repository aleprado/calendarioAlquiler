import { apiRequest } from './http'
import type { NewPropertyPayload, PropertyDTO, UpdatePropertyPayload } from '../types'

export const listProperties = async (): Promise<PropertyDTO[]> => {
  const data = await apiRequest<{ properties: PropertyDTO[] }>('/properties', { auth: true })
  return Array.isArray(data.properties) ? data.properties : []
}

export const createProperty = async (payload: NewPropertyPayload): Promise<PropertyDTO> => {
  const data = await apiRequest<{ property: PropertyDTO }>('/properties', {
    method: 'POST',
    auth: true,
    json: payload,
  })

  if (!data.property) {
    throw new Error('Respuesta inesperada del servidor.')
  }

  return data.property
}

export const updateProperty = async (propertyId: string, payload: UpdatePropertyPayload): Promise<PropertyDTO> => {
  const data = await apiRequest<{ property: PropertyDTO }>(`/properties/${encodeURIComponent(propertyId)}`, {
    method: 'PATCH',
    auth: true,
    json: payload,
  })

  if (!data.property) {
    throw new Error('Respuesta inesperada del servidor.')
  }

  return data.property
}
