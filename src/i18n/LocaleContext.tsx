import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { translations, type Locale, type TranslationKey } from './translations'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'es',
  setLocale: () => undefined,
  t: (key) => translations.es[key],
})

const getInitialLocale = (): Locale => {
  try {
    const stored = localStorage.getItem('locale')
    if (stored === 'es' || stored === 'pt') return stored
  } catch {
    // ignore
  }
  return 'es'
}

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try { localStorage.setItem('locale', next) } catch { /* ignore */ }
  }, [])

  const t = useCallback((key: TranslationKey): string => translations[locale][key], [locale])

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
}

export const useLocale = () => useContext(LocaleContext)
