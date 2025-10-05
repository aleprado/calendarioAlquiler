import { Firestore } from '@google-cloud/firestore'
import type { AirbnbCalendarEvent } from './types'

const firestore = new Firestore()

export interface PersistedEvent {
  id: string
  title: string
  start: string
  end: string
  source: 'manual' | 'airbnb'
  status: 'confirmed' | 'tentative'
  createdAt: string
  updatedAt: string
  externalId?: string
  description?: string
  location?: string
}

interface CreateEventInput {
  title: string
  start: string
  end: string
  description?: string
  location?: string
}

const eventsCollection = (propertyId: string) =>
  firestore.collection('properties').doc(propertyId).collection('events')

export const listEvents = async (propertyId: string): Promise<PersistedEvent[]> => {
  const snapshot = await eventsCollection(propertyId).orderBy('start').get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<PersistedEvent, 'id'>) }))
}

export const createManualEvent = async (propertyId: string, input: CreateEventInput) => {
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

export const deleteEvent = async (propertyId: string, eventId: string) => {
  await eventsCollection(propertyId).doc(eventId).delete()
}

export const replaceAirbnbEvents = async (
  propertyId: string,
  confirmed: AirbnbCalendarEvent[],
  tentative: AirbnbCalendarEvent[],
) => {
  const collectionRef = eventsCollection(propertyId)
  const batch = firestore.batch()

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
