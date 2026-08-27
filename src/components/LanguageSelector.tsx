import { useLocale } from '../i18n/LocaleContext'

export const LanguageSelector = () => {
  const { locale, setLocale } = useLocale()

  return (
    <div className="language-selector" aria-label="Seleccionar idioma">
      <button
        type="button"
        className={`language-selector__btn${locale === 'es' ? ' language-selector__btn--active' : ''}`}
        onClick={() => setLocale('es')}
        title="Español"
      >
        <span className="language-selector__flag">🇦🇷</span>
        <span>ES</span>
      </button>
      <button
        type="button"
        className={`language-selector__btn${locale === 'pt' ? ' language-selector__btn--active' : ''}`}
        onClick={() => setLocale('pt')}
        title="Português"
      >
        <span className="language-selector__flag">🇧🇷</span>
        <span>PT</span>
      </button>
    </div>
  )
}

