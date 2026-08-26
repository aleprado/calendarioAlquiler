import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocale } from '../i18n/LocaleContext'

interface RequestFormModalProps {
  isOpen: boolean
  range: { start: Date; end: Date; displayEnd: Date } | null
  onSubmit: (payload: { name: string; email?: string; phone?: string; notes?: string; start: Date; end: Date }) => void
  onCancel: () => void
  isSubmitting?: boolean
  errorMessage?: string | null
}

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fromDateInputValue = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null
  return parsed
}

export const RequestFormModal = ({
  isOpen,
  range,
  onSubmit,
  onCancel,
  isSubmitting = false,
  errorMessage,
}: RequestFormModalProps) => {
  const { t, locale } = useLocale()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const formatter = new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : 'es-ES', { dateStyle: 'long' })
  const formatRange = (start: Date, end: Date) =>
    formatter.formatRange?.(start, end) ?? `${formatter.format(start)} → ${formatter.format(end)}`

  useEffect(() => {
    if (isOpen && range) {
      setName('')
      setEmail('')
      setPhone('')
      setNotes('')
      setStartDate(toDateInputValue(range.start))
      setEndDate(toDateInputValue(range.end))
      setLocalError(null)
      nameRef.current?.focus()
    }
  }, [isOpen, range])

  if (!isOpen || !range) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setLocalError(t('requestErrorName')); return }

    const sMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate)
    const eMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endDate)
    if (!sMatch || !eMatch) { setLocalError(t('requestErrorDates')); return }

    const startLocal = new Date(Number(sMatch[1]), Number(sMatch[2]) - 1, Number(sMatch[3]))
    const endLocal = new Date(Number(eMatch[1]), Number(eMatch[2]) - 1, Number(eMatch[3]))

    if (endLocal <= startLocal) { setLocalError(t('requestErrorEndBeforeStart')); return }

    onSubmit({
      name: trimmed,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      start: startLocal,
      end: endLocal,
    })
  }

  const previewStart = fromDateInputValue(startDate)
  const previewEnd = fromDateInputValue(endDate)
  const rangeLabel =
    previewStart && previewEnd && previewEnd >= previewStart ? formatRange(previewStart, previewEnd) : formatRange(range.start, range.end)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div className="modal modal--request" role="dialog" aria-modal="true" aria-labelledby="request-modal-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div>
            <h2 id="request-modal-title">{t('requestTitle')}</h2>
            <p className="modal-range">{rangeLabel}</p>
          </div>
          <button type="button" className="secondary modal-header-close" onClick={onCancel} disabled={isSubmitting}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="coordinate-row">
            <div>
              <label htmlFor="request-start-date">{t('requestStartDate')}</label>
              <input
                id="request-start-date"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setLocalError(null) }}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="request-end-date">{t('requestEndDate')}</label>
              <input
                id="request-end-date"
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setLocalError(null) }}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <label htmlFor="request-name">{t('requestName')}</label>
          <input
            id="request-name"
            type="text"
            ref={nameRef}
            value={name}
            onChange={(e) => { setName(e.target.value); setLocalError(null) }}
            disabled={isSubmitting}
            placeholder={t('requestNamePlaceholder')}
            required
          />

          <div className="coordinate-row">
            <div>
              <label htmlFor="request-email">{t('requestEmail')}</label>
              <input
                id="request-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                placeholder={t('requestEmailPlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="request-phone">{t('requestPhone')}</label>
              <input
                id="request-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSubmitting}
                placeholder={t('requestPhonePlaceholder')}
              />
            </div>
          </div>

          <label htmlFor="request-notes">{t('requestNotes')}</label>
          <textarea
            id="request-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            placeholder={t('requestNotesPlaceholder')}
            rows={2}
          />

          {(localError || errorMessage) && (
            <div className="modal-errors" role="alert">
              <span>{localError || errorMessage}</span>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onCancel} disabled={isSubmitting}>
              {t('cancel')}
            </button>
            <button type="submit" className="primary" disabled={isSubmitting}>
              {isSubmitting ? t('requestSubmitting') : t('requestSubmit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
