import type { PropertyRecord } from '../repositories/propertyRepository'
import { propertyRepository } from '../repositories/propertyRepository'
import { ServiceError } from '../utils/errors'

export interface CreatePropertyPayload {
  name: string
  airbnbIcalUrl: string
  instagramUrl?: string | null
  googlePhotosUrl?: string | null
  description?: string | null
  locationLabel?: string | null
  googleMapsPinUrl?: string | null
  googleMapsPlaceId?: string | null
  googleMapsLat?: number | null
  googleMapsLng?: number | null
  showGoogleReviews?: boolean
  googleMapsReviewsUrl?: string | null
  galleryImageUrls?: string[]
  instagramPostUrls?: string[]
}

export interface UpdatePropertyPayload {
  name?: string
  airbnbIcalUrl?: string
  instagramUrl?: string | null
  googlePhotosUrl?: string | null
  description?: string | null
  locationLabel?: string | null
  googleMapsPinUrl?: string | null
  googleMapsPlaceId?: string | null
  googleMapsLat?: number | null
  googleMapsLng?: number | null
  showGoogleReviews?: boolean
  googleMapsReviewsUrl?: string | null
  galleryImageUrls?: string[]
  instagramPostUrls?: string[]
  regenerateSlug?: boolean
}

const sanitizeOptionalUrl = (value?: string | null) => {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const sanitizeOptionalText = (value?: string | null) => {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const sanitizeStringList = (value?: string[]) => {
  if (!Array.isArray(value)) return undefined
  return value.map((item) => item.trim()).filter((item) => item.length > 0)
}

export class PropertyService {
  private assertAccess(userId: string, property: PropertyRecord | null): PropertyRecord {
    if (!property) {
      throw new ServiceError('Propiedad no encontrada', 404)
    }

    const memberIds = Array.isArray(property.memberIds) ? property.memberIds : []
    const isMember = memberIds.includes(userId) || property.ownerId === userId
    if (!isMember) {
      throw new ServiceError('Propiedad no encontrada', 404)
    }

    return property
  }

  async listForUser(userId: string): Promise<PropertyRecord[]> {
    return await propertyRepository.listByMember(userId)
  }

  async create(userId: string, payload: CreatePropertyPayload): Promise<PropertyRecord> {
    if (!payload.name.trim()) {
      throw new ServiceError('El nombre de la propiedad es obligatorio')
    }

    if (!payload.airbnbIcalUrl.trim()) {
      throw new ServiceError('El enlace de iCal de Airbnb es obligatorio')
    }

    return await propertyRepository.create({
      ownerId: userId,
      name: payload.name.trim(),
      airbnbIcalUrl: payload.airbnbIcalUrl.trim(),
      instagramUrl: sanitizeOptionalUrl(payload.instagramUrl) ?? null,
      googlePhotosUrl: sanitizeOptionalUrl(payload.googlePhotosUrl) ?? null,
      description: sanitizeOptionalText(payload.description) ?? null,
      locationLabel: sanitizeOptionalText(payload.locationLabel) ?? null,
      googleMapsPinUrl: sanitizeOptionalUrl(payload.googleMapsPinUrl) ?? null,
      googleMapsPlaceId: sanitizeOptionalText(payload.googleMapsPlaceId) ?? null,
      googleMapsLat: payload.googleMapsLat ?? null,
      googleMapsLng: payload.googleMapsLng ?? null,
      showGoogleReviews: payload.showGoogleReviews === true,
      googleMapsReviewsUrl: sanitizeOptionalUrl(payload.googleMapsReviewsUrl) ?? null,
      galleryImageUrls: sanitizeStringList(payload.galleryImageUrls) ?? [],
      instagramPostUrls: sanitizeStringList(payload.instagramPostUrls) ?? [],
    })
  }

  async update(userId: string, propertyId: string, payload: UpdatePropertyPayload): Promise<PropertyRecord> {
    this.assertAccess(userId, await propertyRepository.getById(propertyId))

    return await propertyRepository.update(propertyId, {
      name: payload.name,
      airbnbIcalUrl: payload.airbnbIcalUrl,
      instagramUrl: sanitizeOptionalUrl(payload.instagramUrl),
      googlePhotosUrl: sanitizeOptionalUrl(payload.googlePhotosUrl),
      description: sanitizeOptionalText(payload.description),
      locationLabel: sanitizeOptionalText(payload.locationLabel),
      googleMapsPinUrl: sanitizeOptionalUrl(payload.googleMapsPinUrl),
      googleMapsPlaceId: sanitizeOptionalText(payload.googleMapsPlaceId),
      googleMapsLat: payload.googleMapsLat,
      googleMapsLng: payload.googleMapsLng,
      showGoogleReviews: payload.showGoogleReviews,
      googleMapsReviewsUrl: sanitizeOptionalUrl(payload.googleMapsReviewsUrl),
      galleryImageUrls: sanitizeStringList(payload.galleryImageUrls),
      instagramPostUrls: sanitizeStringList(payload.instagramPostUrls),
      regenerateSlug: payload.regenerateSlug,
    })
  }

  async getOwnedProperty(userId: string, propertyId: string): Promise<PropertyRecord> {
    return this.assertAccess(userId, await propertyRepository.getById(propertyId))
  }

  async joinByShareCode(userId: string, shareCode: string): Promise<PropertyRecord> {
    const normalizedCode = shareCode.trim().toUpperCase()
    if (!normalizedCode) {
      throw new ServiceError('El código de acceso es obligatorio')
    }

    const property = await propertyRepository.getByShareCode(normalizedCode)
    if (!property) {
      throw new ServiceError('El código ingresado no es válido.', 404)
    }

    if (property.memberIds.includes(userId) || property.ownerId === userId) {
      return property
    }

    return await propertyRepository.addMember(property.id, userId)
  }

  async findByPublicSlug(slug: string): Promise<PropertyRecord | null> {
    if (!slug.trim()) {
      return null
    }

    return await propertyRepository.getByPublicSlug(slug.trim())
  }
}

export const propertyService = new PropertyService()
