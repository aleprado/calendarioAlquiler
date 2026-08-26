import { useEffect, useMemo, useState } from 'react'
import { fetchExchangeRates, type ExchangeRates } from '../lib/exchangeRates'

interface CotizadorWidgetProps {
  mode: 'private' | 'public'
  monthlyRatesUSD?: Record<string, number>
  adminCommissionPercent?: number
  cleaningFeeUSD?: number
  customExchangeRates?: { usdToArs?: number; usdToBrl?: number } | null
  blockedEvents?: { start: string; end: string }[]
  checkInTime?: string
  checkOutTime?: string
  initialStartDate?: string
  initialEndDate?: string
  onDatesChange?: (startStr: string, endStr: string) => void
  onQuoteCalculated?: (startStr: string, endStr: string) => void
  onRequestReservation?: (startStr: string, endStr: string) => void
  onOpenSettings?: () => void
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]



const formatDateLocal = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDateDisplay = (d: Date) => {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

const formatCurrency = (amount: number, currency: 'USD' | 'ARS' | 'BRL') => {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount)
  }
  if (currency === 'ARS') {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(amount)
}

export const CotizadorWidget = ({
  mode,
  monthlyRatesUSD = {},
  adminCommissionPercent = 0,
  cleaningFeeUSD = 0,
  customExchangeRates,
  blockedEvents = [],
  checkInTime = '15:00',
  checkOutTime = '11:00',
  initialStartDate,
  initialEndDate,
  onDatesChange,
  onQuoteCalculated,
  onRequestReservation,
  onOpenSettings,
}: CotizadorWidgetProps) => {
  const today = new Date()
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const defaultEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)

  const [startDateStr, setStartDateStr] = useState(initialStartDate || formatDateLocal(defaultStart))
  const [endDateStr, setEndDateStr] = useState(initialEndDate || formatDateLocal(defaultEnd))
  const [rates, setRates] = useState<ExchangeRates | null>(null)
  const [loadingRates, setLoadingRates] = useState(true)
  const [showInfoDetails, setShowInfoDetails] = useState(false)

  useEffect(() => {
    if (initialStartDate) {
      setStartDateStr(initialStartDate)
    }
  }, [initialStartDate])

  useEffect(() => {
    if (initialEndDate) {
      setEndDateStr(initialEndDate)
    }
  }, [initialEndDate])

  useEffect(() => {
    let isMounted = true
    const loadRates = async () => {
      setLoadingRates(true)
      const res = await fetchExchangeRates(customExchangeRates)
      if (isMounted) {
        setRates(res)
        setLoadingRates(false)
      }
    }
    void loadRates()
    return () => {
      isMounted = false
    }
  }, [customExchangeRates])

  const calculation = useMemo(() => {
    const startParts = startDateStr.split('-').map(Number)
    const endParts = endDateStr.split('-').map(Number)

    if (startParts.length !== 3 || endParts.length !== 3) {
      return null
    }

    const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2])
    const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2])

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      return null
    }

    const nights: { date: Date; dateKey: string; monthIndex: number; monthName: string; year: number; nightRateUSD: number }[] = []
    const cursor = new Date(startDate.getTime())

    while (cursor < endDate) {
      const year = cursor.getFullYear()
      const monthIndex = cursor.getMonth()
      const monthKey = String(monthIndex + 1)
      const dateKey = formatDateLocal(cursor)

      // Rate configured for that month is the price per night (USD/noche)
      const nightRateUSD = monthlyRatesUSD[monthKey] ?? monthlyRatesUSD['default'] ?? 50

      nights.push({
        date: new Date(cursor.getTime()),
        dateKey,
        monthIndex,
        monthName: MONTH_NAMES[monthIndex],
        year,
        nightRateUSD,
      })

      cursor.setDate(cursor.getDate() + 1)
    }

    // Build set of occupied night date keys (YYYY-MM-DD) from all sources (Airbnb iCal + app direct requests)
    const occupiedNightKeys = new Set<string>()
    if (blockedEvents && blockedEvents.length > 0) {
      for (const evt of blockedEvents) {
        const sMatch = evt.start.match(/^(\d{4}-\d{2}-\d{2})/)
        const eMatch = evt.end.match(/^(\d{4}-\d{2}-\d{2})/)

        let sDate: Date
        let eDate: Date

        if (sMatch && eMatch) {
          const sP = sMatch[1].split('-').map(Number)
          const eP = eMatch[1].split('-').map(Number)
          sDate = new Date(sP[0], sP[1] - 1, sP[2])
          eDate = new Date(eP[0], eP[1] - 1, eP[2])
        } else {
          sDate = new Date(evt.start)
          eDate = new Date(evt.end)
        }

        const evtCursor = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate())
        const evtEnd = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate())

        while (evtCursor < evtEnd) {
          occupiedNightKeys.add(formatDateLocal(evtCursor))
          evtCursor.setDate(evtCursor.getDate() + 1)
        }
      }
    }

    let blockedNightCount = 0
    for (const n of nights) {
      if (occupiedNightKeys.has(n.dateKey)) {
        blockedNightCount++
      }
    }

    const hasBlockedConflict = blockedNightCount > 0
    const baseStayUSD = nights.reduce((acc, curr) => acc + curr.nightRateUSD, 0)
    const commissionUSD = adminCommissionPercent > 0 ? baseStayUSD * (adminCommissionPercent / 100) : 0
    const cleaningUSD = cleaningFeeUSD > 0 ? cleaningFeeUSD : 0

    const totalUSD = baseStayUSD + commissionUSD + cleaningUSD
    const totalNights = nights.length
    const avgNightUSD = totalNights > 0 ? totalUSD / totalNights : 0

    return {
      startDate,
      endDate,
      totalNights,
      nights,
      baseStayUSD,
      commissionUSD,
      cleaningUSD,
      totalUSD,
      avgNightUSD,
      hasBlockedConflict,
      blockedNightCount,
    }
  }, [startDateStr, endDateStr, monthlyRatesUSD, mode, adminCommissionPercent, cleaningFeeUSD, blockedEvents])

  const converted = useMemo(() => {
    if (!calculation || !rates) return null

    const { totalUSD, avgNightUSD, baseStayUSD, commissionUSD, cleaningUSD } = calculation
    const { usdToArs, usdToBrl } = rates

    return {
      totalUSD,
      totalARS: totalUSD * usdToArs,
      totalBRL: totalUSD * usdToBrl,

      avgNightUSD,
      avgNightARS: avgNightUSD * usdToArs,
      avgNightBRL: avgNightUSD * usdToBrl,

      baseStayUSD,
      baseStayARS: baseStayUSD * usdToArs,
      baseStayBRL: baseStayUSD * usdToBrl,

      commissionUSD,
      commissionARS: commissionUSD * usdToArs,
      commissionBRL: commissionUSD * usdToBrl,

      cleaningUSD,
      cleaningARS: cleaningUSD * usdToArs,
      cleaningBRL: cleaningUSD * usdToBrl,
    }
  }, [calculation, rates])

  useEffect(() => {
    if (mode === 'public' && calculation && !calculation.hasBlockedConflict && calculation.totalNights > 0 && onQuoteCalculated) {
      onQuoteCalculated(startDateStr, endDateStr)
    }
  }, [mode, calculation, startDateStr, endDateStr, onQuoteCalculated])

  return (
    <section className={`card cotizador-card${mode === 'private' ? ' cotizador-card--private' : ''}`}>
      <div className="cotizador-header">
        <div>
          <h3>Cotizador de estadía</h3>
          <p className="subtitle">
            {mode === 'private'
              ? 'Calcula tarifas con comisión y limpieza (solo visible para ti)'
              : 'Cotiza el costo estimado de tu hospedaje'}
          </p>
        </div>
        {mode === 'private' && onOpenSettings && (
          <button type="button" className="secondary btn-sm" onClick={onOpenSettings}>
            Configurar tarifas
          </button>
        )}
      </div>

      <div className="cotizador-form-grid">
        <div className="form-group">
          <label htmlFor="cotizador-start">Fecha de llegada</label>
          <input
            id="cotizador-start"
            type="date"
            value={startDateStr}
            onChange={(e) => {
              const val = e.target.value
              setStartDateStr(val)
              onDatesChange?.(val, endDateStr)
            }}
          />
        </div>
        <div className="form-group">
          <label htmlFor="cotizador-end">Fecha de salida</label>
          <input
            id="cotizador-end"
            type="date"
            value={endDateStr}
            min={startDateStr}
            onChange={(e) => {
              const val = e.target.value
              setEndDateStr(val)
              onDatesChange?.(startDateStr, val)
            }}
          />
        </div>
      </div>

      {loadingRates ? (
        <div className="loading loading--inline">Cargando cotizaciones de cambio...</div>
      ) : !calculation || !converted ? (
        <div className="alert alert--inline" role="alert">
          Selecciona una fecha de salida posterior a la fecha de llegada.
        </div>
      ) : calculation.hasBlockedConflict ? (
        <div className="cotizador-blocked-alert" role="alert">
          <div className="cotizador-blocked-alert__icon">⛔</div>
          <div className="cotizador-blocked-alert__info">
            <strong>Fechas No Disponibles</strong>
            <p>
              El rango seleccionado (del {formatDateDisplay(calculation.startDate)} al {formatDateDisplay(calculation.endDate)}) incluye{' '}
              <strong>
                {calculation.blockedNightCount} {calculation.blockedNightCount === 1 ? 'noche ocupada' : 'noches ocupadas'}
              </strong>{' '}
              en el calendario. Consulta el calendario para elegir fechas libres.
            </p>
          </div>
        </div>
      ) : (
        <div className="cotizador-results">
          <div className="cotizador-summary-header">
            <span className="cotizador-nights-badge cotizador-nights-badge--available">
              ✓ {calculation.totalNights} {calculation.totalNights === 1 ? 'noche' : 'noches'} (Check-in {checkInTime} hs — Check-out {checkOutTime} hs)
            </span>
          </div>

          <div className="cotizador-currencies-grid">
            <div className="currency-card currency-card--usd">
              <span className="currency-card__code">Dólares (USD)</span>
              <strong className="currency-card__total">{formatCurrency(converted.totalUSD, 'USD')}</strong>
              <span className="currency-card__per-night">{formatCurrency(converted.avgNightUSD, 'USD')} / noche</span>
            </div>
            <div className="currency-card currency-card--ars">
              <span className="currency-card__code">Pesos Arg (ARS)</span>
              <strong className="currency-card__total">{formatCurrency(converted.totalARS, 'ARS')}</strong>
              <span className="currency-card__per-night">{formatCurrency(converted.avgNightARS, 'ARS')} / noche</span>
            </div>
            <div className="currency-card currency-card--brl">
              <span className="currency-card__code">Reales (BRL)</span>
              <strong className="currency-card__total">{formatCurrency(converted.totalBRL, 'BRL')}</strong>
              <span className="currency-card__per-night">{formatCurrency(converted.avgNightBRL, 'BRL')} / noche</span>
            </div>
          </div>

          {onRequestReservation && (
            <button
              type="button"
              className="primary cotizador-request-btn"
              onClick={() => onRequestReservation(startDateStr, endDateStr)}
            >
              Solicitar reserva ({calculation.totalNights} {calculation.totalNights === 1 ? 'noche' : 'noches'})
            </button>
          )}

          {(mode === 'private' || adminCommissionPercent > 0 || cleaningFeeUSD > 0) && (
            <div className="cotizador-private-breakdown">
              <div className="breakdown-item">
                <span>Subtotal hospedaje:</span>
                <strong>{formatCurrency(converted.baseStayUSD, 'USD')}</strong>
              </div>
              {adminCommissionPercent > 0 && (
                <div className="breakdown-item">
                  <span>Comisión administración ({adminCommissionPercent}%):</span>
                  <strong>+{formatCurrency(converted.commissionUSD, 'USD')}</strong>
                </div>
              )}
              {cleaningFeeUSD > 0 && (
                <div className="breakdown-item">
                  <span>Monto de limpieza:</span>
                  <strong>+{formatCurrency(converted.cleaningUSD, 'USD')}</strong>
                </div>
              )}
            </div>
          )}

          <div className="cotizador-audit-toggle">
            <button
              type="button"
              className="link-button"
              onClick={() => setShowInfoDetails((prev) => !prev)}
            >
              {showInfoDetails ? 'Ocultar detalles de conversión' : 'Ver datos de cálculo y tipo de cambio'}
            </button>
          </div>

          {showInfoDetails && rates && (
            <div className="cotizador-audit-box">
              <h4>Información de conversión y tipos de cambio</h4>
              <ul className="audit-rates-list">
                <li>
                  <strong>Cotización USD / ARS:</strong> 1 USD = ${rates.usdToArs.toLocaleString('es-AR')} ARS
                </li>
                <li>
                  <strong>Cotización USD / BRL:</strong> 1 USD = R$ {rates.usdToBrl.toFixed(2)} BRL
                </li>
                <li>
                  <strong>Origen de la tasa:</strong>{' '}
                  {rates.source === 'custom'
                    ? 'Cotización personalizada'
                    : rates.source === 'live'
                      ? 'Dólar API (actualizada en tiempo real)'
                      : 'Cotización de respaldo'}
                </li>
              </ul>

              <h5>Desglose por noches y meses:</h5>
              <div className="audit-months-table">
                {Array.from(new Set(calculation.nights.map((n) => `${n.monthName} ${n.year}`))).map((monthLabel) => {
                  const sample = calculation.nights.find((n) => `${n.monthName} ${n.year}` === monthLabel)
                  const count = calculation.nights.filter((n) => `${n.monthName} ${n.year}` === monthLabel).length
                  if (!sample) return null
                  return (
                    <div key={monthLabel} className="audit-month-row">
                      <span>
                        {monthLabel} ({count} {count === 1 ? 'noche' : 'noches'}):
                      </span>
                      <span>
                        {formatCurrency(sample.nightRateUSD, 'USD')}/noche &times; {count} {count === 1 ? 'noche' : 'noches'} = {formatCurrency(sample.nightRateUSD * count, 'USD')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
