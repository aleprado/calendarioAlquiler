import { Firestore } from '@google-cloud/firestore'

export const firestore = new Firestore({
  ignoreUndefinedProperties: true,
})

export const propertiesCollection = firestore.collection('properties')

export const propertyDocument = (propertyId: string) => propertiesCollection.doc(propertyId)

export const eventsCollection = (propertyId: string) => propertyDocument(propertyId).collection('events')
