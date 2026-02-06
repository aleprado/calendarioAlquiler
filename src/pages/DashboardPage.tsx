import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import {
  listProperties,
  createProperty,
  updateProperty,
  joinProperty,
  resolveGoogleMapsLink as resolveGoogleMapsLinkApi,
  importGooglePhotosAlbum as importGooglePhotosAlbumApi,
} from '../api/properties'
import type { PropertyDTO } from '../types'
import { PropertyWorkspace } from '../components/PropertyWorkspace'

const getPublicUrl = (property: PropertyDTO) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/public/${property.publicSlug}`
}

const getPublicCalendarUrl = (property: PropertyDTO) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/public/${property.publicSlug}/calendario`
}

const parseUrlList = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

const parseOptionalCoordinate = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const parseGoogleMapsPin = (pinUrl: string): { placeId?: string; lat?: string; lng?: string } => {
  const trimmed = pinUrl.trim()
  if (!trimmed) return {}
  try {
    const url = new URL(trimmed)
    const q = url.searchParams.get('q') ?? url.searchParams.get('query') ?? ''
    const placeId = url.searchParams.get('query_place_id') ?? (q.startsWith('place_id:') ? q.replace('place_id:', '') : '')

    const atCoords = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    if (atCoords) {
      return {
        placeId: placeId || undefined,
        lat: atCoords[1],
        lng: atCoords[2],
      }
    }

    const queryCoords = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
    if (queryCoords) {
      return {
        placeId: placeId || undefined,
        lat: queryCoords[1],
        lng: queryCoords[2],
      }
    }

    return {
      placeId: placeId || undefined,
    }
  } catch {
    return {}
  }
}

const INITIAL_FORM = {
  name: '',
  airbnbIcalUrl: '',
  instagramUrl: '',
  googlePhotosUrl: '',
  description: '',
  locationLabel: '',
  googleMapsPinUrl: '',
  googleMapsPlaceId: '',
  googleMapsLat: '',
  googleMapsLng: '',
  showGoogleReviews: false,
  googleMapsReviewsUrl: '',
  galleryImageUrls: '',
  instagramPostUrls: '',
}

