export interface CalendarEventDTO {
  id: string
  title: string
  start: string
  end: string
  source?: 'manual' | 'airbnb'
  status?: 'confirmed' | 'tentative'
}

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  source: 'manual' | 'airbnb'
  status: 'confirmed' | 'tentative'
}

export interface NewEventPayload {
  title: string
  start: string
  end: string
}

export interface SyncAirbnbPayload {
  propertyId?: string
  icalUrl: string
  includeTentative?: boolean
}
