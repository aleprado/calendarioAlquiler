import { dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { es as esLocale } from 'date-fns/locale'

const locales = {
  es: esLocale,
}

const parseDate = (value: string, formatString: string) =>
  parse(value, formatString, new Date(), { locale: esLocale })

const startOfWeekLocalized = (date: Date) => startOfWeek(date, { locale: esLocale })

const getDayLocalized = (date: Date) => getDay(date)

export const localizer = dateFnsLocalizer({
  format,
  parse: parseDate,
  startOfWeek: startOfWeekLocalized,
  getDay: getDayLocalized,
  locales,
})
