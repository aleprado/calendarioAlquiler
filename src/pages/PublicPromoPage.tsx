import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchPublicAvailability } from '../api/public'
import type { PublicAvailabilityDTO } from '../types'

const MAPS_EMBED_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY as string | undefined)?.trim() ?? ''
const INSTAGRAM_EMBED_SCRIPT_ID = 'instagram-embed-script'
const INSTAGRAM_EMBED_SCRIPT_SRC = 'https://www.instagram.com/embed.js'

type InstagramWindow = Window & {
  instgrm?: {
    Embeds?: {
      process: () => void
    }
  }
}

const buildSearchMapUrl = (query: string) =>
  `https://www.google.com/maps?hl=es&q=${encodeURIComponent(query)}&z=16&output=embed`

const normalizeHost = (hostname: string) => hostname.toLowerCase().replace(/^www\./, '')

const isLikelyUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const isGoogleMapsUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    const host = normalizeHost(parsed.hostname)
    return host === 'maps.app.goo.gl' || host === 'google.com' || host.endsWith('.google.com')
  } catch {
    return false
  }
}

const isInstagramUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    const host = normalizeHost(parsed.hostname)
    return host === 'instagram.com' || host.endsWith('.instagram.com')
  } catch {
    return false
  }
}

const buildInstagramEmbedPermalink = (value: string) => {
  if (!isInstagramUrl(value)) return null
  try {
    const parsed = new URL(value)
    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length < 2) return null
    const [contentType, contentId] = segments
    if (!contentId || !['p', 'reel', 'tv'].includes(contentType)) return null
    return `https://www.instagram.com/${contentType}/${contentId}/`
  } catch {
    return null
  }
}

const buildEmbedMapUrl = (data: PublicAvailabilityDTO) => {
  if (data.googleMapsPlaceId) {
    if (MAPS_EMBED_API_KEY) {
      return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(MAPS_EMBED_API_KEY)}&q=place_id:${encodeURIComponent(data.googleMapsPlaceId)}`
    }
    return buildSearchMapUrl(`place_id:${data.googleMapsPlaceId}`)
  }

  if (typeof data.googleMapsLat === 'number' && typeof data.googleMapsLng === 'number') {
    return buildSearchMapUrl(`${data.googleMapsLat},${data.googleMapsLng}`)
  }

  if (data.locationLabel && !isLikelyUrl(data.locationLabel)) return buildSearchMapUrl(data.locationLabel)

  return null
}

const buildReviewsUrl = (data: PublicAvailabilityDTO) => {
  if (data.googleMapsReviewsUrl) return data.googleMapsReviewsUrl
  if (data.googleMapsPlaceId) {
    return `https://search.google.com/local/reviews?placeid=${encodeURIComponent(data.googleMapsPlaceId)}`
  }
  if (data.googleMapsPinUrl && isGoogleMapsUrl(data.googleMapsPinUrl)) return data.googleMapsPinUrl
  return null
}

const getInstagramUsername = (instagramUrl: string | null) => {
  if (!instagramUrl) return null
  try {
    const url = new URL(instagramUrl)
    const firstSegment = url.pathname.split('/').filter(Boolean)[0]
    return firstSegment || null
  } catch {
    return null
  }
}

