import { FieldValue, type DocumentReference } from '@google-cloud/firestore'
import { propertiesCollection } from '../firestore'

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeOptionalNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return Number.isFinite(value) ? value : null
}

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

const normalizeOptionalBoolean = (value: unknown): boolean => value === true

export interface PropertyRecord {
  id: string
  ownerId: string
  name: string
  airbnbIcalUrl: string
  publicSlug: string
  shareCode: string
  memberIds: string[]
  createdAt: string
  updatedAt: string
  instagramUrl: string | null
  googlePhotosUrl: string | null
  description: string | null
  locationLabel: string | null
  googleMapsPinUrl: string | null
  googleMapsPlaceId: string | null
  googleMapsLat: number | null
  googleMapsLng: number | null
  showGoogleReviews: boolean
  googleMapsReviewsUrl: string | null
  galleryImageUrls: string[]
  instagramPostUrls: string[]
}

export interface CreatePropertyInput {
  ownerId: string
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

export interface UpdatePropertyInput {
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

const generateSlug = () => Math.random().toString(36).slice(2, 10)
const generateShareCode = () => Math.random().toString(36).slice(2, 10).toUpperCase()

export class PropertyRepository {
  private toRecord = (doc: FirebaseFirestore.DocumentSnapshot): PropertyRecord | null => {
    if (!doc.exists) return null
    const data = doc.data() as Partial<PropertyRecord>
    const memberIds = Array.isArray(data.memberIds)
      ? data.memberIds.filter((value): value is string => typeof value === 'string')
      : []
    return {
      id: doc.id,
      ownerId: data.ownerId ?? '',
      name: data.name ?? '',
      airbnbIcalUrl: data.airbnbIcalUrl ?? '',
      publicSlug: data.publicSlug ?? '',
      shareCode: data.shareCode ?? '',
      memberIds,
      createdAt: data.createdAt ?? '',
      updatedAt: data.updatedAt ?? '',
      instagramUrl: normalizeOptionalString((data as Record<string, unknown>).instagramUrl),
      googlePhotosUrl: normalizeOptionalString((data as Record<string, unknown>).googlePhotosUrl),
      description: normalizeOptionalString((data as Record<string, unknown>).description),
      locationLabel: normalizeOptionalString((data as Record<string, unknown>).locationLabel),
      googleMapsPinUrl: normalizeOptionalString((data as Record<string, unknown>).googleMapsPinUrl),
      googleMapsPlaceId: normalizeOptionalString((data as Record<string, unknown>).googleMapsPlaceId),
      googleMapsLat: normalizeOptionalNumber((data as Record<string, unknown>).googleMapsLat),
      googleMapsLng: normalizeOptionalNumber((data as Record<string, unknown>).googleMapsLng),
      showGoogleReviews: normalizeOptionalBoolean((data as Record<string, unknown>).showGoogleReviews),
      googleMapsReviewsUrl: normalizeOptionalString((data as Record<string, unknown>).googleMapsReviewsUrl),
      galleryImageUrls: normalizeStringArray((data as Record<string, unknown>).galleryImageUrls),
      instagramPostUrls: normalizeStringArray((data as Record<string, unknown>).instagramPostUrls),
    }
  }

  private ensureSlug = (current?: string) => current ?? generateSlug()
  private ensureShareCode = (current?: string) => current ?? generateShareCode()
  private ensureMemberIds = (current?: string[], ownerId?: string) =>
    Array.isArray(current) && current.length > 0
      ? current.filter((value): value is string => typeof value === 'string')
      : ownerId
        ? [ownerId]
        : []

  private async normalizeShareMetadata(record: PropertyRecord): Promise<PropertyRecord> {
    const updates: Partial<PropertyRecord> = {}
    if (!record.shareCode) {
      updates.shareCode = generateShareCode()
    }
    if ((!record.memberIds || record.memberIds.length === 0) && record.ownerId) {
      updates.memberIds = [record.ownerId]
    }
    if (Object.keys(updates).length === 0) {
      return record
    }

    const docRef = propertiesCollection.doc(record.id)
    await docRef.set(updates, { merge: true })
    return {
      ...record,
      ...updates,
    }
  }

  private async saveWithPayload(ref: DocumentReference, data: Partial<PropertyRecord>) {
    await ref.set(data, { merge: true })
    const snapshot = await ref.get()
    const record = this.toRecord(snapshot)
    if (!record) {
      throw new Error('No se pudo recuperar la propiedad después de guardarla.')
    }
    return record
  }

  async listByMember(userId: string): Promise<PropertyRecord[]> {
    const byMember = await propertiesCollection.where('memberIds', 'array-contains', userId).get()
    const memberProperties = byMember.docs.map((doc) => this.toRecord(doc)).filter(Boolean) as PropertyRecord[]
    if (memberProperties.length > 0) {
      return await Promise.all(memberProperties.map((record) => this.normalizeShareMetadata(record)))
    }

    const legacy = await propertiesCollection.where('ownerId', '==', userId).get()
    const legacyProperties = legacy.docs.map((doc) => this.toRecord(doc)).filter(Boolean) as PropertyRecord[]
    return await Promise.all(legacyProperties.map((record) => this.normalizeShareMetadata(record)))
  }

  async getById(propertyId: string): Promise<PropertyRecord | null> {
    const doc = await propertiesCollection.doc(propertyId).get()
    const record = this.toRecord(doc)
    return record ? await this.normalizeShareMetadata(record) : null
  }

