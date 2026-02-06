import { format } from 'date-fns'
import { downloadIcs, parseAirbnbIcs } from '../airbnb'
import type { AirbnbCalendarEvent } from '../types'
import {
  eventRepository,
  type CreateManualEventInput,
  type CreatePublicRequestInput,
  type EventStatus,
  type PersistedEvent,
} from '../repositories/eventRepository'
import { sendReservationRequestEmail } from './emailService'
import { propertyService } from './propertyService'
import { getEmailsForUserIds } from './userService'
import { ServiceError } from '../utils/errors'

const blockingStatuses: EventStatus[] = ['confirmed', 'pending', 'tentative']

const parseIsoRange = (startIso: string, endIso: string) => {
  const start = new Date(startIso)
  const end = new Date(endIso)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ServiceError('Las fechas proporcionadas no son válidas')
  }

  if (end <= start) {
    throw new ServiceError('La fecha de fin debe ser posterior a la fecha de inicio')
  }

  return { start, end }
}

const rangesOverlap = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) => a.start < b.end && a.end > b.start

const eventRange = (event: PersistedEvent) => ({
  start: new Date(event.start),
  end: new Date(event.end),
})

const sanitizePublicEvent = (event: PersistedEvent) => {
  if (event.status === 'declined') {
    return null
  }
  const status = event.status === 'pending' ? 'pending' : 'blocked'
  return {
    start: event.start,
    end: event.end,
    status,
  }
}

export interface PublicAvailabilityPayload {
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
  events: { start: string; end: string; status: string }[]
}

export interface PublicRequestResult {
  event: PersistedEvent
  notificationSent: boolean
}

export class EventService {
  async listForUser(userId: string, propertyId: string): Promise<PersistedEvent[]> {
    await propertyService.getOwnedProperty(userId, propertyId)
    return await eventRepository.list(propertyId)
  }

  async createManualEvent(userId: string, propertyId: string, payload: CreateManualEventInput) {
    await propertyService.getOwnedProperty(userId, propertyId)
    return await eventRepository.createManual(propertyId, payload)
  }

  async deleteEvent(userId: string, propertyId: string, eventId: string) {
    await propertyService.getOwnedProperty(userId, propertyId)
    await eventRepository.delete(propertyId, eventId)
  }

  async updateEventStatus(
    userId: string,
    propertyId: string,
    eventId: string,
    status: Exclude<EventStatus, 'tentative'>,
  ) {
    await propertyService.getOwnedProperty(userId, propertyId)
    return await eventRepository.updateStatus(propertyId, eventId, status)
  }

  private async ensureAvailability(propertyId: string, startIso: string, endIso: string) {
    const requestedRange = parseIsoRange(startIso, endIso)
    const events = await eventRepository.list(propertyId)

    const conflict = events.find((event) => {
      if (!blockingStatuses.includes(event.status)) {
        return false
      }
      const range = eventRange(event)
      return rangesOverlap(range, requestedRange)
    })

    if (conflict) {
      throw new ServiceError('Las fechas seleccionadas ya están ocupadas.', 409)
    }
  }

  async createPublicRequest(publicSlug: string, payload: CreatePublicRequestInput): Promise<PublicRequestResult> {
    const property = await propertyService.findByPublicSlug(publicSlug)
    if (!property) {
      throw new ServiceError('La propiedad no existe.', 404)
    }

    const requestedRange = parseIsoRange(payload.start, payload.end)
    await this.ensureAvailability(property.id, payload.start, payload.end)

    const event = await eventRepository.createPublicRequest(property.id, payload)

    const memberEmails = await getEmailsForUserIds(property.memberIds ?? [])
    const recipients = [...memberEmails]
    if (payload.requesterEmail) {
      recipients.push(payload.requesterEmail)
    }

    const formattedStart = format(requestedRange.start, 'dd/MM/yyyy')
    const formattedEnd = format(requestedRange.end, 'dd/MM/yyyy')
    const notificationSent = await sendReservationRequestEmail({
      to: recipients,
      propertyName: property.name,
      requesterName: payload.requesterName,
      requesterEmail: payload.requesterEmail,
      requesterPhone: payload.requesterPhone,
      start: formattedStart,
      end: formattedEnd,
    })

    return { event, notificationSent }
  }

  async getPublicAvailability(publicSlug: string): Promise<PublicAvailabilityPayload | null> {
    const property = await propertyService.findByPublicSlug(publicSlug)
    if (!property) {
      return null
    }

    const events = await eventRepository.list(property.id)
    const sanitized = events.map(sanitizePublicEvent).filter(Boolean) as {
      start: string
      end: string
      status: string
    }[]

    return {
      propertyId: property.id,
      propertyName: property.name,
      publicSlug: property.publicSlug,
      instagramUrl: property.instagramUrl ?? null,
      googlePhotosUrl: property.googlePhotosUrl ?? null,
      description: property.description ?? null,
      locationLabel: property.locationLabel ?? null,
      googleMapsPinUrl: property.googleMapsPinUrl ?? null,
      googleMapsPlaceId: property.googleMapsPlaceId ?? null,
      googleMapsLat: property.googleMapsLat ?? null,
      googleMapsLng: property.googleMapsLng ?? null,
      showGoogleReviews: property.showGoogleReviews === true,
      googleMapsReviewsUrl: property.googleMapsReviewsUrl ?? null,
      galleryImageUrls: property.galleryImageUrls ?? [],
      instagramPostUrls: property.instagramPostUrls ?? [],
      events: sanitized,
    }
  }

  async syncAirbnb(userId: string, propertyId: string, includeTentative = false, overrideUrl?: string): Promise<{
    propertyId: string
    totalEvents: number
    confirmedEvents: AirbnbCalendarEvent[]
    tentativeEvents: AirbnbCalendarEvent[]
  }> {
    const property = await propertyService.getOwnedProperty(userId, propertyId)

    const icalUrl = overrideUrl ?? property.airbnbIcalUrl
    if (!icalUrl) {
      throw new ServiceError('La propiedad no tiene configurado un enlace de iCal de Airbnb.')
    }

    const icsRaw = await downloadIcs(icalUrl)
    const { confirmed, tentative } = parseAirbnbIcs(icsRaw, includeTentative)

    await eventRepository.replaceAirbnbEvents(propertyId, confirmed, includeTentative ? tentative : [])

    return {
      propertyId,
      totalEvents: confirmed.length + (includeTentative ? tentative.length : 0),
      confirmedEvents: confirmed,
      tentativeEvents: includeTentative ? tentative : [],
    }
  }
}

export const eventService = new EventService()
