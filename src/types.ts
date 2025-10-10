export type EventSource = 'manual' | 'airbnb' | 'public'

export type EventStatus = 'pending' | 'confirmed' | 'tentative' | 'declined'

export interface CalendarEventDTO {
  id: string
  title: string
  start: string
  end: string
  source: EventSource
  status: EventStatus
  description?: string
  location?: string
  requesterName?: string
  requesterEmail?: string
  requesterPhone?: string
  notes?: string
}

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  source: EventSource
  status: EventStatus
  description?: string
  location?: string
  requesterName?: string
  requesterEmail?: string
  requesterPhone?: string
  notes?: string
}

export interface NewEventPayload {
  title: string
  start: string
  end: string
  description?: string
  location?: string
}

export interface UpdateEventStatusPayload {
  status: Extract<EventStatus, 'pending' | 'confirmed' | 'declined'>
}

export interface PropertyDTO {
  id: string
  name: string
  airbnbIcalUrl: string
  publicSlug: string
  createdAt: string
  updatedAt: string
}

export interface NewPropertyPayload {
  name: string
  airbnbIcalUrl: string
}

export interface UpdatePropertyPayload {
  name?: string
  airbnbIcalUrl?: string
  regenerateSlug?: boolean
}

export interface PublicEventDTO {
  start: string
  end: string
  status: 'blocked' | 'pending'
}

export interface PublicAvailabilityDTO {
  propertyId: string
  propertyName: string
  publicSlug: string
  events: PublicEventDTO[]
}

export interface NewPublicRequestPayload {
  start: string
  end: string
  requesterName: string
  requesterEmail?: string
  requesterPhone?: string
  notes?: string
}

export interface SyncAirbnbPayload {
  icalUrl?: string
  includeTentative?: boolean
}
