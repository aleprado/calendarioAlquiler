import axios from 'axios'
import { ServiceError } from '../utils/errors'

const MAP_LINK_TIMEOUT_MS = 12000
const MAP_LINK_USER_AGENT = 'CalendarioAlquilerMapResolver/1.0'

export interface ResolvedGoogleMapsLink {
  resolvedUrl: string
  googleMapsPlaceId: string | null
  googleMapsLat: number | null
  googleMapsLng: number | null
  locationLabel: string | null
}

const normalizeHost = (hostname: string) => hostname.toLowerCase().replace(/^www\./, '')

const isGoogleMapsHost = (url: URL) => {
  const host = normalizeHost(url.hostname)
  return host === 'maps.app.goo.gl' || host === 'goo.gl' || host === 'google.com' || host.endsWith('.google.com')
}

const toSafeNumber = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseCoordinatesFromQuery = (queryValue: string) => {
  const match = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(queryValue)
  if (!match) return null
  const lat = toSafeNumber(match[1])
  const lng = toSafeNumber(match[2])
  if (lat === null || lng === null) return null
  return { lat, lng }
}

const parseCoordinates = (url: URL, rawUrl: string) => {
  const pbCoords = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(rawUrl)
  if (pbCoords) {
    const lat = toSafeNumber(pbCoords[1])
    const lng = toSafeNumber(pbCoords[2])
    if (lat !== null && lng !== null) {
      return { lat, lng }
    }
  }

  const atCoords = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(rawUrl)
  if (atCoords) {
    const lat = toSafeNumber(atCoords[1])
    const lng = toSafeNumber(atCoords[2])
    if (lat !== null && lng !== null) {
      return { lat, lng }
    }
  }

  const query = url.searchParams.get('q') ?? url.searchParams.get('query') ?? ''
  return parseCoordinatesFromQuery(query)
}

const parsePlaceId = (url: URL) => {
  const direct = url.searchParams.get('query_place_id')
  if (direct?.trim()) return direct.trim()

  const query = url.searchParams.get('q') ?? url.searchParams.get('query') ?? ''
  const placeMatch = /^place_id:(.+)$/i.exec(query)
  if (!placeMatch) return null
  return placeMatch[1].trim() || null
}

const parseLocationLabel = (url: URL) => {
  const placeMatch = /\/place\/([^/]+)/i.exec(url.pathname)
  if (placeMatch?.[1]) {
    const decoded = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ').trim()
    if (decoded) return decoded
  }

  const query = url.searchParams.get('q') ?? url.searchParams.get('query') ?? ''
  if (query && !/^place_id:/i.test(query) && !parseCoordinatesFromQuery(query)) {
    return query.trim()
  }

  return null
}

const followRedirects = async (url: string) => {
  try {
    const response = await axios.get(url, {
      maxRedirects: 6,
      timeout: MAP_LINK_TIMEOUT_MS,
      responseType: 'text',
      headers: {
        'User-Agent': MAP_LINK_USER_AGENT,
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    })

    const redirected = (response.request as { res?: { responseUrl?: string } } | undefined)?.res?.responseUrl
    return redirected?.startsWith('http') ? redirected : url
  } catch {
    return url
  }
}

export class MapLinkService {
  async resolveGoogleMapsLink(rawUrl: string): Promise<ResolvedGoogleMapsLink> {
    const trimmed = rawUrl.trim()
    if (!trimmed) {
      throw new ServiceError('Necesitas enviar una URL de Google Maps.', 400)
    }

    let initialUrl: URL
    try {
      initialUrl = new URL(trimmed)
    } catch {
      throw new ServiceError('La URL de Google Maps no es válida.', 400)
    }

    if (!isGoogleMapsHost(initialUrl)) {
      throw new ServiceError('La URL debe ser de Google Maps.', 400)
    }

    const resolvedUrl = await followRedirects(trimmed)
    let finalUrl: URL
    try {
      finalUrl = new URL(resolvedUrl)
    } catch {
      finalUrl = initialUrl
    }

    const rawFinal = finalUrl.toString()
    const coordinates = parseCoordinates(finalUrl, rawFinal)

    return {
      resolvedUrl: rawFinal,
      googleMapsPlaceId: parsePlaceId(finalUrl),
      googleMapsLat: coordinates?.lat ?? null,
      googleMapsLng: coordinates?.lng ?? null,
      locationLabel: parseLocationLabel(finalUrl),
    }
  }
}

export const mapLinkService = new MapLinkService()
