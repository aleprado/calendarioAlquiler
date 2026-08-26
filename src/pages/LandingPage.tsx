import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Logo } from '../components/Logo'
import { LanguageSelector } from '../components/LanguageSelector'
import { useLocale } from '../i18n/LocaleContext'

export const LandingPage = () => {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const { t } = useLocale()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, navigate, user])

  const handleSignIn = async () => {
    setError(null)
    try {
      await signIn()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('landingSignIn'))
    }
  }

  return (
    <div className="landing-layout">
      <main className="landing-main">
        <header className="landing-hero landing-hero--centered">
          <Logo size="lg" showText={false} className="landing-logo" />
          <h1>
            simplealquiler<span>.net</span>
          </h1>
          <p>{t('landingTagline')}</p>
          <button type="button" className="primary" onClick={handleSignIn} disabled={loading}>
            {loading ? t('loading') : t('landingSignIn')}
          </button>
          {error && <p className="alert alert--inline">{error}</p>}
        </header>
        <section className="landing-features">
          <h2>{t('landingAll')}</h2>
          <ul>
            <li>{t('landingFeature1')}</li>
            <li>{t('landingFeature2')}</li>
            <li>{t('landingFeature3')}</li>
          </ul>
        </section>
        <div className="landing-language">
          <LanguageSelector />
        </div>
      </main>
    </div>
  )
}
