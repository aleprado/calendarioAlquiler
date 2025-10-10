import type { PropertyRecord } from '../repositories/propertyRepository'
import { propertyRepository } from '../repositories/propertyRepository'
import { ServiceError } from '../utils/errors'

export interface CreatePropertyPayload {
  name: string
  airbnbIcalUrl: string
}

export interface UpdatePropertyPayload {
  name?: string
  airbnbIcalUrl?: string
  regenerateSlug?: boolean
}

export class PropertyService {
  async listForUser(userId: string): Promise<PropertyRecord[]> {
    return await propertyRepository.listByOwner(userId)
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
    })
  }

  async update(userId: string, propertyId: string, payload: UpdatePropertyPayload): Promise<PropertyRecord> {
    const property = await propertyRepository.getById(propertyId)
    if (!property || property.ownerId !== userId) {
      throw new ServiceError('Propiedad no encontrada', 404)
    }

    return await propertyRepository.update(propertyId, {
      name: payload.name,
      airbnbIcalUrl: payload.airbnbIcalUrl,
      regenerateSlug: payload.regenerateSlug,
    })
  }

  async getOwnedProperty(userId: string, propertyId: string): Promise<PropertyRecord> {
    const property = await propertyRepository.getById(propertyId)
    if (!property || property.ownerId !== userId) {
      throw new ServiceError('Propiedad no encontrada', 404)
    }
    return property
  }

  async findByPublicSlug(slug: string): Promise<PropertyRecord | null> {
    if (!slug.trim()) {
      return null
    }

    return await propertyRepository.getByPublicSlug(slug.trim())
  }
}

export const propertyService = new PropertyService()
