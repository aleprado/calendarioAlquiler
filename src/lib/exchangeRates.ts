export interface ExchangeRates {
  usdToArs: number
  usdToBrl: number
  source: 'live' | 'custom' | 'fallback'
  updatedAt: string
}

const DEFAULT_FALLBACK_RATES: ExchangeRates = {
  usdToArs: 1350,
  usdToBrl: 5.6,
  source: 'fallback',
  updatedAt: new Date().toISOString(),
}

let cachedRates: ExchangeRates | null = null
let lastFetchTime = 0
const CACHE_DURATION_MS = 60 * 60 * 1000 // 1 hour

export const fetchExchangeRates = async (customRates?: { usdToArs?: number; usdToBrl?: number } | null): Promise<ExchangeRates> => {
  const now = Date.now()

  // If custom rates are fully provided, use them directly
  if (customRates?.usdToArs && customRates?.usdToBrl) {
    return {
      usdToArs: customRates.usdToArs,
      usdToBrl: customRates.usdToBrl,
      source: 'custom',
      updatedAt: new Date().toISOString(),
    }
  }

  // Check cache
  if (cachedRates && now - lastFetchTime < CACHE_DURATION_MS) {
    return applyCustomOverrides(cachedRates, customRates)
  }

  try {
    const [arsRes, brlRes] = await Promise.all([
      fetch('https://dolarapi.com/v1/dolares/blue'),
      fetch('https://dolarapi.com/v1/cotizaciones/brl'),
    ])

    let usdToArs = DEFAULT_FALLBACK_RATES.usdToArs
    let usdToBrl = DEFAULT_FALLBACK_RATES.usdToBrl

    if (arsRes.ok) {
      const arsData = (await arsRes.json()) as { venta?: number; promedio?: number }
      if (arsData.venta && arsData.venta > 0) {
        usdToArs = arsData.venta
      }
    }

    if (brlRes.ok) {
      const brlData = (await brlRes.json()) as { venta?: number }
      // dolarapi BRL returns ARS per BRL (e.g. 240 ARS/BRL). USD/BRL = USD/ARS / BRL/ARS
      if (brlData.venta && brlData.venta > 0 && usdToArs > 0) {
        usdToBrl = Number((usdToArs / brlData.venta).toFixed(2))
      }
    }

    // Alternative USD/BRL direct fetch fallback if ratio was unusual
    if (usdToBrl <= 1 || usdToBrl >= 20) {
      try {
        const directBrl = await fetch('https://open.er-api.com/v6/latest/USD')
        if (directBrl.ok) {
          const directData = (await directBrl.json()) as { rates?: { BRL?: number } }
          if (directData.rates?.BRL) {
            usdToBrl = directData.rates.BRL
          }
        }
      } catch {
        // use fallback
      }
    }

    cachedRates = {
      usdToArs,
      usdToBrl: usdToBrl || DEFAULT_FALLBACK_RATES.usdToBrl,
      source: 'live',
      updatedAt: new Date().toISOString(),
    }
    lastFetchTime = now

    return applyCustomOverrides(cachedRates, customRates)
  } catch (error) {
    console.warn('[exchangeRates] Fallback rates used due to network issue:', error)
    cachedRates = DEFAULT_FALLBACK_RATES
    lastFetchTime = now
    return applyCustomOverrides(cachedRates, customRates)
  }
}

const applyCustomOverrides = (
  base: ExchangeRates,
  custom?: { usdToArs?: number; usdToBrl?: number } | null,
): ExchangeRates => {
  if (!custom) return base
  const usdToArs = custom.usdToArs && custom.usdToArs > 0 ? custom.usdToArs : base.usdToArs
  const usdToBrl = custom.usdToBrl && custom.usdToBrl > 0 ? custom.usdToBrl : base.usdToBrl
  const isCustom = Boolean(custom.usdToArs || custom.usdToBrl)

  return {
    usdToArs,
    usdToBrl,
    source: isCustom ? 'custom' : base.source,
    updatedAt: base.updatedAt,
  }
}
