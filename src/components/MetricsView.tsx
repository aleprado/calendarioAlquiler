import { useMemo, useState, useEffect } from 'react'
import type { CalendarEvent, PropertyDTO } from '../types'
import { fetchExchangeRates, type ExchangeRates } from '../lib/exchangeRates'

interface MetricsViewProps {
  property: PropertyDTO
  events: CalendarEvent[]
}

const formatCurrency = (amount: number, currency: 'USD' | 'ARS' | 'BRL') => {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
  }
  if (currency === 'ARS') {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(amount)
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const MetricsView = ({ property, events }: MetricsViewProps) => {
  const [rates, setRates] = useState<ExchangeRates | null>(null)

  useEffect(() => {
    let isMounted = true
    void fetchExchangeRates(property.quoterCustomExchangeRates).then((res) => {
      if (isMounted) setRates(res)
    })
    return () => {
      isMounted = false
    }
  }, [property.quoterCustomExchangeRates])

  const metrics = useMemo(() => {
    const today = startOfDay(new Date())
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const monthStart = new Date(currentYear, currentMonth, 1)
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)

    // Filter confirmed/active events
    const confirmedEvents = events.filter((e) => e.status === 'confirmed')
    const publicEvents = events.filter((e) => e.source === 'public')

    // Web Requests breakdown
    const pendingWebRequests = publicEvents.filter((e) => e.status === 'pending').length
    const confirmedWebRequests = publicEvents.filter((e) => e.status === 'confirmed').length
    const declinedWebRequests = publicEvents.filter((e) => e.status === 'declined').length
    const totalWebRequests = publicEvents.length

    // Channel breakdown (Confirmed & Tentative bookings count)
    const airbnbBookings = events.filter((e) => e.source === 'airbnb' && e.status !== 'declined').length
    const manualBookings = events.filter((e) => e.source === 'manual' && e.status !== 'declined').length
    const webBookings = confirmedWebRequests
    const totalBookingsCount = airbnbBookings + manualBookings + webBookings

    // Occupancy calculation for current month
    const occupiedDaysSet = new Set<number>()
    confirmedEvents.forEach((evt) => {
      const start = startOfDay(evt.start)
      const end = startOfDay(evt.end)
      
      const cursor = new Date(start.getTime())
      while (cursor < end) {
        if (cursor >= monthStart && cursor <= monthEnd) {
          occupiedDaysSet.add(cursor.getDate())
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    })

    const monthOccupiedDays = occupiedDaysSet.size
    const monthOccupancyPercent = Math.min(100, Math.round((monthOccupiedDays / daysInMonth) * 100))

    // Next 30 days occupancy
    const next30DaysSet = new Set<string>()
    const next30End = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    confirmedEvents.forEach((evt) => {
      const start = startOfDay(evt.start)
      const end = startOfDay(evt.end)
      
      const cursor = new Date(start.getTime())
      while (cursor < end) {
        if (cursor >= today && cursor < next30End) {
          next30DaysSet.add(cursor.toISOString().slice(0, 10))
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    })
    const next30OccupancyPercent = Math.min(100, Math.round((next30DaysSet.size / 30) * 100))

    // Financial revenue calculation (Estimated based on reserved nights and monthly rates)
    let totalRevenueUSD = 0
    let totalNightsBooked = 0

    confirmedEvents.forEach((evt) => {
      const start = startOfDay(evt.start)
      const end = startOfDay(evt.end)
      const cursor = new Date(start.getTime())

      while (cursor < end) {
        const monthKey = String(cursor.getMonth() + 1)
        const nightRate = property.quoterMonthlyRatesUSD?.[monthKey] ?? property.quoterMonthlyRatesUSD?.['default'] ?? 50
        totalRevenueUSD += nightRate
        totalNightsBooked++
        cursor.setDate(cursor.getDate() + 1)
      }
    })

    // Add cleaning fees for confirmed reservations
    const cleaningFeeTotalUSD = confirmedEvents.length * (property.quoterCleaningFeeUSD ?? 0)
    totalRevenueUSD += cleaningFeeTotalUSD

    const avgStayNights = totalBookingsCount > 0 ? (totalNightsBooked / totalBookingsCount).toFixed(1) : '0'

    // Conversion rate
    const publicViews = property.publicViewsCount ?? 0
    const conversionRate = publicViews > 0 ? ((totalWebRequests / publicViews) * 100).toFixed(1) : '0'

    return {
      publicViews,
      publicQuotes: property.publicQuotesCount ?? 0,
      totalWebRequests,
      pendingWebRequests,
      confirmedWebRequests,
      declinedWebRequests,
      airbnbBookings,
      manualBookings,
      webBookings,
      totalBookingsCount,
      monthOccupiedDays,
      daysInMonth,
      monthOccupancyPercent,
      next30OccupancyPercent,
      totalRevenueUSD,
      totalNightsBooked,
      avgStayNights,
      conversionRate,
    }
  }, [events, property])

  return (
    <div className="metrics-view">
      <header className="metrics-header">
        <div>
          <h2>Métricas y Estadísticas</h2>
          <p className="subtitle">
            Rendimiento del alojamiento, tráfico web de la vista pública e indicadores clave.
          </p>
        </div>
      </header>

      {/* KPI Cards Grid */}
      <div className="metrics-kpi-grid">
        <div className="kpi-card kpi-card--views">
          <div className="kpi-card__icon">👁️</div>
          <div className="kpi-card__content">
            <span className="kpi-card__label">Visitas a la Vista Pública</span>
            <strong className="kpi-card__value">{metrics.publicViews}</strong>
            <span className="kpi-card__subtext">Visitantes únicos en la web</span>
          </div>
        </div>

        <div className="kpi-card kpi-card--quotes">
          <div className="kpi-card__icon">🧮</div>
          <div className="kpi-card__content">
            <span className="kpi-card__label">Cotizaciones Calculadas</span>
            <strong className="kpi-card__value">{metrics.publicQuotes}</strong>
            <span className="kpi-card__subtext">Consultas de precio en el cotizador</span>
          </div>
        </div>

        <div className="kpi-card kpi-card--requests">
          <div className="kpi-card__icon">📩</div>
          <div className="kpi-card__content">
            <span className="kpi-card__label">Solicitudes Web</span>
            <strong className="kpi-card__value">{metrics.totalWebRequests}</strong>
            <span className="kpi-card__subtext">
              {metrics.pendingWebRequests} pendientes · {metrics.confirmedWebRequests} confirmadas
            </span>
          </div>
        </div>

        <div className="kpi-card kpi-card--conversion">
          <div className="kpi-card__icon">📈</div>
          <div className="kpi-card__content">
            <span className="kpi-card__label">Tasa de Conversión Web</span>
            <strong className="kpi-card__value">{metrics.conversionRate}%</strong>
            <span className="kpi-card__subtext">Solicitudes por cada 100 visitas</span>
          </div>
        </div>
      </div>

      {/* Main Analysis Section */}
      <div className="metrics-sections-grid">
        {/* Occupancy Card */}
        <section className="card metrics-card">
          <h3>📅 Nivel de Ocupación</h3>
          <p className="subtitle">Días ocupados según reservas y bloqueos confirmados.</p>

          <div className="occupancy-display">
            <div className="occupancy-metric">
              <div className="occupancy-metric__header">
                <span>Ocupación de este mes ({metrics.monthOccupiedDays} de {metrics.daysInMonth} días)</span>
                <strong>{metrics.monthOccupancyPercent}%</strong>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar__fill progress-bar__fill--primary"
                  style={{ width: `${metrics.monthOccupancyPercent}%` }}
                />
              </div>
            </div>

            <div className="occupancy-metric">
              <div className="occupancy-metric__header">
                <span>Ocupación próximos 30 días</span>
                <strong>{metrics.next30OccupancyPercent}%</strong>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar__fill progress-bar__fill--secondary"
                  style={{ width: `${metrics.next30OccupancyPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="occupancy-stats-footer">
            <div className="stat-pill">
              <span>Noches Totales Reservadas:</span>
              <strong>{metrics.totalNightsBooked} noches</strong>
            </div>
            <div className="stat-pill">
              <span>Promedio por Reserva:</span>
              <strong>{metrics.avgStayNights} noches</strong>
            </div>
          </div>
        </section>

        {/* Channel Distribution Card */}
        <section className="card metrics-card">
          <h3>📊 Origen de Reservas</h3>
          <p className="subtitle">Distribución de reservas por canal de procedencia.</p>

          {metrics.totalBookingsCount === 0 ? (
            <p className="empty-state-text">Aún no hay reservas registradas para generar el desglose por canal.</p>
          ) : (
            <div className="channel-distribution">
              <div className="channel-progress">
                {metrics.airbnbBookings > 0 && (
                  <div
                    className="channel-progress__segment channel-progress__segment--airbnb"
                    style={{ width: `${(metrics.airbnbBookings / metrics.totalBookingsCount) * 100}%` }}
                    title={`Airbnb: ${metrics.airbnbBookings}`}
                  />
                )}
                {metrics.manualBookings > 0 && (
                  <div
                    className="channel-progress__segment channel-progress__segment--manual"
                    style={{ width: `${(metrics.manualBookings / metrics.totalBookingsCount) * 100}%` }}
                    title={`Manual: ${metrics.manualBookings}`}
                  />
                )}
                {metrics.webBookings > 0 && (
                  <div
                    className="channel-progress__segment channel-progress__segment--web"
                    style={{ width: `${(metrics.webBookings / metrics.totalBookingsCount) * 100}%` }}
                    title={`Web Pública: ${metrics.webBookings}`}
                  />
                )}
              </div>

              <ul className="channel-legend">
                <li>
                  <span className="legend-dot legend-dot--airbnb" />
                  <span>Airbnb:</span>
                  <strong>{metrics.airbnbBookings} reservas ({Math.round((metrics.airbnbBookings / metrics.totalBookingsCount) * 100)}%)</strong>
                </li>
                <li>
                  <span className="legend-dot legend-dot--manual" />
                  <span>Carga Manual:</span>
                  <strong>{metrics.manualBookings} reservas ({Math.round((metrics.manualBookings / metrics.totalBookingsCount) * 100)}%)</strong>
                </li>
                <li>
                  <span className="legend-dot legend-dot--web" />
                  <span>Solicitudes Web:</span>
                  <strong>{metrics.webBookings} reservas ({Math.round((metrics.webBookings / metrics.totalBookingsCount) * 100)}%)</strong>
                </li>
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* Revenue & Financial Estimation */}
      <section className="card metrics-card revenue-card">
        <div className="revenue-card__header">
          <div>
            <h3>💵 Ingresos Estimados por Reservas</h3>
            <p className="subtitle">Estimación calculada a partir de las tarifas configuradas por mes y noches confirmadas.</p>
          </div>
          <div className="revenue-main-badge">
            <span className="revenue-label">Total Reservado (USD)</span>
            <strong className="revenue-amount">{formatCurrency(metrics.totalRevenueUSD, 'USD')}</strong>
          </div>
        </div>

        {rates && (
          <div className="revenue-currencies-grid">
            <div className="revenue-currency-box">
              <span>Pesos Argentinos (ARS)</span>
              <strong>{formatCurrency(metrics.totalRevenueUSD * rates.usdToArs, 'ARS')}</strong>
              <small>1 USD = ${rates.usdToArs.toLocaleString('es-AR')}</small>
            </div>
            <div className="revenue-currency-box">
              <span>Reales Brasileños (BRL)</span>
              <strong>{formatCurrency(metrics.totalRevenueUSD * rates.usdToBrl, 'BRL')}</strong>
              <small>1 USD = R$ {rates.usdToBrl.toFixed(2)}</small>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
