import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocale } from '../i18n/LocaleContext'

interface EventFormModalProps {
  isOpen: boolean
  range: { start: Date; end: Date; displayEnd: Date } | null
  onSubmit: (payload: { title: string; description?: string; location?: string; start: Date; end: Date }) => void
  onCancel: () => void
  isSubmitting?: boolean
  errorMessage?: string | null
  mode?: 'create' | 'edit'
  initialValues?: { title?: string; description?: string; location?: string } | null
}

const hasExplicitTime = (date: Date) => date.getHours() !== 0 || date.getMinutes() !== 0
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fromDateInputValue = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null
  return parsed
}

export const EventFormModal = ({
  isOpen,
  range,
  onSubmit,
  onCancel,
  isSubmitting = false,
  errorMessage,
  mode = 'create',
  initialValues,
}: EventFormModalProps) => {
  const { t, locale } = useLocale()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const intlLocale = locale === 'pt' ? 'pt-BR' : 'es-ES'
  const formatter = new Intl.DateTimeFormat(intlLocale, { dateStyle: 'long' })
  const dateTimeFormatter = new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium', timeStyle: 'short' })

  const formatWithFallback = (fmt: Intl.DateTimeFormat, start: Date, end: Date) => {
    const f = fmt as Intl.DateTimeFormat & { formatRange?: (s: Date, e: Date) => string }
    return typeof f.formatRange === 'function' ? f.formatRange(start, end) : `${fmt.format(start)} → ${fmt.format(end)}`
  }

  const formatRange = (start: Date, displayEnd: Date) => {
    const sameDay = start.toDateString() === displayEnd.toDateString()
    const includesTime = hasExplicitTime(start) || hasExplicitTime(displayEnd)
    if (sameDay) return includesTime ? formatWithFallback(dateTimeFormatter, start, displayEnd) : formatter.format(start)
    if (includesTime) return formatWithFallback(dateTimeFormatter, start, displayEnd)
    return `${formatter.format(start)} → ${formatter.format(displayEnd)}`
  }

  useEffect(() => {
    if (isOpen && range) {
      setTitle(initialValues?.title ?? '')
      setDescription(initialValues?.description ?? '')
      setLocation(initialValues?.location ?? '')
      setStartDate(toDateInputValue(range.start))
      setEndDate(toDateInputValue(range.displayEnd))
      setLocalError(null)
      inputRef.current?.focus()
    }
  }, [initialValues?.description, initialValues?.location, initialValues?.title, isOpen, range])

  if (!isOpen || !range) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) { setLocalError(t('eventFormErrorName')); return }
    const parsedStart = fromDateInputValue(startDate)
    const parsedEndInclusive = fromDateInputValue(endDate)
    if (!parsedStart || !parsedEndInclusive) { setLocalError(t('eventFormErrorDates')); return }
    if (parsedEndInclusive < parsedStart) { setLocalError(t('eventFormErrorEndBeforeStart')); return }
    onSubmit({ title: trimmedTitle, description: description.trim() || undefined, location: location.trim() || undefined, start: parsedStart, end: addDays(parsedEndInclusive, 1) })
  }

  const previewStart = fromDateInputValue(startDate)
  const previewEnd = fromDateInputValue(endDate)
  const hasValidPreview = Boolean(previewStart && previewEnd && previewEnd >= previewStart)
  const rangeLabel = hasValidPreview && previewStart && previewEnd ? formatRange(previewStart, previewEnd) : formatRange(range.start, range.displayEnd)

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">{mode === 'edit' ? t('eventFormEdit') : t('eventFormNew')}</h2>
        <p className="modal-range">{rangeLabel}</p>
        <form onSubmit={handleSubmit} className="modal-form">
          <label htmlFor="event-start-date">{t('eventFormStartDate')}</label>
          <input id="event-start-date" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setLocalError(null) }} disabled={isSubmitting} />
          <label htmlFor="event-end-date">{t('eventFormEndDate')}</label>
          <input id="event-end-date" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setLocalError(null) }} disabled={isSubmitting} />
          <label htmlFor="event-title">{t('eventFormTitle')}</label>
          <input id="event-title" type="text" ref={inputRef} value={title} onChange={(e) => { setTitle(e.target.value); setLocalError(null) }} placeholder={t('eventFormTitlePlaceholder')} required disabled={isSubmitting} />
          <label htmlFor="event-location">{t('eventFormLocation')}</label>
          <input id="event-location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('eventFormLocationPlaceholder')} disabled={isSubmitting} />
          <label htmlFor="event-description">{t('eventFormDescription')}</label>
          <textarea id="event-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('eventFormDescriptionPlaceholder')} rows={3} disabled={isSubmitting} />
          <div className="modal-errors" role="alert">
            {localError && <span>{localError}</span>}
            {!localError && errorMessage && <span>{errorMessage}</span>}
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onCancel} disabled={isSubmitting}>{t('cancel')}</button>
            <button type="submit" className="primary" disabled={isSubmitting}>
              {isSubmitting ? t('eventFormSaving') : mode === 'edit' ? t('eventFormSaveChanges') : t('eventFormCreate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
