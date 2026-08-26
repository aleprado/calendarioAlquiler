import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchPublicAvailability } from '../api/public'
import type { PublicAvailabilityDTO } from '../types'
import { CotizadorWidget } from '../components/CotizadorWidget'

const MAPS_EMBED_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY as string | undefined)?.trim() ?? ''

const buildSearchMapUrl = (query: string) =>
  `https://www.google.com/maps?hl=es&q=${encodeURIComponent(query)}&z=16&output=embed`

const isLikelyUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const extractMapQueryFromPinUrl = (value: string) => {
  if (!isLikelyUrl(value)) return null
  try {
    const parsed = new URL(value)
    const query = parsed.searchParams.get('q') ?? parsed.searchParams.get('query') ?? ''
    if (query.trim()) return query.trim()

    const coordsInPath = parsed.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    if (coordsInPath?.[1] && coordsInPath[2]) {
      return `${coordsInPath[1]},${coordsInPath[2]}`
    }

    const placePath = parsed.pathname.match(/\/place\/([^/]+)/)
    if (placePath?.[1]) {
      return decodeURIComponent(placePath[1]).replace(/\+/g, ' ').trim()
    }
  } catch {
    return null
  }
  return null
}

const buildEmbedMapUrl = (data: PublicAvailabilityDTO) => {
  if (MAPS_EMBED_API_KEY && data.googleMapsPlaceId) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(MAPS_EMBED_API_KEY)}&q=place_id:${encodeURIComponent(data.googleMapsPlaceId)}`
  }

  if (typeof data.googleMapsLat === 'number' && typeof data.googleMapsLng === 'number') {
    return buildSearchMapUrl(`${data.googleMapsLat},${data.googleMapsLng}`)
  }

  if (data.locationLabel && !isLikelyUrl(data.locationLabel)) return buildSearchMapUrl(data.locationLabel)

  if (data.googleMapsPinUrl) {
    const queryFromPin = extractMapQueryFromPinUrl(data.googleMapsPinUrl)
    if (queryFromPin) return buildSearchMapUrl(queryFromPin)
  }

  if (data.googleMapsPlaceId) {
    return buildSearchMapUrl(data.googleMapsPlaceId)
  }

  return null
}

const getInstagramUsername = (instagramUrl: string | null) => {
  if (!instagramUrl) return null
  try {
    const url = new URL(instagramUrl)
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length === 0) return null
    // Avoid returning 'p', 'reel', 'stories', etc. if full url was pasted
    if (['p', 'reel', 'stories', 'tv'].includes(segments[0])) {
      return null
    }
    return segments[0]
  } catch {
    return null
  }
}

const GALLERY_PAGE_SIZE = 8

export const PublicPromoPage = () => {
  const { publicSlug = '' } = useParams()
  const [data, setData] = useState<PublicAvailabilityDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [galleryPage, setGalleryPage] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
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
    setGalleryPage(0)
    setHiddenImageUrls([])
  }, [data?.galleryImageUrls])

  const mapEmbedUrl = useMemo(() => (data ? buildEmbedMapUrl(data) : null), [data])
  const images = useMemo(
    () => (data?.galleryImageUrls ?? []).filter((url) => !hiddenImageUrls.includes(url)),
    [data?.galleryImageUrls, hiddenImageUrls],
  )

  const coverImage = useMemo(() => {
    if (data?.coverImageUrl && !hiddenImageUrls.includes(data.coverImageUrl)) {
      return data.coverImageUrl
    }
    return images[0] ?? null
  }, [data?.coverImageUrl, hiddenImageUrls, images])
  const instagramUsername = getInstagramUsername(data?.instagramUrl ?? null)

  const totalGalleryPages = Math.ceil(images.length / GALLERY_PAGE_SIZE)
  const paginatedImages = useMemo(() => {
    const start = galleryPage * GALLERY_PAGE_SIZE
    return images.slice(start, start + GALLERY_PAGE_SIZE)
  }, [images, galleryPage])

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
              <p className="promo-label">simplealquiler.net</p>
              <h1>{data.propertyName}</h1>
              <p className="promo-hero__lead">Hospedaje cerca del mar para desconectar y reservar directo con el anfitrion.</p>
              <p className="promo-hero__description">
                {data.description ?? 'Alojamiento pensado para descansar, disfrutar la zona y reservar directo desde esta misma página.'}
              </p>

              <div className="promo-hero__actions">
                <Link className="primary" to={`/public/${data.publicSlug}/calendario`}>
                  Ver calendario y disponibilidad
                </Link>
              </div>

              <div className="promo-meta-grid">
                <a className="promo-meta-card promo-meta-card--link" href="#seccion-ubicacion">
                  <h3>Ubicación</h3>
                  <p>{data.locationLabel ?? 'Configura la ubicación desde gestión para mostrar el pin exacto.'}</p>
                </a>
                <a className="promo-meta-card promo-meta-card--link" href="#seccion-galeria">
                  <h3>Galería de fotos</h3>
                  <p>{images.length > 0 ? `${images.length} fotos disponibles` : 'No hay fotos aún.'}</p>
                </a>
                <a className="promo-meta-card promo-meta-card--link" href="#seccion-instagram">
                  <h3>Instagram</h3>
                  <p>{instagramUsername ? `@${instagramUsername}` : 'Perfil de Instagram'}</p>
                </a>
              </div>
            </div>
          </header>

          {data.showQuoterPublic && (
            <section id="seccion-cotizador" className="promo-section">
              <CotizadorWidget
                mode="public"
                monthlyRatesUSD={data.quoterMonthlyRatesUSD}
                customExchangeRates={data.quoterCustomExchangeRates}
                blockedEvents={data.events}
              />
            </section>
          )}

          <section id="seccion-galeria" className="promo-section">
            <div className="promo-section__header">
              <h2>Galeria de fotos</h2>
              {images.length > 0 && (
                <p>
                  Mostrando {galleryPage * GALLERY_PAGE_SIZE + 1} - {Math.min((galleryPage + 1) * GALLERY_PAGE_SIZE, images.length)} de {images.length} fotos
                </p>
              )}
            </div>
            {images.length > 0 ? (
              <div className="gallery-paginated">
                <div className="gallery-grid">
                  {paginatedImages.map((url, localIdx) => {
                    const globalIdx = galleryPage * GALLERY_PAGE_SIZE + localIdx
                    return (
                      <button
                        key={`${url}-${globalIdx}`}
                        type="button"
                        className="gallery-grid__item"
                        onClick={() => setLightboxIndex(globalIdx)}
                      >
                        <img
                          src={url}
                          alt={`Foto ${globalIdx + 1} de ${data.propertyName}`}
                          onError={() => markImageAsHidden(url)}
                        />
                      </button>
                    )
                  })}
                </div>

                {totalGalleryPages > 1 && (
                  <div className="gallery-pagination">
                    <button
                      type="button"
                      className="secondary btn-sm"
                      disabled={galleryPage === 0}
                      onClick={() => setGalleryPage((p) => Math.max(0, p - 1))}
                    >
                      &laquo; Anterior
                    </button>
                    <span className="gallery-pagination__info">
                      Página {galleryPage + 1} de {totalGalleryPages}
                    </span>
                    <button
                      type="button"
                      className="secondary btn-sm"
                      disabled={galleryPage >= totalGalleryPages - 1}
                      onClick={() => setGalleryPage((p) => Math.min(totalGalleryPages - 1, p + 1))}
                    >
                      Siguiente &raquo;
                    </button>
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

          {/* Lightbox / Preview Modal for Gallery */}
          {lightboxIndex !== null && images[lightboxIndex] && (
            <div className="modal-backdrop" role="presentation" onClick={() => setLightboxIndex(null)}>
              <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="lightbox-close"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="Cerrar vista"
                >
                  &times;
                </button>
                <img
                  src={images[lightboxIndex]}
                  alt={`Foto ${lightboxIndex + 1}`}
                  className="lightbox-image"
                />
                <div className="lightbox-nav">
                  <button
                    type="button"
                    className="secondary btn-sm"
                    onClick={() => setLightboxIndex((idx) => (idx !== null ? (idx - 1 + images.length) % images.length : 0))}
                  >
                    Anterior
                  </button>
                  <span>{lightboxIndex + 1} / {images.length}</span>
                  <button
                    type="button"
                    className="secondary btn-sm"
                    onClick={() => setLightboxIndex((idx) => (idx !== null ? (idx + 1) % images.length : 0))}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          )}

          <section id="seccion-ubicacion" className="promo-section">
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
              <div className="promo-location-links">
                <a className="promo-location-link" href={data.googleMapsPinUrl} target="_blank" rel="noopener noreferrer">
                  Abrir ubicación en Google Maps
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            )}
          </section>

          <section id="seccion-instagram" className="promo-section">
            <div className="promo-section__header">
              <h2>Instagram</h2>
            </div>
            {data.instagramUrl ? (
              <div className="instagram-account-card">
                <div className="instagram-account-card__icon" aria-hidden="true">
                  <img src="/insta-logo.png" alt="Instagram" onError={(e) => { (e.target as HTMLElement).style.display = 'none' }} />
                </div>
                <div className="instagram-account-card__info">
                  <h3>{instagramUsername ? `@${instagramUsername}` : 'Visita nuestro Instagram'}</h3>
                  <p>Mira nuestras fotos, novedades y actualizaciones en nuestra cuenta oficial de Instagram.</p>
                </div>
                <a
                  className="primary instagram-account-card__btn"
                  href={data.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver en Instagram {instagramUsername ? `@${instagramUsername}` : ''}
                  <span aria-hidden="true">↗</span>
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
            <p className="public-powered-by">
              Creado con{' '}
              <a href="https://simplealquiler.net" target="_blank" rel="noopener noreferrer">
                simplealquiler.net
              </a>
            </p>
          </footer>
        </>
      ) : null}
    </div>
  )
}
