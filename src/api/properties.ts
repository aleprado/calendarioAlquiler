import { apiRequest } from './http'
import type {
  ImportedGooglePhotosAlbumDTO,
  JoinPropertyPayload,
  NewPropertyPayload,
  PropertyDTO,
  ResolvedGoogleMapsLinkDTO,
  UpdatePropertyPayload,
} from '../types'

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

export const joinProperty = async (payload: JoinPropertyPayload): Promise<PropertyDTO> => {
  const data = await apiRequest<{ property: PropertyDTO }>('/properties/join', {
    method: 'POST',
    auth: true,
    json: payload,
  })

  if (!data.property) {
    throw new Error('Respuesta inesperada del servidor.')
  }

  return data.property
}

export const resolveGoogleMapsLink = async (url: string): Promise<ResolvedGoogleMapsLinkDTO> => {
  const data = await apiRequest<{ resolved: ResolvedGoogleMapsLinkDTO }>('/properties/resolve-map-link', {
    method: 'POST',
    auth: true,
    json: { url },
  })

  if (!data.resolved) {
    throw new Error('No se pudo interpretar el enlace de Google Maps.')
  }

  return data.resolved
}

export const importGooglePhotosAlbum = async (url: string, limit = 24): Promise<ImportedGooglePhotosAlbumDTO> => {
  const data = await apiRequest<{ imported: ImportedGooglePhotosAlbumDTO }>('/properties/import-google-photos', {
    method: 'POST',
    auth: true,
    json: { url, limit },
  })

  if (!data.imported || !Array.isArray(data.imported.images)) {
    throw new Error('No se pudieron importar imágenes del álbum.')
  }

  return data.imported
}
