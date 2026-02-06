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

export interface NewPropertyPayload {
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

export interface UpdatePropertyPayload {
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

export interface JoinPropertyPayload {
  code: string
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