export const PublicPromoPage = () => {
  const { publicSlug = '' } = useParams()
  const [data, setData] = useState<PublicAvailabilityDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0)
  const [hiddenImageUrls, setHiddenImageUrls] = useState<string[]>([])

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!publicSlug) return
      setIsLoading(true)
      setError(null)
      try {
        const payload = await fetchPublicAvailability(publicSlug)
        if (!mounted) return
        setData(payload)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'No se pudo cargar la propiedad.')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void run()
    return () => {
      mounted = false
    }
  }, [publicSlug])

  useEffect(() => {
    setActiveGalleryIndex(0)
    setHiddenImageUrls([])
  }, [data?.galleryImageUrls])

  const mapEmbedUrl = useMemo(() => (data ? buildEmbedMapUrl(data) : null), [data])
  const reviewsUrl = useMemo(() => (data ? buildReviewsUrl(data) : null), [data])
  const images = useMemo(
    () => (data?.galleryImageUrls ?? []).filter((url) => !hiddenImageUrls.includes(url)),
    [data?.galleryImageUrls, hiddenImageUrls],
  )
  const instagramEmbedPermalinks = useMemo(
    () =>
      (data?.instagramPostUrls ?? [])
        .map((url) => buildInstagramEmbedPermalink(url))
        .filter((url): url is string => Boolean(url))
        .slice(0, 3),
    [data?.instagramPostUrls],
  )
  const coverImage = images[0] ?? null
  const activeGalleryImage = images[activeGalleryIndex] ?? null
  const instagramUsername = getInstagramUsername(data?.instagramUrl ?? null)

  useEffect(() => {
    if (instagramEmbedPermalinks.length === 0) return
    const instagramWindow = window as InstagramWindow
    const processEmbeds = () => {
      instagramWindow.instgrm?.Embeds?.process()
    }

    const existingScript = document.getElementById(INSTAGRAM_EMBED_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      if (instagramWindow.instgrm?.Embeds?.process) {
        processEmbeds()
        return
      }
      existingScript.addEventListener('load', processEmbeds, { once: true })
      return () => existingScript.removeEventListener('load', processEmbeds)
    }

    const script = document.createElement('script')
    script.id = INSTAGRAM_EMBED_SCRIPT_ID
    script.async = true
    script.src = INSTAGRAM_EMBED_SCRIPT_SRC
    script.addEventListener('load', processEmbeds, { once: true })
    document.body.appendChild(script)
    return () => script.removeEventListener('load', processEmbeds)
  }, [instagramEmbedPermalinks])

  useEffect(() => {
    if (!data || images.length < 2) return
    const timer = window.setInterval(() => {
      setActiveGalleryIndex((current) => (current + 1) % images.length)
    }, 5500)

    return () => window.clearInterval(timer)
  }, [data, images.length])

  useEffect(() => {
    if (images.length === 0) {
      if (activeGalleryIndex !== 0) {
        setActiveGalleryIndex(0)
      }
      return
    }

    if (activeGalleryIndex >= images.length) {
      setActiveGalleryIndex(0)
    }
  }, [activeGalleryIndex, images.length])

  const markImageAsHidden = (url: string) => {
    setHiddenImageUrls((previous) => (previous.includes(url) ? previous : [...previous, url]))
  }

  return (
    <div className="public-promo-layout">
      {isLoading ? (
        <div className="loading">Cargando propiedad...</div>
      ) : error ? (
        <div className="alert" role="alert">
          <span>{error}</span>
        </div>
      ) : data ? (
        <>
          <header className="promo-hero promo-hero--brochure">
            <div className="promo-hero__media promo-hero__media--brochure">
              {coverImage ? (
                <img
                  src={coverImage}
                  alt={`Imagen principal de ${data.propertyName}`}
                  onError={() => {
                    markImageAsHidden(coverImage)
                  }}
                />
              ) : (
                <div className="promo-hero__placeholder">
                  Carga fotos en gestión para que esta portada se vea como un folleto visual.
                </div>
              )}
              <div className="promo-hero__media-overlay" />
            </div>

            <div className="promo-hero__content promo-hero__content--brochure">
              <p className="promo-label">Estadia vacacional</p>
              <h1>{data.propertyName}</h1>
              <p className="promo-hero__description">
                {data.description ?? 'Alojamiento pensado para descansar, disfrutar la zona y reservar directo desde esta misma página.'}
              </p>

              <div className="promo-hero__actions">
                <Link className="primary" to={`/public/${data.publicSlug}/calendario`}>
                  Ver disponibilidad
                </Link>
                {data.googlePhotosUrl && (
                  <a className="secondary" href={data.googlePhotosUrl} target="_blank" rel="noopener noreferrer">
                    Abrir album
                  </a>
                )}
              </div>

              <div className="promo-meta-grid">
                <div className="promo-meta-card">
                  <h3>Ubicación</h3>
                  <p>{data.locationLabel ?? 'Configura la ubicación desde gestión para mostrar el pin exacto.'}</p>
                </div>
                <div className="promo-meta-card">
                  <h3>Google Fotos</h3>
                  <p>{data.googlePhotosUrl ? 'Album conectado para compartir fotos.' : 'No hay álbum conectado aún.'}</p>
                </div>
                <div className="promo-meta-card">
                  <h3>Instagram</h3>
                  <p>{instagramUsername ? `Perfil @${instagramUsername}` : 'No hay perfil configurado aún.'}</p>
                </div>
              </div>
            </div>
          </header>

          <section className="promo-section">
            <div className="promo-section__header">
              <h2>Galeria</h2>
              {images.length > 0 && (
                <p>
                  {activeGalleryIndex + 1} / {images.length}
                </p>
              )}
            </div>
            {images.length > 0 ? (
              <div className="promo-carousel">
                <div className="promo-carousel__main">
                  <img
                    src={activeGalleryImage ?? ''}
                    alt={`Foto ${activeGalleryIndex + 1} de ${data.propertyName}`}
                    onError={() => {
                      if (activeGalleryImage) {
                        markImageAsHidden(activeGalleryImage)
                      }
                    }}
                  />
                  {images.length > 1 && (
                    <div className="promo-carousel__controls">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setActiveGalleryIndex((current) => (current - 1 + images.length) % images.length)}
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setActiveGalleryIndex((current) => (current + 1) % images.length)}
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="promo-carousel__thumbs">
                    {images.map((url, index) => (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        className={`promo-carousel__thumb${index === activeGalleryIndex ? ' promo-carousel__thumb--active' : ''}`}
                        onClick={() => setActiveGalleryIndex(index)}
                      >
                        <img
                          src={url}
                          alt={`Miniatura ${index + 1}`}
                          onError={() => {
                            markImageAsHidden(url)
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="promo-empty">
                <p>No hay imágenes de galería cargadas.</p>
                {data.googlePhotosUrl && (
                  <>
                    <p>
                      En gestión puedes usar “Importar fotos del álbum” para copiar imágenes desde Google Fotos a esta galería.
                    </p>
                    <a href={data.googlePhotosUrl} target="_blank" rel="noopener noreferrer">
                      Abrir álbum de Google Fotos
                    </a>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="promo-section">
            <div className="promo-section__header">
              <h2>Ubicacion</h2>
              {data.locationLabel && <p>{data.locationLabel}</p>}
            </div>
            {mapEmbedUrl ? (
              <div className="promo-map-frame">
                <iframe
                  title={`Mapa de ${data.propertyName}`}
                  src={mapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : (
              <div className="promo-empty">
                <p>No hay datos de ubicación suficientes para mostrar el mapa.</p>
                <p>Pega el link del pin en gestión y usa “Detectar pin automáticamente”.</p>
              </div>
            )}

            {data.googleMapsPinUrl && (
              <a className="secondary" href={data.googleMapsPinUrl} target="_blank" rel="noopener noreferrer">
                Abrir ubicación en Google Maps
              </a>
            )}

            {data.showGoogleReviews && reviewsUrl && (
              <a className="secondary" href={reviewsUrl} target="_blank" rel="noopener noreferrer">
                Ver reseñas en Google Maps
              </a>
            )}
          </section>

          <section className="promo-section">
            <div className="promo-section__header">
              <h2>Instagram</h2>
            </div>
            {instagramEmbedPermalinks.length > 0 ? (
              <div className="instagram-preview-grid">
                {instagramEmbedPermalinks.map((permalink, index) => (
                  <article key={`${permalink}-${index}`} className="instagram-preview-card">
                    <blockquote
                      className="instagram-media"
                      data-instgrm-captioned=""
                      data-instgrm-permalink={`${permalink}?utm_source=ig_embed&utm_campaign=loading`}
                      data-instgrm-version="14"
                    >
                      <a href={permalink} target="_blank" rel="noopener noreferrer">
                        Ver publicación {index + 1}
                      </a>
                    </blockquote>
                    <a className="secondary" href={permalink} target="_blank" rel="noopener noreferrer">
                      Abrir en Instagram
                    </a>
                  </article>
                ))}
              </div>
            ) : data.instagramUrl ? (
              <div className="promo-empty">
                <p>
                  Carga links directos de posts o reels en gestión para mostrarlos embebidos aquí.
                </p>
                <a href={data.instagramUrl} target="_blank" rel="noopener noreferrer">
                  Abrir perfil de Instagram
                </a>
              </div>
            ) : (
              <div className="promo-empty">No hay cuenta de Instagram configurada.</div>
            )}
          </section>

          <footer className="promo-footer">
            <Link className="primary" to={`/public/${data.publicSlug}/calendario`}>
              Revisar disponibilidad
            </Link>
          </footer>
        </>
      ) : null}
    </div>
  )
}
