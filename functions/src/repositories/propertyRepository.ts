import type { DocumentReference } from '@google-cloud/firestore'
import { propertiesCollection } from '../firestore'

export interface PropertyRecord {
  id: string
  ownerId: string
  name: string
  airbnbIcalUrl: string
  publicSlug: string
  createdAt: string
  updatedAt: string
}

export interface CreatePropertyInput {
  ownerId: string
  name: string
  airbnbIcalUrl: string
}

export interface UpdatePropertyInput {
  name?: string
  airbnbIcalUrl?: string
  regenerateSlug?: boolean
}

const generateSlug = () => Math.random().toString(36).slice(2, 10)

export class PropertyRepository {
  private toRecord = (doc: FirebaseFirestore.DocumentSnapshot): PropertyRecord | null => {
    if (!doc.exists) return null
    const data = doc.data() as Omit<PropertyRecord, 'id'>
    return { id: doc.id, ...data }
  }

  private ensureSlug = (current?: string) => current ?? generateSlug()

  private async saveWithPayload(ref: DocumentReference, data: Partial<PropertyRecord>) {
    await ref.set(data, { merge: true })
    const snapshot = await ref.get()
    const record = this.toRecord(snapshot)
    if (!record) {
      throw new Error('No se pudo recuperar la propiedad después de guardarla.')
    }
    return record
  }

  async listByOwner(ownerId: string): Promise<PropertyRecord[]> {
    const snapshot = await propertiesCollection.where('ownerId', '==', ownerId).get()
    return snapshot.docs.map((doc) => this.toRecord(doc)).filter(Boolean) as PropertyRecord[]
  }

  async getById(propertyId: string): Promise<PropertyRecord | null> {
    const doc = await propertiesCollection.doc(propertyId).get()
    return this.toRecord(doc)
  }

  async getByPublicSlug(slug: string): Promise<PropertyRecord | null> {
    const snapshot = await propertiesCollection.where('publicSlug', '==', slug).limit(1).get()
    if (snapshot.empty) return null
    return this.toRecord(snapshot.docs[0])
  }

  async create(input: CreatePropertyInput): Promise<PropertyRecord> {
    const now = new Date().toISOString()
    const docRef = propertiesCollection.doc()
    const payload: Omit<PropertyRecord, 'id'> = {
      ownerId: input.ownerId,
      name: input.name,
      airbnbIcalUrl: input.airbnbIcalUrl,
      publicSlug: generateSlug(),
      createdAt: now,
      updatedAt: now,
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
      updatedAt: now,
    }

    if (updates.regenerateSlug) {
      payload.publicSlug = generateSlug()
    } else {
      payload.publicSlug = this.ensureSlug(existing.publicSlug)
    }

    return await this.saveWithPayload(docRef, payload)
  }
}

export const propertyRepository = new PropertyRepository()
