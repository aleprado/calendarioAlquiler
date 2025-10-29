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
    })
  }

  async update(userId: string, propertyId: string, payload: UpdatePropertyPayload): Promise<PropertyRecord> {
    const property = this.assertAccess(userId, await propertyRepository.getById(propertyId))

    return await propertyRepository.update(propertyId, {
      name: payload.name,
      airbnbIcalUrl: payload.airbnbIcalUrl,
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
