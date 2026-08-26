import { fetchImageUrls } from 'google-photos-album-image-url-fetch'
import { ServiceError } from '../utils/errors'

const MAX_IMAGES = 200
const VALID_HOSTS = new Set(['photos.app.goo.gl', 'photos.google.com'])

export interface ImportedGooglePhotosAlbum {
  sourceUrl: string
  images: string[]
}

const normalizeHost = (hostname: string) => hostname.toLowerCase().replace(/^www\./, '')

const stripGoogleImageSizeSuffix = (url: string) => url.replace(/=w\d+(?:-h\d+)?(?:-[a-z0-9]+)*$/i, '')

const toDisplayImageUrl = (url: string) => {
  const trimmed = url.trim()
  if (!trimmed.startsWith('https://')) {
    return null
  }
  const baseUrl = stripGoogleImageSizeSuffix(trimmed)
  return `${baseUrl}=w2000`
}

const validateGooglePhotosUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    throw new ServiceError('Necesitas enviar la URL del álbum de Google Fotos.', 400)
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new ServiceError('La URL del álbum no es válida.', 400)
  }

  const host = normalizeHost(parsed.hostname)
  if (!VALID_HOSTS.has(host)) {
    throw new ServiceError('La URL debe pertenecer a Google Fotos (photos.app.goo.gl o photos.google.com).', 400)
  }

  return parsed.toString()
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface CachedAlbumEntry {
  timestamp: number
  result: ImportedGooglePhotosAlbum
}

export class GooglePhotosService {
  private cache = new Map<string, CachedAlbumEntry>()

  async importAlbumImages(rawUrl: string, limit = MAX_IMAGES, skipCache = false): Promise<ImportedGooglePhotosAlbum> {
    const sourceUrl = validateGooglePhotosUrl(rawUrl)
    const normalizedLimit = Math.max(1, Math.min(MAX_IMAGES, Math.floor(limit)))

    if (!skipCache) {
      const cached = this.cache.get(sourceUrl)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.result
      }
    }

    let items: Awaited<ReturnType<typeof fetchImageUrls>>
    try {
      items = await fetchImageUrls(sourceUrl)
    } catch (error) {
      // If error occurs and we have a stale cache, return it instead of failing
      const cached = this.cache.get(sourceUrl)
      if (cached) {
        return cached.result
      }

      const message = error instanceof Error ? error.message : ''
      if (message.includes('404')) {
        throw new ServiceError('No se pudo abrir el álbum. Verifica que el link sea público.', 400)
      }
      throw new ServiceError('No se pudo leer el álbum de Google Fotos en este momento.', 502)
    }

    if (!Array.isArray(items) || items.length === 0) {
      const cached = this.cache.get(sourceUrl)
      if (cached) return cached.result

      throw new ServiceError(
        'No encontramos imágenes en ese álbum. Confirma que sea público y que tenga fotos visibles.',
        400,
      )
    }

    const imageUrls = Array.from(
      new Set(
        items
          .slice(0, normalizedLimit * 3)
          .map((item) => toDisplayImageUrl(item.url))
          .filter((url): url is string => typeof url === 'string'),
      ),
    ).slice(0, normalizedLimit)

    if (imageUrls.length === 0) {
      const cached = this.cache.get(sourceUrl)
      if (cached) return cached.result

      throw new ServiceError(
        'No logramos extraer URLs de imagen válidas desde el álbum. Prueba con otro link de Google Fotos.',
        400,
      )
    }

    const result: ImportedGooglePhotosAlbum = {
      sourceUrl,
      images: imageUrls,
    }

    this.cache.set(sourceUrl, {
      timestamp: Date.now(),
      result,
    })

    return result
  }
}

export const googlePhotosService = new GooglePhotosService()

