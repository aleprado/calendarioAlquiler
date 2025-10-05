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

// Wrapper para manejo de errores async
const asyncHandler =
  (handler: (req: Request, res: Response) => void | Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next)
  }

// Schemas de validación
const eventPayloadSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  start: z.string().datetime(),
  end: z.string().datetime(),
  description: z.string().optional(),
  location: z.string().optional(),
})

// icalUrl opcional; si no viene en el body, se toma de env/config
const syncPayloadSchema = z.object({
  icalUrl: z.string().url('icalUrl debe ser una URL válida').optional(),
  includeTentative: z.boolean().optional(),
})

const getPropertyId = (req: Request) =>
  req.params.propertyId ?? config.defaultPropertyId

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'airbnb-calendar-functions' })
})

// Todas las rutas siguientes requieren Basic Auth
app.use(basicAuthMiddleware)

// 🔹 Obtener eventos
app.get(
  '/properties/:propertyId/events',
  asyncHandler(async (req, res) => {
    const propertyId = getPropertyId(req)
    const events = await listEvents(propertyId)
    res.json({ events })
  }),
)

// 🔹 Crear evento manual
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
      // ✅ Limpiar payload antes de guardar
      const cleanData = Object.fromEntries(
        Object.entries(parseResult.data).filter(([_, v]) => v != null),
      ) as z.infer<typeof eventPayloadSchema>

      const event = await createManualEvent(propertyId, cleanData)
      res.status(201).json({ event })
    } catch (error) {
      console.error('[createManualEvent]', error)
      res.status(500).json({ message: 'No se pudo crear el evento.' })
    }
  }),
)

// 🔹 Eliminar evento
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

// 🔹 Sincronizar con Airbnb (ICal)
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
      const icalUrl =
        providedUrl ?? process.env.AIRBNB_ICAL_URL ?? config.airbnbIcalUrl ?? ''

      if (!icalUrl) {
        res
          .status(400)
          .json({ message: 'Falta icalUrl (ni en el body ni en AIRBNB_ICAL_URL).' })
        return
      }

      const icsRaw = await downloadIcs(icalUrl)
      const { confirmed, tentative } = parseAirbnbIcs(icsRaw, includeTentative)

      // ✅ Filtramos todos los campos undefined o nulos antes de guardar
      const clean = (events: any[]) =>
        events.map((ev) =>
          Object.fromEntries(Object.entries(ev).filter(([_, v]) => v != null)),
        )

      const cleanConfirmed = clean(confirmed)
      const cleanTentative = includeTentative ? clean(tentative) : []

      await replaceAirbnbEvents(propertyId, cleanConfirmed, cleanTentative)

      const payload: SyncResponse = {
        propertyId,
        fetchedAt: new Date().toISOString(),
        totalEvents: cleanConfirmed.length + cleanTentative.length,
        confirmedEvents: cleanConfirmed,
        tentativeEvents: cleanTentative,
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

// 🔹 Handler global de errores
app.use((error: unknown, _req: Request, res: Response) => {
  console.error('[calendarApi][unhandled]', error)
  res.status(500).json({ message: 'Error inesperado en la API.' })
})

export const calendarApi = (req: Request, res: Response) => {
  app(req, res)
}
