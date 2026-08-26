import { useMemo, useState, useEffect } from 'react'
import type { CalendarEvent, PropertyDTO } from '../types'
import { fetchExchangeRates, type ExchangeRates } from '../lib/exchangeRates'
import { useLocale } from '../i18n/LocaleContext'

interface MetricsViewProps {
  property: PropertyDTO
  events: CalendarEvent[]
}

const formatCurrency = (amount: number, currency: 'USD' | 'ARS' | 'BRL') => {
  if (currency === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
  if (currency === 'ARS') return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(amount)
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const MetricsView = ({ property, events }: MetricsViewProps) => {
  const { t } = useLocale()
  const [rates, setRates] = useState<ExchangeRates | null>(null)

  useEffect(() => {
    let isMounted = true
    void fetchExchangeRates(property.quoterCustomExchangeRates).then((res) => { if (isMounted) setRates(res) })
    return () => { isMounted = false }
  }, [property.quoterCustomExchangeRates])

  const stats = useMemo(() => {
    const publicViews = property.publicViewsCount ?? 0
    const publicQuotes = property.publicQuotesCount ?? 0
    const publicRequests = events.filter((e) => e.source === 'public')
    const webRequestsCount = publicRequests.length
    const webRequestsPending = publicRequests.filter((e) => e.status === 'pending').length
    const webRequestsConfirmed = publicRequests.filter((e) => e.status === 'confirmed').length
    const conversionRate = publicViews > 0 ? ((webRequestsCount / publicViews) * 100).toFixed(1) : '0.0'

    const today = startOfDay(new Date())
    const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

    let thisMonthOccupied = 0
    let next30Occupied = 0
    const MS_IN_DAY = 24 * 60 * 60 * 1000
    const activeEvents = events.filter((e) => e.status !== 'declined' && e.status !== 'pending')

    for (let d = new Date(startOfThisMonth); d <= endOfThisMonth; d = new Date(d.getTime() + MS_IN_DAY)) {
      if (activeEvents.some((e) => e.start <= d && e.end > d)) thisMonthOccupied++
    }

    for (let d = new Date(today); d < next30Days; d = new Date(d.getTime() + MS_IN_DAY)) {
      if (activeEvents.some((e) => e.start <= d && e.end > d)) next30Occupied++
    }

    const thisMonthDays = endOfThisMonth.getDate()
    const thisMonthOccPercent = Math.round((thisMonthOccupied / thisMonthDays) * 100)
    const next30OccPercent = Math.round((next30Occupied / 30) * 100)

    const confirmedEvents = activeEvents.filter((e) => e.status === 'confirmed')
    let totalConfirmedNights = 0
    let estimatedRevenueUSD = 0

    confirmedEvents.forEach((ev) => {
      const eStart = new Date(ev.start); const eEnd = new Date(ev.end)
      let nights = 0
      for (let cursor = new Date(eStart); cursor < eEnd; cursor.setDate(cursor.getDate() + 1)) {
        nights++
        const mKey = String(cursor.getMonth() + 1)
        estimatedRevenueUSD += property.quoterMonthlyRatesUSD?.[mKey] ?? property.quoterMonthlyRatesUSD?.['default'] ?? 0
      }
      totalConfirmedNights += nights
    })

    const sourceCount = activeEvents.reduce((acc, ev) => {
      const src = ev.source || 'manual'
      acc[src] = (acc[src] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      publicViews, publicQuotes, webRequestsCount, webRequestsPending, webRequestsConfirmed, conversionRate,
      thisMonthOccPercent, thisMonthOccupied, thisMonthDays, next30OccPercent, next30Occupied,
      totalConfirmedNights, avgStay: confirmedEvents.length > 0 ? (totalConfirmedNights / confirmedEvents.length).toFixed(1) : '0',
      sourceCount, totalActiveEvents: activeEvents.length, estimatedRevenueUSD,
    }
  }, [events, property])

  return (
    <div className="metrics-layout animate-fade-in">
      <div className="metrics-header">
        <h2>{t('metricsTitle')}</h2>
        <p>{t('metricsSubtitle')}</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card__value">{stats.publicViews}</div>
          <div className="metric-card__title">{t('metricsViews')}</div>
          <div className="metric-card__sub">{t('metricsViewsSub')}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card__value">{stats.publicQuotes}</div>
          <div className="metric-card__title">{t('metricsQuotes')}</div>
          <div className="metric-card__sub">{t('metricsQuotesSub')}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card__value">{stats.webRequestsCount}</div>
          <div className="metric-card__title">{t('metricsRequests')}</div>
          <div className="metric-card__sub">
            <span style={{ color: '#d97706' }}>{stats.webRequestsPending} {t('metricsPending')}</span> /{' '}
            <span style={{ color: '#059669' }}>{stats.webRequestsConfirmed} {t('metricsConfirmed')}</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card__value">{stats.conversionRate}%</div>
          <div className="metric-card__title">{t('metricsConversion')}</div>
          <div className="metric-card__sub">{t('metricsConversionSub')}</div>
        </div>
      </div>

      <div className="metrics-sections">
        <div className="metrics-section-card">
          <h3>{t('metricsOccupancy')}</h3>
          <p className="metrics-section-desc">{t('metricsOccupancySub')}</p>
          <div className="progress-bars-container">
            <div className="progress-item">
              <div className="progress-item__header">
                <span>{t('metricsThisMonth')}</span>
                <strong>{stats.thisMonthOccPercent}%</strong>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${stats.thisMonthOccPercent}%` }} />
              </div>
              <div className="progress-item__hint">{stats.thisMonthOccupied} / {stats.thisMonthDays} {t('metricsDays')}</div>
            </div>
            <div className="progress-item">
              <div className="progress-item__header">
                <span>{t('metricsNext30')}</span>
                <strong>{stats.next30OccPercent}%</strong>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${stats.next30OccPercent}%`, backgroundColor: '#3b82f6' }} />
              </div>
              <div className="progress-item__hint">{stats.next30Occupied} / 30 {t('metricsDays')}</div>
            </div>
          </div>
          <div className="metrics-summary-row" style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <span>{t('metricsNightsBooked')} <strong>{stats.totalConfirmedNights}</strong></span>
            <span>{t('metricsAvgStay')} <strong>{stats.avgStay} {t('metricsDays')}</strong></span>
          </div>
        </div>

        <div className="metrics-section-card">
          <h3>{t('metricsOrigin')}</h3>
          <p className="metrics-section-desc">{t('metricsOriginSub')}</p>
          {stats.totalActiveEvents === 0 ? (
            <div className="empty-state-small">{t('metricsNoBookings')}</div>
          ) : (
            <div className="source-breakdown">
              <div className="source-item">
                <div className="source-item__label">
                  <span className="source-dot" style={{ backgroundColor: '#ff5a5f' }} />
                  {t('metricsAirbnb')}
                </div>
                <strong>{stats.sourceCount['airbnb'] || 0} {t('metricsReservations')}</strong>
              </div>
              <div className="source-item">
                <div className="source-item__label">
                  <span className="source-dot" style={{ backgroundColor: '#64748b' }} />
                  {t('metricsManual')}
                </div>
                <strong>{stats.sourceCount['manual'] || 0} {t('metricsReservations')}</strong>
              </div>
              <div className="source-item">
                <div className="source-item__label">
                  <span className="source-dot" style={{ backgroundColor: '#0ea5e9' }} />
                  {t('metricsWeb')}
                </div>
                <strong>{stats.sourceCount['public'] || 0} {t('metricsReservations')}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="metrics-section-card metrics-section-card--revenue">
        <h3>{t('metricsRevenue')}</h3>
        <p className="metrics-section-desc">{t('metricsRevenueSub')}</p>
        <div className="revenue-showcase">
          <div className="revenue-main">
            <span className="revenue-main__label">{t('metricsRevenueTotal')}</span>
            <span className="revenue-main__value">{formatCurrency(stats.estimatedRevenueUSD, 'USD')}</span>
          </div>
          {rates && (
            <div className="revenue-converted">
              <div className="revenue-converted__item">
                <span>{t('metricsPesos')}</span>
                <strong>{formatCurrency(stats.estimatedRevenueUSD * rates.usdToArs, 'ARS')}</strong>
              </div>
              <div className="revenue-converted__item">
                <span>{t('metricsReales')}</span>
                <strong>{formatCurrency(stats.estimatedRevenueUSD * rates.usdToBrl, 'BRL')}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
