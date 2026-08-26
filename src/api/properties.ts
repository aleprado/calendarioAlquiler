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

export const importGooglePhotosAlbum = async (url: string, limit = 100): Promise<ImportedGooglePhotosAlbumDTO> => {
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

export const parseGoogleMapsPin = (pinUrl: string): { placeId?: string; lat?: string; lng?: string } => {
  const trimmed = pinUrl.trim()
  if (!trimmed) return {}
  try {
    const url = new URL(trimmed)
    const q = url.searchParams.get('q') ?? url.searchParams.get('query') ?? ''
    const placeId = url.searchParams.get('query_place_id') ?? (q.startsWith('place_id:') ? q.replace('place_id:', '') : '')

    const atCoords = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    if (atCoords) {
      return {
        placeId: placeId || undefined,
        lat: atCoords[1],
        lng: atCoords[2],
      }
    }

    const queryCoords = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
    if (queryCoords) {
      return {
        placeId: placeId || undefined,
        lat: queryCoords[1],
        lng: queryCoords[2],
      }
    }

    return {
      placeId: placeId || undefined,
    }
  } catch {
    return {}
  }
}

