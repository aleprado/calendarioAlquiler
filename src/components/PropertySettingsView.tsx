import { useState, useEffect, type FC, type FormEvent } from 'react'
import type { PropertyDTO, UpdatePropertyPayload } from '../types'
import { parseGoogleMapsPin, updateProperty } from '../api/properties'
import { useToast } from './ToastNotification'
import {
  getNotificationPermission,
  requestNotificationPermission,
  isNotificationSupported,
} from '../services/notificationService'

interface PropertySettingsViewProps {
  property: PropertyDTO
  onBack: () => void
  onPropertyUpdated: (updated: PropertyDTO) => void
  onImportGooglePhotos: (url: string) => Promise<string[]>
  onResolveMapLink: (url: string) => Promise<{ placeId?: string; lat?: string; lng?: string }>
}

type TabType = 'cotizador' | 'general' | 'gallery' | 'channels'

export const PropertySettingsView: FC<PropertySettingsViewProps> = ({
  property,
  onBack,
  onPropertyUpdated,
  onImportGooglePhotos,
  onResolveMapLink,
}) => {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('cotizador')
  const [isSaving, setIsSaving] = useState(false)
  const [isImportingPhotos, setIsImportingPhotos] = useState(false)
  const [isResolvingMap, setIsResolvingMap] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    setNotificationPermission(getNotificationPermission())
  }, [])

  useEffect(() => {
    const rates = property.quoterMonthlyRatesUSD ?? {}
    const monthRates: Record<string, string> = {}
    for (let m = 1; m <= 12; m++) {
      const k = String(m)
      monthRates[k] = rates[k] !== undefined ? String(rates[k]) : '50'
    }

    setForm({
      name: property.name,
      airbnbIcalUrl: property.airbnbIcalUrl,
      instagramUrl: property.instagramUrl ?? '',
      googlePhotosUrl: property.googlePhotosUrl ?? '',
      coverImageUrl: property.coverImageUrl ?? '',
      defaultCheckInTime: property.defaultCheckInTime ?? '15:00',
      defaultCheckOutTime: property.defaultCheckOutTime ?? '11:00',
      description: property.description ?? '',
      locationLabel: property.locationLabel ?? '',
      googleMapsPinUrl: property.googleMapsPinUrl ?? '',
      googleMapsPlaceId: property.googleMapsPlaceId ?? '',
      googleMapsLat: property.googleMapsLat !== null ? String(property.googleMapsLat) : '',
      googleMapsLng: property.googleMapsLng !== null ? String(property.googleMapsLng) : '',
      showGoogleReviews: property.showGoogleReviews === true,
      googleMapsReviewsUrl: property.googleMapsReviewsUrl ?? '',
      galleryImageUrls: property.galleryImageUrls.join('\n'),
      instagramPostUrls: property.instagramPostUrls.join('\n'),
      showQuoterPublic: property.showQuoterPublic !== false,
      quoterAdminCommissionPercent: String(property.quoterAdminCommissionPercent ?? 0),
      quoterCleaningFeeUSD: String(property.quoterCleaningFeeUSD ?? 0),
      quoterMonthlyRatesUSD: monthRates,
      customUsdToArs: property.quoterCustomExchangeRates?.usdToArs ? String(property.quoterCustomExchangeRates.usdToArs) : '',
      customUsdToBrl: property.quoterCustomExchangeRates?.usdToBrl ? String(property.quoterCustomExchangeRates.usdToBrl) : '',
    })
  }, [property])

  const handleRequestNotification = async () => {
    const res = await requestNotificationPermission()
    setNotificationPermission(res)
    if (res === 'granted') {
      showToast('¡Notificaciones del navegador activadas!', 'success')
    } else if (res === 'denied') {
      showToast('Permiso de notificaciones denegado en tu navegador.', 'info')
    }
  }

  // Initialize form state
  const rates = property.quoterMonthlyRatesUSD ?? {}
  const initialMonthRates: Record<string, string> = {}
  for (let m = 1; m <= 12; m++) {
    const k = String(m)
    initialMonthRates[k] = rates[k] !== undefined ? String(rates[k]) : '50'
  }

  const [form, setForm] = useState({
    name: property.name,
    airbnbIcalUrl: property.airbnbIcalUrl,
    instagramUrl: property.instagramUrl ?? '',
    googlePhotosUrl: property.googlePhotosUrl ?? '',
    coverImageUrl: property.coverImageUrl ?? '',
    defaultCheckInTime: property.defaultCheckInTime ?? '15:00',
    defaultCheckOutTime: property.defaultCheckOutTime ?? '11:00',
    description: property.description ?? '',
    locationLabel: property.locationLabel ?? '',
    googleMapsPinUrl: property.googleMapsPinUrl ?? '',
    googleMapsPlaceId: property.googleMapsPlaceId ?? '',
    googleMapsLat: property.googleMapsLat !== null ? String(property.googleMapsLat) : '',
    googleMapsLng: property.googleMapsLng !== null ? String(property.googleMapsLng) : '',
    showGoogleReviews: property.showGoogleReviews === true,
    googleMapsReviewsUrl: property.googleMapsReviewsUrl ?? '',
    galleryImageUrls: property.galleryImageUrls.join('\n'),
    instagramPostUrls: property.instagramPostUrls.join('\n'),
    showQuoterPublic: property.showQuoterPublic !== false,
    quoterAdminCommissionPercent: String(property.quoterAdminCommissionPercent ?? 0),
    quoterCleaningFeeUSD: String(property.quoterCleaningFeeUSD ?? 0),
    quoterMonthlyRatesUSD: initialMonthRates,
    customUsdToArs: property.quoterCustomExchangeRates?.usdToArs ? String(property.quoterCustomExchangeRates.usdToArs) : '',
    customUsdToBrl: property.quoterCustomExchangeRates?.usdToBrl ? String(property.quoterCustomExchangeRates.usdToBrl) : '',
  })

  const parseUrlList = (val: string) =>
    val
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const parsedRates: Record<string, number> = {}
      for (let m = 1; m <= 12; m++) {
        const k = String(m)
        const val = Number(form.quoterMonthlyRatesUSD[k] ?? 0)
        parsedRates[k] = Number.isFinite(val) && val >= 0 ? val : 0
      }

      const customArs = form.customUsdToArs ? Number(form.customUsdToArs) : undefined
      const customBrl = form.customUsdToBrl ? Number(form.customUsdToBrl) : undefined
      const customRates =
        (customArs && customArs > 0) || (customBrl && customBrl > 0)
          ? { usdToArs: customArs, usdToBrl: customBrl }
          : null

      const trimmedInstagram = form.instagramUrl.trim()
      const trimmedGoogle = form.googlePhotosUrl.trim()
      const trimmedCover = form.coverImageUrl.trim()
      const trimmedDesc = form.description.trim()
      const trimmedPin = form.googleMapsPinUrl.trim()
      const trimmedReviews = form.googleMapsReviewsUrl.trim()
      const effectiveLoc = form.locationLabel.trim() || null
      const effectivePlaceId = form.googleMapsPlaceId.trim() || null
      const effectiveLat = form.googleMapsLat.trim() ? Number(form.googleMapsLat.trim()) : null
      const effectiveLng = form.googleMapsLng.trim() ? Number(form.googleMapsLng.trim()) : null

      const payload: UpdatePropertyPayload = {
        name: form.name.trim(),
        airbnbIcalUrl: form.airbnbIcalUrl.trim(),
        instagramUrl: trimmedInstagram ? trimmedInstagram : null,
        googlePhotosUrl: trimmedGoogle ? trimmedGoogle : null,
        coverImageUrl: trimmedCover ? trimmedCover : null,
        description: trimmedDesc ? trimmedDesc : null,
        locationLabel: effectiveLoc,
        googleMapsPinUrl: trimmedPin ? trimmedPin : null,
        googleMapsPlaceId: effectivePlaceId,
        googleMapsLat: Number.isFinite(effectiveLat) ? effectiveLat : null,
        googleMapsLng: Number.isFinite(effectiveLng) ? effectiveLng : null,
        showGoogleReviews: form.showGoogleReviews,
        googleMapsReviewsUrl: trimmedReviews ? trimmedReviews : null,
        galleryImageUrls: parseUrlList(form.galleryImageUrls),
        instagramPostUrls: parseUrlList(form.instagramPostUrls),
        showQuoterPublic: form.showQuoterPublic,
        quoterAdminCommissionPercent: Math.max(0, Number(form.quoterAdminCommissionPercent) || 0),
        quoterCleaningFeeUSD: Math.max(0, Number(form.quoterCleaningFeeUSD) || 0),
        quoterMonthlyRatesUSD: parsedRates,
        quoterCustomExchangeRates: customRates,
        defaultCheckInTime: form.defaultCheckInTime.trim() || '15:00',
        defaultCheckOutTime: form.defaultCheckOutTime.trim() || '11:00',
      }

      const updated = await updateProperty(property.id, payload)
      onPropertyUpdated(updated)
      showToast('¡Configuración guardada exitosamente!', 'success')
      onBack()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar la configuración.'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleImportPhotos = async () => {
    if (!form.googlePhotosUrl.trim()) {
      showToast('Ingresa una URL de álbum de Google Fotos primero.', 'info')
      return
    }
    setIsImportingPhotos(true)
    try {
      const imported = await onImportGooglePhotos(form.googlePhotosUrl)
      if (imported.length > 0) {
        setForm((prev) => {
          const currentUrls = parseUrlList(prev.galleryImageUrls)
          const merged = Array.from(new Set([...imported, ...currentUrls]))
          return { ...prev, galleryImageUrls: merged.join('\n') }
        })
        showToast(`¡Se importaron ${imported.length} imágenes del álbum!`, 'success')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al importar fotos', 'error')
    } finally {
      setIsImportingPhotos(false)
    }
  }

  const handleResolvePin = async () => {
    if (!form.googleMapsPinUrl.trim()) {
      showToast('Ingresa una URL de Google Maps primero.', 'info')
      return
    }
    setIsResolvingMap(true)
    try {
      const resolved = await onResolveMapLink(form.googleMapsPinUrl)
      setForm((prev) => ({
        ...prev,
        googleMapsPlaceId: resolved.placeId ?? prev.googleMapsPlaceId,
        googleMapsLat: resolved.lat ?? prev.googleMapsLat,
        googleMapsLng: resolved.lng ?? prev.googleMapsLng,
      }))
      showToast('¡Pin de Google Maps detectado correctamente!', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al procesar el pin', 'error')
    } finally {
      setIsResolvingMap(false)
    }
  }

  const handleRegenerateLink = async () => {
    if (!window.confirm('¿Estás seguro de regenerar el enlace público? El enlace anterior dejará de funcionar.')) {
      return
    }
    setIsSaving(true)
    try {
      const updated = await updateProperty(property.id, { regenerateSlug: true })
      onPropertyUpdated(updated)
      showToast('¡Enlace público regenerado!', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al regenerar enlace', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="property-settings-page">
      <header className="settings-page-header">
        <button type="button" className="secondary settings-back-btn" onClick={onBack}>
          &larr; Volver al Panel
        </button>
        <div className="settings-header-title">
          <h2>Configuración de {property.name}</h2>
          <p className="subtitle">Administra tarifas por noche, datos públicos, galería de fotos e iCal de Airbnb</p>
        </div>
      </header>

      <div className="settings-page-card">
        {/* Navigation Tabs Bar */}
        <nav className="settings-tabs-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'cotizador'}
            className={`settings-tab-item ${activeTab === 'cotizador' ? 'settings-tab-item--active' : ''}`}
            onClick={() => setActiveTab('cotizador')}
          >
            💰 Tarifas y Cotizador (USD/noche)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'general'}
            className={`settings-tab-item ${activeTab === 'general' ? 'settings-tab-item--active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            📝 Info General & Ubicación
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'gallery'}
            className={`settings-tab-item ${activeTab === 'gallery' ? 'settings-tab-item--active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            📷 Galería & Google Fotos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'channels'}
            className={`settings-tab-item ${activeTab === 'channels' ? 'settings-tab-item--active' : ''}`}
            onClick={() => setActiveTab('channels')}
          >
            🔗 Airbnb & Canales
          </button>
        </nav>

        <form onSubmit={handleSave} className="settings-form-body">
          {/* TAB 1: COTIZADOR Y TARIFAS */}
          {activeTab === 'cotizador' && (
            <section className="settings-section-panel">
              <div className="settings-card-box">
                <h3>Cotizador de Tarifas y Visibilidad</h3>
                <label htmlFor="settings-quoter-public" className="checkbox-label checkbox-label--lg">
                  <input
                    id="settings-quoter-public"
                    type="checkbox"
                    checked={form.showQuoterPublic}
                    onChange={(e) => setForm((prev) => ({ ...prev, showQuoterPublic: e.target.checked }))}
                  />
                  Mostrar Cotizador de tarifas en la página pública para huéspedes
                </label>
              </div>

              <div className="settings-card-box">
                <h3>Cargos Privados (Solo visibles para el dueño)</h3>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="settings-commission">Comisión del Administrador (%)</label>
                    <input
                      id="settings-commission"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form.quoterAdminCommissionPercent}
                      onChange={(e) => setForm((prev) => ({ ...prev, quoterAdminCommissionPercent: e.target.value }))}
                      placeholder="Ej. 10"
                    />
                    <span className="field-hint">Se suma automáticamente al subtotal en la vista privada</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="settings-cleaning">Costo de Limpieza por Estadía (USD)</label>
                    <input
                      id="settings-cleaning"
                      type="number"
                      min="0"
                      step="5"
                      value={form.quoterCleaningFeeUSD}
                      onChange={(e) => setForm((prev) => ({ ...prev, quoterCleaningFeeUSD: e.target.value }))}
                      placeholder="Ej. 50"
                    />
                    <span className="field-hint">Monto fijo en USD por reserva en la vista privada</span>
                  </div>
                </div>
              </div>

              <div className="settings-card-box">
                <h3>Tarifa por Noche por Mes (USD / noche)</h3>
                <p className="field-hint" style={{ marginBottom: '1rem' }}>
                  Especifica la tarifa por noche asignada a cada mes del año. El cotizador calculará el subtotal sumando el valor de cada noche de la estadía.
                </p>
                <div className="settings-monthly-grid">
                  {[
                    { key: '1', label: 'Enero' },
                    { key: '2', label: 'Febrero' },
                    { key: '3', label: 'Marzo' },
                    { key: '4', label: 'Abril' },
                    { key: '5', label: 'Mayo' },
                    { key: '6', label: 'Junio' },
                    { key: '7', label: 'Julio' },
                    { key: '8', label: 'Agosto' },
                    { key: '9', label: 'Septiembre' },
                    { key: '10', label: 'Octubre' },
                    { key: '11', label: 'Noviembre' },
                    { key: '12', label: 'Diciembre' },
                  ].map((month) => (
                    <div key={month.key} className="month-card-input">
                      <label htmlFor={`setting-rate-${month.key}`}>{month.label}</label>
                      <div className="input-currency-wrapper">
                        <span className="currency-symbol">$</span>
                        <input
                          id={`setting-rate-${month.key}`}
                          type="number"
                          min="0"
                          step="any"
                          value={form.quoterMonthlyRatesUSD[month.key] ?? '50'}
                          onChange={(e) => {
                            const val = e.target.value
                            setForm((prev) => ({
                              ...prev,
                              quoterMonthlyRatesUSD: {
                                ...prev.quoterMonthlyRatesUSD,
                                [month.key]: val,
                              },
                            }))
                          }}
                          placeholder="80"
                        />
                        <span className="currency-unit">USD/noche</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-card-box">
                <h3>Cotizaciones de Cambio Personalizadas (Opcional)</h3>
                <p className="field-hint" style={{ marginBottom: '1rem' }}>
                  Si dejas estos campos vacíos, el sistema obtendrá automáticamente las cotizaciones en tiempo real desde Dólar API.
                </p>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="settings-usd-ars">1 USD en ARS (Pesos Argentinos)</label>
                    <input
                      id="settings-usd-ars"
                      type="number"
                      min="0"
                      step="10"
                      value={form.customUsdToArs}
                      onChange={(e) => setForm((prev) => ({ ...prev, customUsdToArs: e.target.value }))}
                      placeholder="Dejar vacío para cotización en vivo Dólar API"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="settings-usd-brl">1 USD en BRL (Reales Brasileños)</label>
                    <input
                      id="settings-usd-brl"
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.customUsdToBrl}
                      onChange={(e) => setForm((prev) => ({ ...prev, customUsdToBrl: e.target.value }))}
                      placeholder="Dejar vacío para cotización en vivo Dólar API"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 2: INFO GENERAL & UBICACIÓN */}
          {activeTab === 'general' && (
            <section className="settings-section-panel">
              <div className="settings-card-box">
                <h3>Información de la Propiedad</h3>
                <div className="form-group">
                  <label htmlFor="settings-name">Nombre de la propiedad *</label>
                  <input
                    id="settings-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-desc">Descripción para la vista pública</label>
                  <textarea
                    id="settings-desc"
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe las ventajas, estilo, capacidad, comodidades y servicios."
                    rows={5}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-location">Ubicación visible (Texto)</label>
                  <input
                    id="settings-location"
                    type="text"
                    value={form.locationLabel}
                    onChange={(e) => setForm((prev) => ({ ...prev, locationLabel: e.target.value }))}
                    placeholder="Ej. San Carlos de Bariloche, Río Negro"
                  />
                </div>
              </div>

              <div className="settings-card-box">
                <h3>Horarios Habituales de Check-in / Check-out</h3>
                <p className="field-hint" style={{ marginBottom: '1rem' }}>
                  Estos horarios se mostrarán en la vista pública, en los detalles del cotizador y en las franjas visuales del calendario.
                </p>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="settings-checkin">Hora de Check-in (Entrada por la tarde)</label>
                    <input
                      id="settings-checkin"
                      type="time"
                      value={form.defaultCheckInTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, defaultCheckInTime: e.target.value }))}
                      required
                    />
                    <span className="field-hint">Ej. 15:00 hs (ocupa los 2/3 inferiores de la celda)</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="settings-checkout">Hora de Check-out (Salida por la mañana)</label>
                    <input
                      id="settings-checkout"
                      type="time"
                      value={form.defaultCheckOutTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, defaultCheckOutTime: e.target.value }))}
                      required
                    />
                    <span className="field-hint">Ej. 11:00 hs (ocupa el 1/3 superior de la celda)</span>
                  </div>
                </div>
              </div>

              {isNotificationSupported() && (
                <div className="settings-card-box">
                  <h3>Notificaciones del Navegador</h3>
                  <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
                    Recibe una alerta flotante en tu escritorio/móvil al instante cuando un huésped envíe una nueva solicitud de reserva.
                  </p>
                  <div className="input-button-row">
                    <span style={{ fontSize: '0.9rem', alignSelf: 'center', fontWeight: 500 }}>
                      Estado actual:{' '}
                      {notificationPermission === 'granted'
                        ? '✅ Permitidas'
                        : notificationPermission === 'denied'
                        ? '❌ Denegadas en el navegador'
                        : '⚠️ Pendiente de autorización'}
                    </span>
                    {notificationPermission !== 'granted' && (
                      <button type="button" className="secondary" onClick={() => void handleRequestNotification()}>
                        Activar Notificaciones Push
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="settings-card-box">
                <h3>Google Maps & Ubicación Geográfica</h3>
                <div className="form-group">
                  <label htmlFor="settings-maps-pin">Pin de Google Maps (URL)</label>
                  <div className="input-button-row">
                    <input
                      id="settings-maps-pin"
                      type="url"
                      value={form.googleMapsPinUrl}
                      onChange={(e) => {
                        const val = e.target.value
                        const parsed = parseGoogleMapsPin(val)
                        setForm((prev) => ({
                          ...prev,
                          googleMapsPinUrl: val,
                          googleMapsPlaceId: parsed.placeId ?? prev.googleMapsPlaceId,
                          googleMapsLat: parsed.lat ?? prev.googleMapsLat,
                          googleMapsLng: parsed.lng ?? prev.googleMapsLng,
                        }))
                      }}
                      placeholder="https://maps.google.com/..."
                    />
                    <button type="button" className="secondary" onClick={() => void handleResolvePin()} disabled={isResolvingMap}>
                      {isResolvingMap ? 'Procesando...' : 'Detectar Pin'}
                    </button>
                  </div>
                  <span className="field-hint">Completa coordenadas automáticamente aceptando enlaces cortos (`maps.app.goo.gl`)</span>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label htmlFor="settings-placeid">Google Place ID</label>
                    <input
                      id="settings-placeid"
                      type="text"
                      value={form.googleMapsPlaceId}
                      onChange={(e) => setForm((prev) => ({ ...prev, googleMapsPlaceId: e.target.value }))}
                      placeholder="ChIJ..."
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="settings-lat">Latitud</label>
                    <input
                      id="settings-lat"
                      type="text"
                      value={form.googleMapsLat}
                      onChange={(e) => setForm((prev) => ({ ...prev, googleMapsLat: e.target.value }))}
                      placeholder="-41.1335"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="settings-lng">Longitud</label>
                    <input
                      id="settings-lng"
                      type="text"
                      value={form.googleMapsLng}
                      onChange={(e) => setForm((prev) => ({ ...prev, googleMapsLng: e.target.value }))}
                      placeholder="-71.3102"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label htmlFor="settings-reviews-toggle" className="checkbox-label">
                    <input
                      id="settings-reviews-toggle"
                      type="checkbox"
                      checked={form.showGoogleReviews}
                      onChange={(e) => setForm((prev) => ({ ...prev, showGoogleReviews: e.target.checked }))}
                    />
                    Mostrar sección de reseñas de Google Maps en la página pública
                  </label>
                </div>
                <div className="form-group">
                  <label htmlFor="settings-reviews-url">URL de Reseñas de Google Maps (Opcional)</label>
                  <input
                    id="settings-reviews-url"
                    type="url"
                    value={form.googleMapsReviewsUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, googleMapsReviewsUrl: e.target.value }))}
                    placeholder="https://search.google.com/local/reviews?placeid=..."
                  />
                </div>
              </div>
            </section>
          )}

          {/* TAB 3: GALERÍA Y FOTOS */}
          {activeTab === 'gallery' && (
            <section className="settings-section-panel">
              <div className="settings-card-box">
                <h3>Foto Principal (Portada del Folleto Visual)</h3>
                <div className="form-group">
                  <label htmlFor="settings-cover-image">URL de Foto Principal (Portada)</label>
                  <input
                    id="settings-cover-image"
                    type="url"
                    value={form.coverImageUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
                    placeholder="https://.../portada.jpg"
                  />
                  <span className="field-hint">
                    Esta imagen se usará como el fondo principal del banner público de tu propiedad. Si la dejas vacía, se tomará automáticamente la primera foto de la galería. Puedes seleccionarla haciendo clic en &ldquo;⭐ Usar como Portada&rdquo; en cualquier foto de abajo.
                  </span>
                </div>
                {form.coverImageUrl.trim() && (
                  <div className="cover-preview-box" style={{ marginTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '0.35rem' }}>
                      Vista previa de la Portada seleccionada:
                    </span>
                    <img
                      src={form.coverImageUrl.trim()}
                      alt="Vista previa de portada"
                      style={{ maxWidth: '280px', maxHeight: '160px', borderRadius: '8px', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                    />
                  </div>
                )}
              </div>

              <div className="settings-card-box">
                <h3>Álbum Dinámico de Google Fotos</h3>
                <div className="form-group">
                  <label htmlFor="settings-gphotos-link">Enlace de Álbum Público de Google Fotos</label>
                  <div className="input-button-row">
                    <input
                      id="settings-gphotos-link"
                      type="url"
                      value={form.googlePhotosUrl}
                      onChange={(e) => setForm((prev) => ({ ...prev, googlePhotosUrl: e.target.value }))}
                      placeholder="https://photos.app.goo.gl/tu_album"
                    />
                    <button type="button" className="secondary" onClick={() => void handleImportPhotos()} disabled={isImportingPhotos}>
                      {isImportingPhotos ? 'Importando...' : 'Cargar Fotos a Galería'}
                    </button>
                  </div>
                  <span className="field-hint">
                    ✨ <strong>Sincronización Automática:</strong> Al colocar el enlace de Google Fotos y guardar cambios, las imágenes se cargarán y actualizarán dinámicamente en tu página pública.
                  </span>
                </div>
              </div>

              {parseUrlList(form.galleryImageUrls).length > 0 && (
                <div className="settings-card-box">
                  <h3>Gestión Visual de Fotos de la Galería ({parseUrlList(form.galleryImageUrls).length})</h3>
                  <p className="field-hint" style={{ marginBottom: '1rem' }}>
                    Haz clic en <strong>&ldquo;⭐ Usar como Portada&rdquo;</strong> en cualquier imagen para fijarla como la foto principal del banner.
                  </p>
                  <div className="settings-photo-grid">
                    {parseUrlList(form.galleryImageUrls).map((url, idx) => {
                      const isCover = form.coverImageUrl.trim() === url.trim()
                      return (
                        <div key={`${url}-${idx}`} className={`photo-thumb-card ${isCover ? 'photo-thumb-card--cover' : ''}`}>
                          <div className="photo-thumb-img-wrapper">
                            <img src={url} alt={`Foto ${idx + 1}`} loading="lazy" />
                            {isCover && <span className="cover-badge">⭐ Portada Principal</span>}
                          </div>
                          <div className="photo-thumb-actions">
                            {!isCover ? (
                              <button
                                type="button"
                                className="secondary btn-sm"
                                onClick={() => setForm((prev) => ({ ...prev, coverImageUrl: url }))}
                              >
                                ⭐ Usar como Portada
                              </button>
                            ) : (
                              <span className="active-cover-tag">✓ Portada Actual</span>
                            )}
                            <button
                              type="button"
                              className="danger btn-sm"
                              onClick={() => {
                                const currentList = parseUrlList(form.galleryImageUrls)
                                const updatedList = currentList.filter((_, i) => i !== idx)
                                const newCover = isCover ? (updatedList[0] ?? '') : form.coverImageUrl
                                setForm((prev) => ({
                                  ...prev,
                                  galleryImageUrls: updatedList.join('\n'),
                                  coverImageUrl: newCover,
                                }))
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="settings-card-box">
                <h3>Colección de URLs de Galería (Edición por texto)</h3>
                <div className="form-group">
                  <label htmlFor="settings-gallery-list">URLs directas de Galería (Una por línea)</label>
                  <textarea
                    id="settings-gallery-list"
                    value={form.galleryImageUrls}
                    onChange={(e) => setForm((prev) => ({ ...prev, galleryImageUrls: e.target.value }))}
                    placeholder={'https://.../foto1.jpg\nhttps://.../foto2.jpg'}
                    rows={6}
                  />
                  <span className="field-hint">Las fotos se mostrarán paginadas en la página pública en bloques de 8 imágenes.</span>
                </div>
              </div>
            </section>
          )}

          {/* TAB 4: AIRBNB & CANALES */}
          {activeTab === 'channels' && (
            <section className="settings-section-panel">
              <div className="settings-card-box">
                <h3>Sincronización con Airbnb (iCal)</h3>
                <div className="form-group">
                  <label htmlFor="settings-ical">Enlace iCal de Airbnb *</label>
                  <input
                    id="settings-ical"
                    type="url"
                    value={form.airbnbIcalUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, airbnbIcalUrl: e.target.value }))}
                    required
                    placeholder="https://www.airbnb.com/calendar/ical/..."
                  />
                  <span className="field-hint">Permite sincronizar automáticamente las reservas y bloqueos de Airbnb con tu calendario.</span>
                </div>
              </div>

              <div className="settings-card-box">
                <h3>Perfil de Instagram</h3>
                <div className="form-group">
                  <label htmlFor="settings-insta-url">URL del Perfil de Instagram</label>
                  <input
                    id="settings-insta-url"
                    type="url"
                    value={form.instagramUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, instagramUrl: e.target.value }))}
                    placeholder="https://instagram.com/tu_cuenta"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-insta-posts">Posts o Reels Destacados (Una URL por línea)</label>
                  <textarea
                    id="settings-insta-posts"
                    value={form.instagramPostUrls}
                    onChange={(e) => setForm((prev) => ({ ...prev, instagramPostUrls: e.target.value }))}
                    placeholder={'https://www.instagram.com/p/...\nhttps://www.instagram.com/reel/...'}
                    rows={4}
                  />
                </div>
              </div>

              <div className="settings-card-box danger-zone-box">
                <h3>Zona de Enlace Público</h3>
                <p className="field-hint">
                  Si necesitas cambiar el enlace web público de tu propiedad, puedes regenerarlo. El enlace anterior quedará inactivo.
                </p>
                <button type="button" className="danger" onClick={() => void handleRegenerateLink()} disabled={isSaving}>
                  Regenerar Enlace Público
                </button>
              </div>
            </section>
          )}

          {error && <div className="alert alert--inline">{error}</div>}

          {/* Bottom Floating/Sticky Action Bar */}
          <footer className="settings-actions-footer">
            <button type="submit" className="primary" disabled={isSaving}>
              {isSaving ? 'Guardando configuración...' : 'Guardar cambios'}
            </button>
            <button type="button" className="secondary" onClick={onBack} disabled={isSaving}>
              Cancelar / Volver
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
