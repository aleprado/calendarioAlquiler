export interface AirbnbCalendarEvent {
  uid: string
  summary: string
  description?: string
  start: Date
  end: Date
  status: 'confirmed' | 'cancelled' | 'tentative'
  lastModified?: Date
  location?: string
}

export interface SyncRequestPayload {
  propertyId: string
  icalUrl: string
  includeTentative?: boolean
}

export interface SyncResponse {
  propertyId: string
  fetchedAt: string
  totalEvents: number
  confirmedEvents: AirbnbCalendarEvent[]
  tentativeEvents: AirbnbCalendarEvent[]
}
