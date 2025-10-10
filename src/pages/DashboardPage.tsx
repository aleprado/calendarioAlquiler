import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { listProperties, createProperty, updateProperty } from '../api/properties'
import type { PropertyDTO } from '../types'
import { PropertyWorkspace } from '../components/PropertyWorkspace'

const getPublicUrl = (property: PropertyDTO) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/public/${property.publicSlug}`
}

const INITIAL_FORM = { name: '', airbnbIcalUrl: '' }

export const DashboardPage = () => {
  const { user, signOut } = useAuth()
  const [properties, setProperties] = useState<PropertyDTO[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState(INITIAL_FORM)
  const [copied, setCopied] = useState(false)
  const [isPropertyMenuOpen, setIsPropertyMenuOpen] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState(INITIAL_FORM)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

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
      setEditForm({ name: selectedProperty.name, airbnbIcalUrl: selectedProperty.airbnbIcalUrl })
      setEditError(null)
    }
  }, [selectedProperty])

  const handleCreateProperty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsCreating(true)
    setError(null)
    try {
      const created = await createProperty({
        name: createForm.name.trim(),
        airbnbIcalUrl: createForm.airbnbIcalUrl.trim(),
      })
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
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
      setIsPropertyMenuOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo copiar el link. Copialo manualmente.')
    }
  }

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProperty) return
    setIsSavingEdit(true)
    setEditError(null)
    try {
      const updated = await updateProperty(selectedProperty.id, {
        name: editForm.name.trim(),
        airbnbIcalUrl: editForm.airbnbIcalUrl.trim(),
      })
      setProperties((prev) => prev.map((property) => (property.id === updated.id ? updated : property)))
      setIsEditModalOpen(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'No se pudo actualizar la propiedad.')
    } finally {
      setIsSavingEdit(false)
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
          <div className="brand-badge" aria-label="Simple Alquiler">
            <span>SA</span>
          </div>
          <button type="button" className="link-button" onClick={() => setIsInfoOpen(true)}>
            Conoce la app
          </button>
        </div>
        <div className="topbar-right">
          <button type="button" className="link-button" onClick={() => void signOut()}>
            Cerrar sesión
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
                  </div>
                  {copied && <div className="menu-hint">¡Link copiado!</div>}
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
              <button type="submit" className="primary" disabled={isCreating}>
                {isCreating ? 'Guardando...' : 'Guardar propiedad'}
              </button>
            </form>
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
            </form>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setIsEditModalOpen(false)} disabled={isSavingEdit}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
