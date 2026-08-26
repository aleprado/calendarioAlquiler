import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Logo } from '../components/Logo'
import { PropertyWorkspace } from '../components/PropertyWorkspace'
import { PropertySettings } from '../components/PropertySettings'
import { createProperty, joinProperty, listProperties } from '../api/properties'
import type { PropertyDTO } from '../types'
import { useToast } from '../components/ToastNotification'
import { useLocale } from '../i18n/LocaleContext'
import { LanguageSelector } from '../components/LanguageSelector'

const INITIAL_FORM = {
  name: '',
  airbnbIcalUrl: '',
  instagramUrl: '',
  googlePhotosUrl: '',
  defaultCheckInTime: '15:00',
  defaultCheckOutTime: '11:00',
  locationLabel: '',
  googleMapsPinUrl: '',
  googleMapsLat: '',
  googleMapsLng: '',
  googleMapsPlaceId: '',
  description: '',
  showQuoterPublic: false,
  quoterAdminCommissionPercent: 0,
  quoterCleaningFeeUSD: 0,
  quoterMonthlyRatesUSD: {
    '1': 50,
    '2': 50,
    '3': 50,
    '4': 50,
    '5': 50,
    '6': 50,
    '7': 50,
    '8': 50,
    '9': 50,
    '10': 50,
    '11': 50,
    '12': 50,
    default: 50,
  } as Record<string, number>,
  quoterCustomExchangeRates: {
    usdToArs: null as number | null,
    usdToBrl: null as number | null,
    lastUpdatedAt: null as string | null,
    source: 'live' as 'live' | 'custom' | 'fallback',
  },
  quoterCustomExchangeRatesInputs: {
    usdToArs: '',
    usdToBrl: '',
  },
}

