import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
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
  const [isEditing, setIsEditing] = useState(false)
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
      setIsEditing(false)
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
      setIsEditing(false)
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

  return (
    <div className="dashboard-layout">
      <header className="dashboard-header">
        <div>
          <h1>Simple Alquiler</h1>
          <p className="subtitle">Gestiona tus propiedades y coordina reservas en un solo lugar.</p>
        </div>
        <div className="user-info">
          {user?.photoURL && <img src={user.photoURL} alt={user.displayName ?? user.email ?? 'Usuario'} className="user-avatar" />}
          <div className="user-meta">
            <span>{user?.displayName ?? user?.email}</span>
            <button type="button" className="secondary" onClick={() => void signOut()}>
              Cerrar sesión
            </button>
          </div>
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
          <>
            <section className="card property-selector">
              <div className="property-selector__inputs">
                <label htmlFor="property-select">
                  Propiedad
                  {properties.length > 1 && (
                    <select
                      id="property-select"
                      value={selectedPropertyId ?? ''}
                      onChange={(event) => setSelectedPropertyId(event.target.value)}
                    >
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {properties.length === 1 && <span className="property-name-single">{properties[0].name}</span>}
                </label>
              </div>
              {selectedProperty && (
                <div className="property-selector__actions">
                  <button type="button" className="secondary" onClick={handleCopyPublicLink}>
                    Copiar link público
                  </button>
                  <span className={`copy-hint${copied ? ' copy-hint--ok' : ''}`}>{copied ? '¡Link copiado!' : ''}</span>
                  <button type="button" className="secondary" onClick={() => setIsEditing((prev) => !prev)}>
                    {isEditing ? 'Cerrar edición' : 'Editar propiedad'}
                  </button>
                </div>
              )}
            </section>

            {isEditing && selectedProperty && (
              <section className="card">
                <h3>Editar propiedad</h3>
                <form className="property-form" onSubmit={handleSaveEdit}>
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
                </form>
                <p className="public-link">
                  Link público actual:{' '}
                  <a href={getPublicUrl(selectedProperty)} target="_blank" rel="noopener noreferrer">
                    {getPublicUrl(selectedProperty)}
                  </a>
                </p>
              </section>
            )}

            {selectedProperty && <PropertyWorkspace property={selectedProperty} />}
          </>
        )}
      </main>
    </div>
  )
}
