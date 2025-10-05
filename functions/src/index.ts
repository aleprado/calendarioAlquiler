import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { basicAuthMiddleware } from './auth'
import { config } from './config'
import { downloadIcs, parseAirbnbIcs } from './airbnb'
import {
  createManualEvent,
  deleteEvent,
  listEvents,
  replaceAirbnbEvents,
} from './firestore'
import type { SyncResponse } from './types'

const app = express()
app.use(express.json())

const asyncHandler =
  (handler: (req: Request, res: Response) => void | Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next)
  }

const eventPayloadSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  start: z.string().datetime(),
  end: z.string().datetime(),
  description: z.string().optional(),
  location: z.string().optional(),
})

// icalUrl ahora es opcional; si no viene, se toma de env/config
const syncPayloadSchema = z.object({
  icalUrl: z.string().url('icalUrl debe ser una URL válida').optional(),
  includeTentative: z.boolean().optional(),
})

const getPropertyId = (req: Request) =>
  req.params.propertyId ?? config.defaultPropertyId

app.get('/health', (_req, res) => {
  res
    .status(200)
    .json({ status: 'ok', service: 'airbnb-calendar-functions' })
})

// Todas las rutas siguientes requieren Basic Auth
app.use(basicAuthMiddleware)

app.get(
  '/properties/:propertyId/events',
  asyncHandler(async (req, res) => {
    const propertyId = getPropertyId(req)
    const events = await listEvents(propertyId)
    res.json({ events })
  }),
)

app.post(
  '/properties/:propertyId/events',
  asyncHandler(async (req, res) => {
    const parseResult = eventPayloadSchema.safeParse(req.body)
    if (!parseResult.success) {
      res
        .status(400)
        .json({ message: 'Payload inválido', issues: parseResult.error.issues })
      return
    }

    try {
      const propertyId = getPropertyId(req)
      const event = await createManualEvent(propertyId, parseResult.data)
      res.status(201).json({ event })
    } catch (error) {
      console.error('[createManualEvent]', error)
      res.status(500).json({ message: 'No se pudo crear el evento.' })
    }
  }),
)

app.delete(
  '/properties/:propertyId/events/:eventId',
  asyncHandler(async (req, res) => {
    const propertyId = getPropertyId(req)
    const { eventId } = req.params
    if (!eventId) {
      res
        .status(400)
        .json({ message: 'El identificador del evento es requerido.' })
      return
    }

    await deleteEvent(propertyId, eventId)
    res.status(204).send()
  }),
)

app.post(
  '/properties/:propertyId/airbnb/sync',
  asyncHandler(async (req, res) => {
    const propertyId = getPropertyId(req)
    const parseResult = syncPayloadSchema.safeParse(req.body)
    if (!parseResult.success) {
      res
        .status(400)
        .json({ message: 'Payload inválido', issues: parseResult.error.issues })
      return
    }

    try {
      const { icalUrl: providedUrl, includeTentative = false } = parseResult.data
      // Fallback a env/config si no vino en el body
      const icalUrl =
        providedUrl ??
        process.env.AIRBNB_ICAL_URL ??
        config.airbnbIcalUrl ??
        ''

      if (!icalUrl) {
        res
          .status(400)
          .json({ message: 'Falta icalUrl (ni en el body ni en AIRBNB_ICAL_URL).' })
        return
      }

      const icsRaw = await downloadIcs(icalUrl)
      const { confirmed, tentative } = parseAirbnbIcs(icsRaw, includeTentative)

      await replaceAirbnbEvents(
        propertyId,
        confirmed,
        includeTentative ? tentative : [],
      )

      const payload: SyncResponse = {
        propertyId,
        fetchedAt: new Date().toISOString(),
        totalEvents: confirmed.length + (includeTentative ? tentative.length : 0),
        confirmedEvents: confirmed,
        tentativeEvents: includeTentative ? tentative : [],
      }

      res.status(200).json(payload)
    } catch (error) {
      console.error('[syncAirbnb]', error)
      const message =
        error instanceof Error
          ? `No se pudo obtener el calendario desde Airbnb: ${error.message}`
          : 'No se pudo obtener el calendario desde Airbnb.'
      res.status(502).json({ message })
    }
  }),
)

// Handler de errores con 4 argumentos para que Express lo reconozca
app.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[calendarApi][unhandled]', error)
    res.status(500).json({ message: 'Error inesperado en la API.' })
  },
)

export const calendarApi = (req: Request, res: Response) => {
  app(req, res)
}