export const DashboardPage = () => {
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const { t } = useLocale()
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
        if (data.length === 0) return null
        if (prev && data.some((property) => property.id === prev)) return prev
        return data[0].id
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workspaceLoadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

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
      showToast(t('dashCreatePropSuccess'), 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashCreatePropError'))
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopyPublicLink = async () => {
    if (!selectedProperty) return
    const url = `${window.location.origin}/public/${selectedProperty.publicSlug}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copiado al portapapeles', 'success')
    } catch {
      showToast('No se pudo copiar el link', 'error')
    }
  }

  const handleJoinProperty = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setIsJoining(true)
    setJoinError(null)
    try {
      await joinProperty(joinCode.trim())
      await loadProperties()
      setIsJoinModalOpen(false)
      setJoinCode('')
      showToast(t('dashJoinSuccess'), 'success')
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Error')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="dashboard-layout">
      <header className="dashboard-header">
        <div className="dashboard-header__brand">
          <Logo size="sm" showText={false} className="dashboard-logo-only" />
          <h1 className="dashboard-title">
            <span className="dashboard-title__desktop">{t('dashMyProperties')}</span>
          </h1>
        </div>

        {properties.length > 0 && (
          <div className="property-switcher-container">
            <button
              type="button"
              className="property-switcher"
              onClick={() => setIsPropertyMenuOpen(!isPropertyMenuOpen)}
              aria-expanded={isPropertyMenuOpen}
            >
              <span className="property-switcher__text">
                {selectedProperty?.name ?? t('dashSelectProp')}
              </span>
              <span className="property-switcher__icon" aria-hidden="true">
                ▼
              </span>
            </button>

            {isPropertyMenuOpen && (
              <div className="property-switcher-menu">
                {properties.map((prop) => (
                  <button
                    key={prop.id}
                    type="button"
                    className={`property-switcher-menu__item${prop.id === selectedPropertyId ? ' active' : ''}`}
                    onClick={() => {
                      setSelectedPropertyId(prop.id)
                      setIsPropertyMenuOpen(false)
                      setActiveView('workspace')
                    }}
                  >
                    {prop.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="dashboard-header__user">
          <LanguageSelector />
          <button type="button" className="secondary btn-sm" onClick={signOut}>
            {t('dashSignOut')}
          </button>
        </div>
      </header>

      {error && (
        <div className="alert" role="alert" style={{ margin: '1rem clamp(1rem, 5vw, 4rem)' }}>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading">{t('loading')}</div>
      ) : properties.length === 0 ? (
        <div className="empty-state">
          <div className="card">
            <h2>{t('dashRegisterFirst')}</h2>
            <p>{t('dashCreatePropDesc')}</p>
            <form onSubmit={handleCreateProperty} className="modal-form" style={{ marginTop: '2rem' }}>
              <label htmlFor="prop-name">{t('dashPropName')}</label>
              <input
                id="prop-name"
                type="text"
                required
                placeholder={t('dashPropNamePlaceholder')}
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                disabled={isCreating}
              />
              <label htmlFor="prop-ical">{t('dashAirbnbUrl')}</label>
              <input
                id="prop-ical"
                type="url"
                placeholder={t('dashAirbnbUrlPlaceholder')}
                value={createForm.airbnbIcalUrl}
                onChange={(e) => setCreateForm((f) => ({ ...f, airbnbIcalUrl: e.target.value }))}
                disabled={isCreating}
              />
              <button type="submit" className="primary" disabled={isCreating} style={{ marginTop: '1rem' }}>
                {isCreating ? t('dashCreatingProp') : t('dashCreatePropBtn')}
              </button>
            </form>

            <div className="dashboard-join-section">
              <h3 className="dashboard-join-section__title">{t('dashJoinTitle')}</h3>
              <p className="dashboard-join-section__desc">{t('dashJoinDesc')}</p>
              <button
                type="button"
                className="secondary"
                onClick={() => setIsJoinModalOpen(true)}
                disabled={isCreating}
              >
                {t('dashJoinBtn')}
              </button>
            </div>
          </div>

          <div className="welcome-card card">
            <h2 className="welcome-card__title">
              <span aria-hidden="true">👋</span> {t('dashWelcomeCardTitle')}
            </h2>
            <p className="welcome-card__desc">{t('dashWelcomeCardDesc')}</p>
            <ul className="welcome-card__features">
              <li>{t('dashWelcomeFeatures').split('\n')[0]}</li>
              <li>{t('dashWelcomeFeatures').split('\n')[1]}</li>
              <li>{t('dashWelcomeFeatures').split('\n')[2]}</li>
              <li>{t('dashWelcomeFeatures').split('\n')[3]}</li>
            </ul>
          </div>
        </div>
      ) : selectedProperty ? (
        <main className="dashboard-main">
          <div className="property-dashboard-header">
            <div className="property-dashboard-nav">
              <button
                type="button"
                className={`tab-btn${activeView === 'workspace' ? ' active' : ''}`}
                onClick={() => setActiveView('workspace')}
              >
                {t('dashManageProp')}
              </button>
              <button
                type="button"
                className={`tab-btn${activeView === 'settings' ? ' active' : ''}`}
                onClick={() => setActiveView('settings')}
              >
                {t('dashSettingsProp')}
              </button>
            </div>
            <div className="property-dashboard-actions">
              <Link
                className="secondary btn-sm"
                to={`/public/${selectedProperty.publicSlug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('dashViewPublicPage')}
              </Link>
              <button type="button" className="secondary btn-sm" onClick={handleCopyPublicLink}>
                {t('dashCopyPublicLink')}
              </button>
            </div>
          </div>

          {activeView === 'workspace' ? (
            <PropertyWorkspace
              key={`ws-${selectedProperty.id}`}
              property={selectedProperty}
              onOpenSettings={() => setActiveView('settings')}
            />
          ) : (
            <PropertySettings
              key={`set-${selectedProperty.id}`}
              property={selectedProperty}
              onUpdated={loadProperties}
            />
          )}
        </main>
      ) : null}

      {isJoinModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => !isJoining && setIsJoinModalOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="join-modal-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="join-modal-title">{t('dashJoinModalTitle')}</h2>
            <p>{t('dashJoinModalDesc')}</p>
            <form onSubmit={handleJoinProperty} className="modal-form">
              <label htmlFor="join-code">{t('dashJoinInputCode')}</label>
              <input
                id="join-code"
                type="text"
                required
                placeholder={t('dashJoinInputCodePlaceholder')}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                disabled={isJoining}
                maxLength={6}
                style={{ textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', fontSize: '1.25rem' }}
              />

              {joinError && (
                <div className="modal-errors" role="alert">
                  <span>{joinError}</span>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setIsJoinModalOpen(false)} disabled={isJoining}>
                  {t('dashJoinCancel')}
                </button>
                <button type="submit" className="primary" disabled={isJoining || joinCode.length < 5}>
                  {isJoining ? t('dashJoinSubmitting') : t('dashJoinSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