  async getByPublicSlug(slug: string): Promise<PropertyRecord | null> {
    const snapshot = await propertiesCollection.where('publicSlug', '==', slug).limit(1).get()
    if (snapshot.empty) return null
    return this.toRecord(snapshot.docs[0])
  }

  async getByShareCode(shareCode: string): Promise<PropertyRecord | null> {
    const snapshot = await propertiesCollection.where('shareCode', '==', shareCode).limit(1).get()
    if (snapshot.empty) return null
    const record = this.toRecord(snapshot.docs[0])
    return record ? await this.normalizeShareMetadata(record) : null
  }

  async create(input: CreatePropertyInput): Promise<PropertyRecord> {
    const now = new Date().toISOString()
    const docRef = propertiesCollection.doc()
    const payload: Omit<PropertyRecord, 'id'> = {
      ownerId: input.ownerId,
      name: input.name,
      airbnbIcalUrl: input.airbnbIcalUrl,
      publicSlug: generateSlug(),
      shareCode: generateShareCode(),
      memberIds: [input.ownerId],
      createdAt: now,
      updatedAt: now,
      instagramUrl: normalizeOptionalString(input.instagramUrl),
      googlePhotosUrl: normalizeOptionalString(input.googlePhotosUrl),
      description: normalizeOptionalString(input.description),
      locationLabel: normalizeOptionalString(input.locationLabel),
      googleMapsPinUrl: normalizeOptionalString(input.googleMapsPinUrl),
      googleMapsPlaceId: normalizeOptionalString(input.googleMapsPlaceId),
      googleMapsLat: normalizeOptionalNumber(input.googleMapsLat),
      googleMapsLng: normalizeOptionalNumber(input.googleMapsLng),
      showGoogleReviews: input.showGoogleReviews === true,
      googleMapsReviewsUrl: normalizeOptionalString(input.googleMapsReviewsUrl),
      galleryImageUrls: normalizeStringArray(input.galleryImageUrls),
      instagramPostUrls: normalizeStringArray(input.instagramPostUrls),
    }

    await docRef.set(payload)
    return { id: docRef.id, ...payload }
  }

  async update(propertyId: string, updates: UpdatePropertyInput): Promise<PropertyRecord> {
    const docRef = propertiesCollection.doc(propertyId)
    const snapshot = await docRef.get()
    const existing = this.toRecord(snapshot)
    if (!existing) {
      throw new Error('Propiedad no encontrada')
    }

    const now = new Date().toISOString()
    const payload: Partial<PropertyRecord> = {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.airbnbIcalUrl !== undefined ? { airbnbIcalUrl: updates.airbnbIcalUrl } : {}),
      ...(updates.instagramUrl !== undefined
        ? { instagramUrl: normalizeOptionalString(updates.instagramUrl) }
        : {}),
      ...(updates.googlePhotosUrl !== undefined
        ? { googlePhotosUrl: normalizeOptionalString(updates.googlePhotosUrl) }
        : {}),
      ...(updates.description !== undefined ? { description: normalizeOptionalString(updates.description) } : {}),
      ...(updates.locationLabel !== undefined ? { locationLabel: normalizeOptionalString(updates.locationLabel) } : {}),
      ...(updates.googleMapsPinUrl !== undefined
        ? { googleMapsPinUrl: normalizeOptionalString(updates.googleMapsPinUrl) }
        : {}),
      ...(updates.googleMapsPlaceId !== undefined
        ? { googleMapsPlaceId: normalizeOptionalString(updates.googleMapsPlaceId) }
        : {}),
      ...(updates.googleMapsLat !== undefined ? { googleMapsLat: normalizeOptionalNumber(updates.googleMapsLat) } : {}),
      ...(updates.googleMapsLng !== undefined ? { googleMapsLng: normalizeOptionalNumber(updates.googleMapsLng) } : {}),
      ...(updates.showGoogleReviews !== undefined ? { showGoogleReviews: updates.showGoogleReviews === true } : {}),
      ...(updates.googleMapsReviewsUrl !== undefined
        ? { googleMapsReviewsUrl: normalizeOptionalString(updates.googleMapsReviewsUrl) }
        : {}),
      ...(updates.galleryImageUrls !== undefined ? { galleryImageUrls: normalizeStringArray(updates.galleryImageUrls) } : {}),
      ...(updates.instagramPostUrls !== undefined ? { instagramPostUrls: normalizeStringArray(updates.instagramPostUrls) } : {}),
      updatedAt: now,
    }

    if (updates.regenerateSlug) {
      payload.publicSlug = generateSlug()
    } else {
      payload.publicSlug = this.ensureSlug(existing.publicSlug)
    }

    payload.shareCode = this.ensureShareCode(existing.shareCode)
    payload.memberIds = this.ensureMemberIds(existing.memberIds, existing.ownerId)

    return await this.saveWithPayload(docRef, payload)
  }

  async addMember(propertyId: string, userId: string): Promise<PropertyRecord> {
    const docRef = propertiesCollection.doc(propertyId)
    const existing = await this.getById(propertyId)
    if (!existing) {
      throw new Error('Propiedad no encontrada')
    }

    const shareCode = this.ensureShareCode(existing.shareCode)
    await docRef.set(
      {
        memberIds: FieldValue.arrayUnion(userId),
        shareCode,
      },
      { merge: true },
    )
    const updatedSnapshot = await docRef.get()
    const record = this.toRecord(updatedSnapshot)
    return record ? await this.normalizeShareMetadata(record) : existing
  }
}

export const propertyRepository = new PropertyRepository()
