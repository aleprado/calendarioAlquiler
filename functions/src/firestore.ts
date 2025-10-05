import * as admin from 'firebase-admin'

/**
 * Inicialización de Admin SDK (idempotente) y configuración para ignorar `undefined`.
 * Esto evita errores del tipo "Cannot use undefined as a Firestore value".
 */
if (admin.apps.length === 0) {
  admin.initializeApp()
  admin.firestore().settings({ ignoreUndefinedProperties: true })
}

export const db = admin.firestore()

export type PersistedEvent = {
  id: string
  title: string
  start: string
  end: string
  source?: 'airbnb' | 'manual'
  status?: 'confirmed' | 'tentative' | 'cancelled'
  description?: string
  location?: string
}

/** Remueve keys con valor `undefined` (acepta null y string vacío). */
const omitUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

const collectionForProperty = (propertyId: string) =>
  db.collection('properties').doc(propertyId).collection('events')

/** Lista todos los eventos de una propiedad (ordena por fecha de inicio si está disponible). */
export async function listEvents(propertyId: string): Promise<PersistedEvent[]> {
  const col = collectionForProperty(propertyId)
  const snap = await col.get()

  const items: PersistedEvent[] = []
  snap.forEach((doc) => {
    const data = doc.data() as any
    items.push({
      id: doc.id,
      title: data.title,
      start: data.start,
      end: data.end,
      source: data.source,
      status: data.status,
      description: data.description,
      location: data.location,
    })
  })

  return items.sort((a, b) => a.start.localeCompare(b.start))
}

/** Crea un evento manual (confirmed por defecto). Nunca guarda undefined. */
export async function createManualEvent(
  propertyId: string,
  data: {
    title: string
    start: string
    end: string
    description?: string
    location?: string
  },
): Promise<PersistedEvent> {
  const col = collectionForProperty(propertyId)
  const docRef = col.doc()

  const toSave = omitUndefined({
    title: data.title,
    start: data.start,
    end: data.end,
    source: 'manual' as const,
    status: 'confirmed' as const,
    description: data.description,
    location: data.location,
  })

  await docRef.set(toSave)

  return {
    id: docRef.id,
    ...(toSave as Omit<PersistedEvent, 'id'>),
  }
}

/** Elimina un evento por id. */
export async function deleteEvent(propertyId: string, eventId: string): Promise<void> {
  const col = collectionForProperty(propertyId)
  await col.doc(eventId).delete()
}

/**
 * Reemplaza los eventos de Airbnb:
 * - Borra todos los que tengan source=airbnb
 * - Inserta los nuevos (confirmed y, opcionalmente, tentative)
 * Nunca guarda undefined.
 */
export async function replaceAirbnbEvents(
  propertyId: string,
  confirmed: Array<{
    id?: string
    title: string
    start: string
    end: string
    description?: string
    location?: string
    status?: 'confirmed'
  }>,
  tentative: Array<{
    id?: string
    title: string
    start: string
    end: string
    description?: string
    location?: string
    status?: 'tentative'
  }> = [],
): Promise<void> {
  const col = collectionForProperty(propertyId)

  // 1) Borrar los anteriores de source=airbnb
  const prev = await col.where('source', '==', 'airbnb').get()
  const batch = db.batch()
  prev.forEach((doc) => batch.delete(doc.ref))

  // 2) Insertar nuevos (confirmed + tentative)
  const now = new Date().toISOString()

  const upsert = (e: any, status: 'confirmed' | 'tentative') => {
    const ref = col.doc(e.id ?? undefined) // si trae id, úsalo; si no, auto-ID
    const payload = omitUndefined({
      title: e.title,
      start: e.start,
      end: e.end,
      source: 'airbnb' as const,
      status,
      description: e.description,
      location: e.location,
      syncedAt: now,
    })
    batch.set(ref, payload, { merge: false })
  }

  confirmed.forEach((e) => upsert(e, 'confirmed'))
  tentative.forEach((e) => upsert(e, 'tentative'))

  await batch.commit()
}
