import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchPublicAvailability } from '../api/public'
import type { PublicAvailabilityDTO } from '../types'

declare global {
  interface Window {
    instgrm?: {
      Embeds?: {
        process: () => void
      }
    }
  }
}

const MAPS_EMBED_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY as string | undefined)?.trim() ?? ''

const buildSearchMapUrl = (query: string) =>
  `https://www.google.com/maps?hl=es&q=${encodeURIComponent(query)}&z=16&output=embed`

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

  if (data.locationLabel) return buildSearchMapUrl(data.locationLabel)

  return null
}

const buildReviewsUrl = (data: PublicAvailabilityDTO) => {
  if (data.googleMapsReviewsUrl) return data.googleMapsReviewsUrl
  if (data.googleMapsPlaceId) {
    return `https://search.google.com/local/reviews?placeid=${encodeURIComponent(data.googleMapsPlaceId)}`
  }
  return data.googleMapsPinUrl
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
  const [activeImageIndex, setActiveImageIndex] = useState(0)
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
    setActiveImageIndex(0)
    setHiddenImageUrls([])
  }, [data?.galleryImageUrls])

  useEffect(() => {
    if (!data || data.galleryImageUrls.length < 2) return
    const timer = window.setInterval(() => {
      setActiveImageIndex((current) => (current + 1) % data.galleryImageUrls.length)
    }, 5500)

    return () => window.clearInterval(timer)
  }, [data])

  useEffect(() => {
    if (!data || data.instagramPostUrls.length === 0) return

    const processEmbeds = () => window.instgrm?.Embeds?.process()
    const existingScript = document.getElementById('instagram-embed-script') as HTMLScriptElement | null
    if (existingScript) {
      processEmbeds()
      return
    }

    const script = document.createElement('script')
    script.id = 'instagram-embed-script'
    script.src = 'https://www.instagram.com/embed.js'
    script.async = true
    script.onload = processEmbeds
    document.body.appendChild(script)
  }, [data])

  const mapEmbedUrl = useMemo(() => (data ? buildEmbedMapUrl(data) : null), [data])
  const reviewsUrl = useMemo(() => (data ? buildReviewsUrl(data) : null), [data])
  const images = useMemo(
    () => (data?.galleryImageUrls ?? []).filter((url) => !hiddenImageUrls.includes(url)),
    [data?.galleryImageUrls, hiddenImageUrls],
  )
  const activeImage = images[activeImageIndex] ?? null
  const instagramUsername = getInstagramUsername(data?.instagramUrl ?? null)

  useEffect(() => {
    if (images.length === 0) {
      if (activeImageIndex !== 0) {
        setActiveImageIndex(0)
      }
      return
    }

    if (activeImageIndex >= images.length) {
      setActiveImageIndex(0)
    }
  }, [activeImageIndex, images.length])

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
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={`Imagen principal de ${data.propertyName}`}
                  onError={() => {
                    markImageAsHidden(activeImage)
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
                  {activeImageIndex + 1} / {images.length}
                </p>
              )}
            </div>
            {images.length > 0 ? (
              <div className="promo-carousel">
                <div className="promo-carousel__main">
                  <img
                    src={activeImage ?? ''}
                    alt={`Foto ${activeImageIndex + 1} de ${data.propertyName}`}
                    onError={() => {
                      if (activeImage) {
                        markImageAsHidden(activeImage)
                      }
                    }}
                  />
                  {images.length > 1 && (
                    <div className="promo-carousel__controls">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setActiveImageIndex((current) => (current - 1 + images.length) % images.length)}
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setActiveImageIndex((current) => (current + 1) % images.length)}
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
                        className={`promo-carousel__thumb${index === activeImageIndex ? ' promo-carousel__thumb--active' : ''}`}
                        onClick={() => setActiveImageIndex(index)}
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
              <div className="promo-reviews">
                <h3>Resenas de Google Maps</h3>
                <p>Conoce comentarios de otros viajeros antes de reservar.</p>
                <a className="secondary" href={reviewsUrl} target="_blank" rel="noopener noreferrer">
                  Ver resenas
                </a>
              </div>
            )}
          </section>

          <section className="promo-section">
            <div className="promo-section__header">
              <h2>Instagram</h2>
            </div>
            {data.instagramPostUrls.length > 0 ? (
              <div className="instagram-preview-grid">
                {data.instagramPostUrls.slice(0, 3).map((postUrl, index) => (
                  <blockquote
                    key={`${postUrl}-${index}`}
                    className="instagram-media"
                    data-instgrm-captioned=""
                    data-instgrm-permalink={postUrl}
                    data-instgrm-version="14"
                  >
                    <a href={postUrl} target="_blank" rel="noopener noreferrer">
                      Ver publicacion
                    </a>
                  </blockquote>
                ))}
              </div>
            ) : data.instagramUrl ? (
              <div className="promo-empty">
                <p>
                  Para mostrar publicaciones aquí, agrega links de posts en gestión. Las historias y el “feed reciente” requieren
                  integración avanzada con la API oficial de Instagram.
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
