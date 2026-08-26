import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import {
  listProperties,
  createProperty,
  joinProperty,
  resolveGoogleMapsLink as resolveGoogleMapsLinkApi,
  importGooglePhotosAlbum as importGooglePhotosAlbumApi,
} from '../api/properties'
import type { PropertyDTO } from '../types'
import { PropertyWorkspace } from '../components/PropertyWorkspace'
import { PropertySettingsView } from '../components/PropertySettingsView'
import { Logo } from '../components/Logo'
import { useToast } from '../components/ToastNotification'

const getPublicUrl = (property: PropertyDTO) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/public/${property.publicSlug}`
}

const getPublicCalendarUrl = (property: PropertyDTO) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/public/${property.publicSlug}/calendario`
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
  showQuoterPublic: true,
  quoterAdminCommissionPercent: '0',
  quoterCleaningFeeUSD: '0',
  quoterMonthlyRatesUSD: {
    '1': '80',
    '2': '80',
    '3': '60',
    '4': '50',
    '5': '50',
    '6': '50',
    '7': '60',
    '8': '60',
    '9': '50',
    '10': '50',
    '11': '60',
    '12': '80',
  } as Record<string, string>,
  customUsdToArs: '',
  customUsdToBrl: '',
}

export const DashboardPage = () => {
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const [properties, setProperties] = useState<PropertyDTO[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState(INITIAL_FORM)
  const [isPropertyMenuOpen, setIsPropertyMenuOpen] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [activeView, setActiveView] = useState<'workspace' | 'settings'>('workspace')
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
      showToast('Propiedad creada exitosamente', 'success')
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
      showToast('Link público copiado al portapapeles', 'success')
      setIsPropertyMenuOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo copiar el link. Copialo manualmente.')
    }
  }

  const handleCopyShareCode = async () => {
    if (!selectedProperty) return
    try {
      await navigator.clipboard.writeText(selectedProperty.shareCode)
      showToast('Código de acceso copiado', 'success')
      setIsPropertyMenuOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo copiar el código. Copialo manualmente.')
    }
  }

  const handleCopyCalendarLink = async () => {
    if (!selectedProperty) return
    try {
      await navigator.clipboard.writeText(getPublicCalendarUrl(selectedProperty))
      showToast('Link del calendario copiado', 'success')
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
          <Logo size="sm" />
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
                        setActiveView('settings')
                        setIsPropertyMenuOpen(false)
                      }}
                    >
                      Configuración de la propiedad
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
        ) : activeView === 'settings' && selectedProperty ? (
          <PropertySettingsView
            property={selectedProperty}
            onBack={() => setActiveView('workspace')}
            onPropertyUpdated={(updated) => {
              setProperties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            }}
            onImportGooglePhotos={(url) => importGooglePhotosAlbumApi(url).then((res) => res.images)}
            onResolveMapLink={(url) =>
              resolveGoogleMapsLinkApi(url).then((res) => ({
                placeId: res.googleMapsPlaceId ?? undefined,
                lat: res.googleMapsLat !== null ? String(res.googleMapsLat) : undefined,
                lng: res.googleMapsLng !== null ? String(res.googleMapsLng) : undefined,
              }))
            }
          />
        ) : selectedProperty ? (
          <PropertyWorkspace property={selectedProperty} onOpenSettings={() => setActiveView('settings')} />
        ) : null}
      </main>

      {isInfoOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--info" role="dialog" aria-modal="true" aria-labelledby="about-modal-title">
            <h2 id="about-modal-title">¿Qué es Simple Alquiler?</h2>
            <p>
              Gestionamos tus alojamientos turísticos desde un único panel: sincronización automática con Airbnb, bloqueos manuales y un enlace público para recibir reservas sin compartir tu panel privado.
            </p>
            <p>
              ¿Te interesa implementar Simple Alquiler? Contáctanos por{' '}
              <a href="https://wa.me/5492364261382" target="_blank" rel="noopener noreferrer">
                WhatsApp (+54 236 426-1382)
              </a>
              .
            </p>
            <button type="button" className="primary" onClick={() => setIsInfoOpen(false)}>
              Cerrar
            </button>
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