export const DashboardPage = () => {
  const { user, signOut } = useAuth()
  const [properties, setProperties] = useState<PropertyDTO[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState(INITIAL_FORM)
  const [copyFeedback, setCopyFeedback] = useState<'link' | 'calendar' | 'code' | null>(null)
  const [isPropertyMenuOpen, setIsPropertyMenuOpen] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState(INITIAL_FORM)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [isResolvingMapLink, setIsResolvingMapLink] = useState(false)
  const [mapResolveFeedback, setMapResolveFeedback] = useState<string | null>(null)
  const [isImportingGooglePhotos, setIsImportingGooglePhotos] = useState(false)
  const [photosImportFeedback, setPhotosImportFeedback] = useState<string | null>(null)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const loadProperties = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listProperties()
      setProperties(data)
      setSelectedPropertyId((prev) => {
        if (data.length === 0) {
          return null
        }
        if (prev && data.some((property) => property.id === prev)) {
          return prev
        }
        return data[0].id
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las propiedades.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProperties()
  }, [loadProperties])

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  )

  useEffect(() => {
    if (selectedProperty) {
      setEditForm({
        name: selectedProperty.name,
        airbnbIcalUrl: selectedProperty.airbnbIcalUrl,
        instagramUrl: selectedProperty.instagramUrl ?? '',
        googlePhotosUrl: selectedProperty.googlePhotosUrl ?? '',
        description: selectedProperty.description ?? '',
        locationLabel: selectedProperty.locationLabel ?? '',
        googleMapsPinUrl: selectedProperty.googleMapsPinUrl ?? '',
        googleMapsPlaceId: selectedProperty.googleMapsPlaceId ?? '',
        googleMapsLat: selectedProperty.googleMapsLat !== null ? String(selectedProperty.googleMapsLat) : '',
        googleMapsLng: selectedProperty.googleMapsLng !== null ? String(selectedProperty.googleMapsLng) : '',
        showGoogleReviews: selectedProperty.showGoogleReviews === true,
        googleMapsReviewsUrl: selectedProperty.googleMapsReviewsUrl ?? '',
        galleryImageUrls: selectedProperty.galleryImageUrls.join('\n'),
        instagramPostUrls: selectedProperty.instagramPostUrls.join('\n'),
      })
      setEditError(null)
      setMapResolveFeedback(null)
      setPhotosImportFeedback(null)
    }
  }, [selectedProperty])

  const handleCreateProperty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsCreating(true)
    setError(null)
    try {
      const trimmedInstagramUrl = createForm.instagramUrl.trim()
      const trimmedGoogleUrl = createForm.googlePhotosUrl.trim()
      const payload = {
        name: createForm.name.trim(),
        airbnbIcalUrl: createForm.airbnbIcalUrl.trim(),
        ...(trimmedInstagramUrl ? { instagramUrl: trimmedInstagramUrl } : {}),
        ...(trimmedGoogleUrl ? { googlePhotosUrl: trimmedGoogleUrl } : {}),
      }
      const created = await createProperty(payload)
      setProperties((prev) => [...prev, created])
      setSelectedPropertyId(created.id)
      setCreateForm(INITIAL_FORM)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la propiedad.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopyPublicLink = async () => {
    if (!selectedProperty) return
    try {
      await navigator.clipboard.writeText(getPublicUrl(selectedProperty))
      setCopyFeedback('link')
      window.setTimeout(() => setCopyFeedback(null), 2000)
      setIsPropertyMenuOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo copiar el link. Copialo manualmente.')
    }
  }

  const handleCopyShareCode = async () => {
    if (!selectedProperty) return
    try {
      await navigator.clipboard.writeText(selectedProperty.shareCode)
      setCopyFeedback('code')
      window.setTimeout(() => setCopyFeedback(null), 2000)
      setIsPropertyMenuOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo copiar el código. Copialo manualmente.')
    }
  }

  const handleCopyCalendarLink = async () => {
    if (!selectedProperty) return
    try {
      await navigator.clipboard.writeText(getPublicCalendarUrl(selectedProperty))
      setCopyFeedback('calendar')
      window.setTimeout(() => setCopyFeedback(null), 2000)
      setIsPropertyMenuOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo copiar el link del calendario. Copialo manualmente.')
    }
  }

  const openJoinModal = () => {
    setJoinCode('')
    setJoinError(null)
    setIsJoinModalOpen(true)
  }

  const closeJoinModal = () => {
    if (isJoining) return
    setIsJoinModalOpen(false)
    setJoinError(null)
    setJoinCode('')
  }

  const handleJoinProperty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedCode = joinCode.trim()
    if (!normalizedCode) {
      setJoinError('Necesitas ingresar un código.')
      return
    }

    setIsJoining(true)
    setJoinError(null)
    try {
      const joined = await joinProperty({ code: normalizedCode })
      setProperties((prev) => {
        const exists = prev.some((property) => property.id === joined.id)
        if (exists) {
          return prev.map((property) => (property.id === joined.id ? joined : property))
        }
        return [...prev, joined]
      })
      setSelectedPropertyId(joined.id)
      setIsJoinModalOpen(false)
      setJoinCode('')
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'No se pudo unir la propiedad con ese código.')
    } finally {
      setIsJoining(false)
    }
  }

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProperty) return
    setIsSavingEdit(true)
    setEditError(null)
    try {
      const trimmedInstagramUrl = editForm.instagramUrl.trim()
      const trimmedGoogleUrl = editForm.googlePhotosUrl.trim()
      const trimmedDescription = editForm.description.trim()
      const trimmedLocationLabel = editForm.locationLabel.trim()
      const trimmedPinUrl = editForm.googleMapsPinUrl.trim()
      const trimmedPlaceId = editForm.googleMapsPlaceId.trim()
      const trimmedReviewsUrl = editForm.googleMapsReviewsUrl.trim()
      const updated = await updateProperty(selectedProperty.id, {
        name: editForm.name.trim(),
        airbnbIcalUrl: editForm.airbnbIcalUrl.trim(),
        instagramUrl: trimmedInstagramUrl ? trimmedInstagramUrl : null,
        googlePhotosUrl: trimmedGoogleUrl ? trimmedGoogleUrl : null,
        description: trimmedDescription ? trimmedDescription : null,
        locationLabel: trimmedLocationLabel ? trimmedLocationLabel : null,
        googleMapsPinUrl: trimmedPinUrl ? trimmedPinUrl : null,
        googleMapsPlaceId: trimmedPlaceId ? trimmedPlaceId : null,
        googleMapsLat: parseOptionalCoordinate(editForm.googleMapsLat),
        googleMapsLng: parseOptionalCoordinate(editForm.googleMapsLng),
        showGoogleReviews: editForm.showGoogleReviews,
        googleMapsReviewsUrl: trimmedReviewsUrl ? trimmedReviewsUrl : null,
        galleryImageUrls: parseUrlList(editForm.galleryImageUrls),
        instagramPostUrls: parseUrlList(editForm.instagramPostUrls),
      })
      setProperties((prev) => prev.map((property) => (property.id === updated.id ? updated : property)))
      setIsEditModalOpen(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'No se pudo actualizar la propiedad.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleResolveMapLink = async () => {
    const mapLink = editForm.googleMapsPinUrl.trim()
    if (!mapLink) {
      setEditError('Primero pega el enlace del pin de Google Maps.')
      return
    }

    setIsResolvingMapLink(true)
    setMapResolveFeedback(null)
    setEditError(null)
    try {
      const resolved = await resolveGoogleMapsLinkApi(mapLink)
      setEditForm((prev) => ({
        ...prev,
        googleMapsPinUrl: resolved.resolvedUrl || prev.googleMapsPinUrl,
        googleMapsPlaceId: resolved.googleMapsPlaceId ?? prev.googleMapsPlaceId,
        googleMapsLat: resolved.googleMapsLat !== null ? String(resolved.googleMapsLat) : prev.googleMapsLat,
        googleMapsLng: resolved.googleMapsLng !== null ? String(resolved.googleMapsLng) : prev.googleMapsLng,
        locationLabel: resolved.locationLabel ?? prev.locationLabel,
      }))
      setMapResolveFeedback('Pin detectado. Revisa los datos y guarda cambios.')
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'No se pudo resolver el link de Google Maps.')
    } finally {
      setIsResolvingMapLink(false)
    }
  }

  const handleImportGooglePhotos = async () => {
    const albumUrl = editForm.googlePhotosUrl.trim()
    if (!albumUrl) {
      setEditError('Primero pega el link del álbum de Google Fotos.')
      return
    }

    setIsImportingGooglePhotos(true)
    setPhotosImportFeedback(null)
    setEditError(null)
    try {
      const imported = await importGooglePhotosAlbumApi(albumUrl)
      const currentImages = parseUrlList(editForm.galleryImageUrls)
      const mergedImages = Array.from(new Set([...currentImages, ...imported.images]))
      const added = mergedImages.length - currentImages.length

      setEditForm((prev) => ({
        ...prev,
        galleryImageUrls: mergedImages.join('\n'),
      }))
      setPhotosImportFeedback(
        added > 0
          ? `Se importaron ${added} foto${added === 1 ? '' : 's'} del álbum.`
          : 'No se detectaron fotos nuevas para agregar.',
      )
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'No se pudieron importar imágenes desde Google Fotos.')
    } finally {
      setIsImportingGooglePhotos(false)
    }
  }

  const handleRegenerateLink = async () => {
    if (!selectedProperty) return
    setIsSavingEdit(true)
    setEditError(null)
    try {
      const updated = await updateProperty(selectedProperty.id, {
        regenerateSlug: true,
      })
      setProperties((prev) => prev.map((property) => (property.id === updated.id ? updated : property)))
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'No se pudo regenerar el link público.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const togglePropertyMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setIsPropertyMenuOpen((prev) => !prev)
  }

  useEffect(() => {
    const closeMenu = () => setIsPropertyMenuOpen(false)
    if (isPropertyMenuOpen) {
      window.addEventListener('click', closeMenu)
    }
    return () => {
      window.removeEventListener('click', closeMenu)
    }
  }, [isPropertyMenuOpen])

  return (
    <div className="dashboard-layout">
      <header className="dashboard-topbar">
        <div className="topbar-left">
          <button type="button" className="link-button topbar-info-link" onClick={() => setIsInfoOpen(true)}>
            Conoce la app
          </button>
        </div>
        <div className="topbar-right">
          <button type="button" className="link-button sign-out-button" onClick={() => void signOut()} aria-label="Cerrar sesión">
            <svg
              className="sign-out-button__icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15" />
              <path d="M18 12H9" />
              <path d="m15 9 3 3-3 3" />
            </svg>
            <span className="sign-out-button__label">Cerrar sesión</span>
          </button>
          <div className="user-info">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName ?? user.email ?? 'Usuario'} className="user-avatar" />
            ) : (
              <div className="user-avatar fallback">SA</div>
            )}
          </div>
          {selectedProperty && (
            <div className="property-switcher" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="secondary property-switcher__btn" onClick={togglePropertyMenu}>
                <span className="property-switcher__label">{selectedProperty.name}</span>
                <span className="property-switcher__chevron">▾</span>
              </button>
              {isPropertyMenuOpen && (
                <div className="property-menu">
                  <div className="property-menu__group">
                    {properties.map((property) => (
                      <button
                        key={property.id}
                        type="button"
                        className={`property-menu__item${property.id === selectedPropertyId ? ' property-menu__item--active' : ''}`}
                        onClick={() => {
                          setSelectedPropertyId(property.id)
                          setIsPropertyMenuOpen(false)
                        }}
                      >
                        {property.name}
                      </button>
                    ))}
                  </div>
                  <div className="property-menu__group property-menu__group--actions">
                    <button type="button" className="property-menu__item" onClick={handleCopyPublicLink}>
                      Copiar link público
                    </button>
                    <button type="button" className="property-menu__item" onClick={handleCopyCalendarLink}>
                      Copiar link de calendario
                    </button>
                    <button type="button" className="property-menu__item" onClick={handleCopyShareCode}>
                      Copiar código de acceso
                    </button>
                    <button
                      type="button"
                      className="property-menu__item"
                      onClick={() => {
                        setIsEditModalOpen(true)
                        setIsPropertyMenuOpen(false)
                      }}
                    >
                      Editar propiedad
                    </button>
                    <button
                      type="button"
                      className="property-menu__item"
                      onClick={() => {
                        setIsPropertyMenuOpen(false)
                        openJoinModal()
                      }}
                    >
                      Agregar propiedad con código
                    </button>
                  </div>
                  {copyFeedback && (
                    <div className="menu-hint">
                      {copyFeedback === 'link'
                        ? '¡Link público copiado!'
                        : copyFeedback === 'calendar'
                          ? '¡Link del calendario copiado!'
                          : '¡Código copiado!'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="dashboard-main">
        {error && (
          <div className="alert" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}>
              Cerrar
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading">Cargando tus propiedades...</div>
        ) : properties.length === 0 ? (
          <section className="card">
            <h2>Registra tu primera propiedad</h2>
            <p>Necesitamos el enlace iCal de Airbnb para mantener el calendario sincronizado.</p>
            <form className="property-form" onSubmit={handleCreateProperty}>
              <label htmlFor="property-name">Nombre</label>
              <input
                id="property-name"
                type="text"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ej. Casa del centro"
                required
              />
              <label htmlFor="property-ical">Enlace iCal de Airbnb</label>
              <input
                id="property-ical"
                type="url"
                value={createForm.airbnbIcalUrl}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, airbnbIcalUrl: event.target.value }))}
                placeholder="https://www.airbnb.com/calendar/ical/..."
                required
              />
              <label htmlFor="property-instagram-link">Instagram (URL opcional)</label>
              <input
                id="property-instagram-link"
                type="url"
                value={createForm.instagramUrl}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, instagramUrl: event.target.value }))}
                placeholder="https://instagram.com/tu_cuenta"
              />
              <label htmlFor="property-google-photos-link">Google Fotos (URL opcional)</label>
              <input
                id="property-google-photos-link"
                type="url"
                value={createForm.googlePhotosUrl}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, googlePhotosUrl: event.target.value }))}
                placeholder="https://photos.app.goo.gl/tu_album"
              />
              <button type="submit" className="primary" disabled={isCreating}>
                {isCreating ? 'Guardando...' : 'Guardar propiedad'}
              </button>
            </form>
            <button type="button" className="link-button" onClick={openJoinModal}>
              Tengo un código de acceso
            </button>
          </section>
        ) : (
          selectedProperty ? <PropertyWorkspace property={selectedProperty} /> : null
        )}
      </main>

      {isInfoOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--info" role="dialog" aria-modal="true" aria-labelledby="about-modal-title">
            <h2 id="about-modal-title">¿Qué es Simple Alquiler?</h2>
            <p>
              Gestionamos tus alojamientos turísticos desde un único panel: sincronización automática con Airbnb, bloqueos manuales y un enlace público para recibir reservas sin compartir tu panel privado.
            </p>
            <p>
              ¿Te interesa implementar Simple Alquiler? Escríbenos a{' '}
              <a href="mailto:hola@simplealquiler.net">hola@simplealquiler.net</a> o contáctanos por{' '}
              <a href="https://wa.me/5491144444444" target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              .
            </p>
            <button type="button" className="primary" onClick={() => setIsInfoOpen(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedProperty && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-property-title">
            <h2 id="edit-property-title">Editar propiedad</h2>
            <form className="modal-form" onSubmit={handleSaveEdit}>
              <label htmlFor="edit-name">Nombre</label>
              <input
                id="edit-name"
                type="text"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
              <label htmlFor="edit-ical">Enlace iCal de Airbnb</label>
              <input
                id="edit-ical"
                type="url"
                value={editForm.airbnbIcalUrl}
                onChange={(event) => setEditForm((prev) => ({ ...prev, airbnbIcalUrl: event.target.value }))}
                required
              />
              <label htmlFor="edit-instagram-link">Instagram (URL opcional)</label>
              <input
                id="edit-instagram-link"
                type="url"
                value={editForm.instagramUrl}
                onChange={(event) => setEditForm((prev) => ({ ...prev, instagramUrl: event.target.value }))}
                placeholder="https://instagram.com/tu_cuenta"
              />
              <label htmlFor="edit-google-photos-link">Google Fotos (URL opcional)</label>
              <input
                id="edit-google-photos-link"
                type="url"
                value={editForm.googlePhotosUrl}
                onChange={(event) => {
                  setEditForm((prev) => ({ ...prev, googlePhotosUrl: event.target.value }))
                  setPhotosImportFeedback(null)
                }}
                placeholder="https://photos.app.goo.gl/tu_album"
              />
              <div className="map-link-tools">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void handleImportGooglePhotos()}
                  disabled={isImportingGooglePhotos}
                >
                  {isImportingGooglePhotos ? 'Importando fotos...' : 'Importar fotos del álbum'}
                </button>
                <p className="field-hint">
                  No subimos archivos a storage: se agregan URLs públicas del álbum para usarlas en la galería.
                </p>
                {photosImportFeedback && <p className="field-hint field-hint--ok">{photosImportFeedback}</p>}
              </div>
              <label htmlFor="edit-description">Descripción para la página pública</label>
              <textarea
                id="edit-description"
                value={editForm.description}
                onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Describe la experiencia de hospedaje, capacidad, estilo y puntos fuertes."
                rows={4}
              />
              <label htmlFor="edit-location-label">Ubicación visible (texto)</label>
              <input
                id="edit-location-label"
                type="text"
                value={editForm.locationLabel}
                onChange={(event) => setEditForm((prev) => ({ ...prev, locationLabel: event.target.value }))}
                placeholder="Ej. Playa del Carmen, Quintana Roo"
              />
              <label htmlFor="edit-maps-pin">Pin de Google Maps (URL)</label>
              <input
                id="edit-maps-pin"
                type="url"
                value={editForm.googleMapsPinUrl}
                onChange={(event) => {
                  const value = event.target.value
                  const parsed = parseGoogleMapsPin(value)
                  setEditForm((prev) => ({
                    ...prev,
                    googleMapsPinUrl: value,
                    googleMapsPlaceId: parsed.placeId ?? prev.googleMapsPlaceId,
                    googleMapsLat: parsed.lat ?? prev.googleMapsLat,
                    googleMapsLng: parsed.lng ?? prev.googleMapsLng,
                  }))
                  setMapResolveFeedback(null)
                }}
                placeholder="https://maps.google.com/..."
              />
              <div className="map-link-tools">
                <button type="button" className="secondary" onClick={() => void handleResolveMapLink()} disabled={isResolvingMapLink}>
                  {isResolvingMapLink ? 'Procesando link...' : 'Detectar pin automáticamente'}
                </button>
                <p className="field-hint">
                  Acepta links cortos de Google Maps (`maps.app.goo.gl`) y completa coordenadas/placeId para evitar errores de mapa en
                  la web pública.
                </p>
                {mapResolveFeedback && <p className="field-hint field-hint--ok">{mapResolveFeedback}</p>}
              </div>
              <label htmlFor="edit-maps-place-id">Google Place ID (opcional)</label>
              <input
                id="edit-maps-place-id"
                type="text"
                value={editForm.googleMapsPlaceId}
                onChange={(event) => setEditForm((prev) => ({ ...prev, googleMapsPlaceId: event.target.value }))}
                placeholder="ChIJ..."
              />
              <div className="coordinate-row">
                <div>
                  <label htmlFor="edit-maps-lat">Latitud</label>
                  <input
                    id="edit-maps-lat"
                    type="text"
                    value={editForm.googleMapsLat}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, googleMapsLat: event.target.value }))}
                    placeholder="20.2111"
                  />
                </div>
                <div>
                  <label htmlFor="edit-maps-lng">Longitud</label>
                  <input
                    id="edit-maps-lng"
                    type="text"
                    value={editForm.googleMapsLng}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, googleMapsLng: event.target.value }))}
                    placeholder="-87.4653"
                  />
                </div>
              </div>
              <label htmlFor="edit-google-reviews-toggle" className="checkbox-label">
                <input
                  id="edit-google-reviews-toggle"
                  type="checkbox"
                  checked={editForm.showGoogleReviews}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, showGoogleReviews: event.target.checked }))}
                />
                Mostrar reseñas de Google Maps en la página pública
              </label>
              <label htmlFor="edit-google-reviews-url">URL de reseñas (opcional)</label>
              <input
                id="edit-google-reviews-url"
                type="url"
                value={editForm.googleMapsReviewsUrl}
                onChange={(event) => setEditForm((prev) => ({ ...prev, googleMapsReviewsUrl: event.target.value }))}
                placeholder="https://search.google.com/local/reviews?placeid=..."
              />
              <label htmlFor="edit-gallery-urls">URLs de galería (una por línea)</label>
              <textarea
                id="edit-gallery-urls"
                value={editForm.galleryImageUrls}
                onChange={(event) => setEditForm((prev) => ({ ...prev, galleryImageUrls: event.target.value }))}
                placeholder={'https://.../foto-1.jpg\nhttps://.../foto-2.jpg'}
                rows={5}
              />
              <label htmlFor="edit-instagram-post-urls">Posts de Instagram destacados (una URL por línea)</label>
              <textarea
                id="edit-instagram-post-urls"
                value={editForm.instagramPostUrls}
                onChange={(event) => setEditForm((prev) => ({ ...prev, instagramPostUrls: event.target.value }))}
                placeholder="https://www.instagram.com/p/..."
                rows={4}
              />
              <div className="edit-actions">
                <button type="submit" className="primary" disabled={isSavingEdit}>
                  {isSavingEdit ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button type="button" className="secondary" onClick={() => void handleRegenerateLink()} disabled={isSavingEdit}>
                  Regenerar link público
                </button>
              </div>
              {editError && (
                <div className="alert alert--inline" role="alert">
                  <span>{editError}</span>
                </div>
              )}
              <p className="public-link">
                Link público actual:{' '}
                <a href={getPublicUrl(selectedProperty)} target="_blank" rel="noopener noreferrer">
                  {getPublicUrl(selectedProperty)}
                </a>
              </p>
              <p className="public-link">
                Link del calendario:{' '}
                <a href={getPublicCalendarUrl(selectedProperty)} target="_blank" rel="noopener noreferrer">
                  {getPublicCalendarUrl(selectedProperty)}
                </a>
              </p>
            </form>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setIsEditModalOpen(false)} disabled={isSavingEdit}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {isJoinModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="join-property-title">
            <h2 id="join-property-title">Agregar propiedad con código</h2>
            <form className="modal-form" onSubmit={handleJoinProperty}>
              <label htmlFor="join-code">Código de acceso</label>
              <input
                id="join-code"
                type="text"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="ABCD1234"
                autoFocus
                required
              />
              <button type="submit" className="primary" disabled={isJoining}>
                {isJoining ? 'Agregando...' : 'Agregar propiedad'}
              </button>
              {joinError && (
                <div className="alert alert--inline" role="alert">
                  <span>{joinError}</span>
                </div>
              )}
            </form>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={closeJoinModal} disabled={isJoining}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
