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

const buildEmbedMapUrl = (data: PublicAvailabilityDTO) => {
  if (data.googleMapsPlaceId) {
    return `https://www.google.com/maps?q=place_id:${encodeURIComponent(data.googleMapsPlaceId)}&hl=es&z=16&output=embed`
  }

  if (typeof data.googleMapsLat === 'number' && typeof data.googleMapsLng === 'number') {
    return `https://www.google.com/maps?q=${data.googleMapsLat},${data.googleMapsLng}&hl=es&z=16&output=embed`
  }

  if (data.googleMapsPinUrl) {
    return `https://www.google.com/maps?q=${encodeURIComponent(data.googleMapsPinUrl)}&hl=es&z=16&output=embed`
  }

  return null
}

const buildReviewsUrl = (data: PublicAvailabilityDTO) => {
  if (data.googleMapsReviewsUrl) return data.googleMapsReviewsUrl
  if (data.googleMapsPlaceId) {
    return `https://search.google.com/local/reviews?placeid=${encodeURIComponent(data.googleMapsPlaceId)}`
  }
  return data.googleMapsPinUrl
}

export const PublicPromoPage = () => {
  const { publicSlug = '' } = useParams()
  const [data, setData] = useState<PublicAvailabilityDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

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
  const images = data?.galleryImageUrls ?? []
  const activeImage = images[activeImageIndex] ?? null

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
          <header className="promo-hero">
            <div className="promo-hero__content">
              <p className="promo-label">Estadias vacacionales</p>
              <h1>{data.propertyName}</h1>
              <p>{data.description ?? 'Descansa en una propiedad pensada para viajes con ritmo tranquilo y buena ubicación.'}</p>
              <div className="promo-hero__actions">
                <Link className="primary" to={`/public/${data.publicSlug}/calendario`}>
                  Ver calendario y reservar
                </Link>
                {data.googlePhotosUrl && (
                  <a className="secondary" href={data.googlePhotosUrl} target="_blank" rel="noopener noreferrer">
                    Ver album en Google Fotos
                  </a>
                )}
              </div>
            </div>
            {activeImage ? (
              <div className="promo-hero__media">
                <img src={activeImage} alt={`Imagen de ${data.propertyName}`} />
              </div>
            ) : (
              <div className="promo-hero__placeholder">Agrega imagenes para mostrar tu propiedad</div>
            )}
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
                  <img src={activeImage ?? ''} alt={`Foto ${activeImageIndex + 1} de ${data.propertyName}`} />
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
                        <img src={url} alt={`Miniatura ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="promo-empty">
                <p>Todavia no hay imagenes cargadas para esta propiedad.</p>
                {data.googlePhotosUrl && (
                  <a href={data.googlePhotosUrl} target="_blank" rel="noopener noreferrer">
                    Ver album externo
                  </a>
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
              <div className="promo-empty">No hay pin de Google Maps configurado.</div>
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
                <p>Todavia no hay publicaciones destacadas cargadas.</p>
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
