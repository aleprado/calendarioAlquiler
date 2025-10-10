import type { AirbnbCalendarEvent } from '../types'
import { eventsCollection } from '../firestore'

export type EventSource = 'manual' | 'airbnb' | 'public'
export type EventStatus = 'pending' | 'confirmed' | 'tentative' | 'declined'

export interface PersistedEvent {
  id: string
  title: string
  start: string
  end: string
  source: EventSource
  status: EventStatus
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

  async updateStatus(
    propertyId: string,
    eventId: string,
    status: Exclude<EventStatus, 'tentative'>,
  ): Promise<PersistedEvent> {
    const docRef = eventsCollection(propertyId).doc(eventId)
    const snapshot = await docRef.get()
    const existing = toPersisted(snapshot)
    if (!existing) {
      throw new Error('Evento no encontrado')
    }

    const payload: Partial<PersistedEvent> = {
      status,
      updatedAt: new Date().toISOString(),
    }

    await docRef.set(payload, { merge: true })
    return { ...existing, ...payload }
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
    existing.docs.forEach((doc) => batch.delete(doc.ref))

    const now = new Date().toISOString()
    ;[...confirmed, ...tentative].forEach((event) => {
      const docRef = collectionRef.doc()
      batch.set(docRef, {
        title: event.summary,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        source: 'airbnb',
        status: event.status,
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
