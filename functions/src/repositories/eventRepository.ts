import type { AirbnbCalendarEvent } from '../types'
import { FieldValue } from '@google-cloud/firestore'
import { eventsCollection } from '../firestore'

export type EventSource = 'manual' | 'airbnb' | 'public'
export type EventStatus = 'pending' | 'confirmed' | 'tentative' | 'declined'
export type CleaningStatus = 'pending' | 'done'

export interface PersistedEvent {
  id: string
  title: string
  start: string
  end: string
  source: EventSource
  status: EventStatus
  cleaningStatus?: CleaningStatus
  createdAt: string
  updatedAt: string
  externalId?: string
  description?: string
  location?: string
  requesterName?: string
  requesterEmail?: string
  requesterPhone?: string
  notes?: string
}

export interface CreateManualEventInput {
  title: string
  start: string
  end: string
  description?: string
  location?: string
}

export interface CreatePublicRequestInput {
  start: string
  end: string
  requesterName: string
  requesterEmail?: string
  requesterPhone?: string
  notes?: string
}

export interface UpdateEventInput {
  status?: Exclude<EventStatus, 'tentative'>
  cleaningStatus?: CleaningStatus
  title?: string
  start?: string
  end?: string
  description?: string | null
  location?: string | null
}

const toPersisted = (doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) => {
  if (!doc.exists) return null
  return { id: doc.id, ...(doc.data() as Omit<PersistedEvent, 'id'>) }
}

export class EventRepository {
  async list(propertyId: string): Promise<PersistedEvent[]> {
    const snapshot = await eventsCollection(propertyId).orderBy('start').get()
    return snapshot.docs.map((doc) => toPersisted(doc)).filter(Boolean) as PersistedEvent[]
  }

  async findById(propertyId: string, eventId: string): Promise<PersistedEvent | null> {
    const snapshot = await eventsCollection(propertyId).doc(eventId).get()
    return toPersisted(snapshot)
  }

  async createManual(propertyId: string, input: CreateManualEventInput): Promise<PersistedEvent> {
    const now = new Date().toISOString()
    const payload: Omit<PersistedEvent, 'id'> = {
      title: input.title,
      start: input.start,
      end: input.end,
      source: 'manual',
      status: 'confirmed',
      cleaningStatus: 'pending',
      createdAt: now,
      updatedAt: now,
      description: input.description,
      location: input.location,
    }

    const docRef = await eventsCollection(propertyId).add(payload)
    return { id: docRef.id, ...payload }
  }

  async createPublicRequest(propertyId: string, input: CreatePublicRequestInput): Promise<PersistedEvent> {
    const now = new Date().toISOString()
    const title = input.requesterName ? `Solicitud de ${input.requesterName}` : 'Solicitud de reserva'
    const payload: Omit<PersistedEvent, 'id'> = {
      title,
      start: input.start,
      end: input.end,
      source: 'public',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      requesterPhone: input.requesterPhone,
      notes: input.notes,
    }

    const docRef = await eventsCollection(propertyId).add(payload)
    return { id: docRef.id, ...payload }
  }

  async update(propertyId: string, eventId: string, updates: UpdateEventInput): Promise<PersistedEvent> {
    const docRef = eventsCollection(propertyId).doc(eventId)
    const snapshot = await docRef.get()
    const existing = toPersisted(snapshot)
    if (!existing) {
      throw new Error('Evento no encontrado')
    }

    const nextStatus = updates.status ?? existing.status
    const nextCleaningStatus =
      updates.cleaningStatus ??
      (updates.status
        ? updates.status === 'confirmed'
          ? existing.cleaningStatus ?? 'pending'
          : undefined
        : existing.cleaningStatus)

    const updatedAt = new Date().toISOString()
    const payload: Record<string, unknown> = { updatedAt }
    if (updates.status !== undefined) {
      payload.status = nextStatus
    }
    if (updates.title !== undefined) {
      payload.title = updates.title
    }
    if (updates.start !== undefined) {
      payload.start = updates.start
    }
    if (updates.end !== undefined) {
      payload.end = updates.end
    }
    if (updates.description !== undefined) {
      const normalized = updates.description?.trim()
      if (normalized && normalized.length > 0) {
        payload.description = normalized
      } else {
        payload.description = FieldValue.delete()
      }
    }
    if (updates.location !== undefined) {
      const normalized = updates.location?.trim()
      if (normalized && normalized.length > 0) {
        payload.location = normalized
      } else {
        payload.location = FieldValue.delete()
      }
    }
    payload.cleaningStatus = nextCleaningStatus ?? FieldValue.delete()

    await docRef.set(payload, { merge: true })
    const merged: PersistedEvent = {
      ...existing,
      ...(updates.status !== undefined ? { status: nextStatus } : {}),
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.start !== undefined ? { start: updates.start } : {}),
      ...(updates.end !== undefined ? { end: updates.end } : {}),
      updatedAt,
    }
    if (updates.description !== undefined) {
      const normalized = updates.description?.trim()
      if (normalized) {
        merged.description = normalized
      } else {
        delete merged.description
      }
    }
    if (updates.location !== undefined) {
      const normalized = updates.location?.trim()
      if (normalized) {
        merged.location = normalized
      } else {
        delete merged.location
      }
    }
    if (nextCleaningStatus) {
      merged.cleaningStatus = nextCleaningStatus
    } else {
      delete merged.cleaningStatus
    }
    return merged
  }

  async updateStatus(
    propertyId: string,
    eventId: string,
    status: Exclude<EventStatus, 'tentative'>,
  ): Promise<PersistedEvent> {
    return this.update(propertyId, eventId, { status })
  }

  async delete(propertyId: string, eventId: string): Promise<void> {
    await eventsCollection(propertyId).doc(eventId).delete()
  }

  async replaceAirbnbEvents(
    propertyId: string,
    confirmed: AirbnbCalendarEvent[],
    tentative: AirbnbCalendarEvent[],
  ): Promise<void> {
    const collectionRef = eventsCollection(propertyId)
    const batch = collectionRef.firestore.batch()

    const existing = await collectionRef.where('source', '==', 'airbnb').get()
    const cleaningByExternalId = new Map<string, CleaningStatus>()
    existing.docs.forEach((doc) => {
      const data = doc.data() as Partial<PersistedEvent>
      if (typeof data.externalId === 'string' && (data.cleaningStatus === 'pending' || data.cleaningStatus === 'done')) {
        cleaningByExternalId.set(data.externalId, data.cleaningStatus)
      }
      batch.delete(doc.ref)
    })

    const now = new Date().toISOString()
    ;[...confirmed, ...tentative].forEach((event) => {
      const preservedCleaning = cleaningByExternalId.get(event.uid)
      const cleaningStatus = event.status === 'confirmed' ? preservedCleaning ?? 'pending' : undefined
      const docRef = collectionRef.doc()
      batch.set(docRef, {
        title: event.summary,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        source: 'airbnb',
        status: event.status,
        cleaningStatus,
        createdAt: now,
        updatedAt: now,
        externalId: event.uid,
        description: event.description,
        location: event.location,
      })
    })

    await batch.commit()
  }
}

export const eventRepository = new EventRepository()
