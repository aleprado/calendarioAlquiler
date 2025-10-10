import express from 'express'
import cors from 'cors'
import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { authService, type AuthenticatedRequest } from './services/authService'
import { propertyService } from './services/propertyService'
import { eventService } from './services/eventService'
import { ServiceError, isServiceError } from './utils/errors'

const app = express()
const corsOptions = {
  origin: true,
  credentials: true,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json())

const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => void | Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }

const getUserId = (req: AuthenticatedRequest) => {
  if (!req.user) {
    throw new ServiceError('Autenticación requerida', 401)
  }
  return req.user.uid
}

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'calendar-api' })
})

/* ==================== Rutas autenticadas ==================== */

const propertyPayloadSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  airbnbIcalUrl: z.string().url('El enlace de iCal debe ser una URL válida'),
})

const propertyUpdateSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').optional(),
  airbnbIcalUrl: z.string().url('El enlace de iCal debe ser una URL válida').optional(),
  regenerateSlug: z.boolean().optional(),
})

const eventPayloadSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  start: z.string().datetime(),
  end: z.string().datetime(),
  description: z.string().optional(),
  location: z.string().optional(),
})

const eventStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'declined']),
})

const syncPayloadSchema = z.object({
  icalUrl: z.string().url('icalUrl debe ser una URL válida').optional(),
  includeTentative: z.boolean().optional(),
})

const propertyRouter = express.Router()
propertyRouter.use((req, res, next) => authService.middleware(req as AuthenticatedRequest, res, next))

propertyRouter.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = getUserId(req)
    const properties = await propertyService.listForUser(userId)
    res.json({ properties })
  }),
)

propertyRouter.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parseResult = propertyPayloadSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({ message: 'Datos inválidos', issues: parseResult.error.issues })
      return
    }

    const userId = getUserId(req)
    const property = await propertyService.create(userId, parseResult.data)
    res.status(201).json({ property })
  }),
)

propertyRouter.patch(
  '/:propertyId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parseResult = propertyUpdateSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({ message: 'Datos inválidos', issues: parseResult.error.issues })
      return
    }

    const userId = getUserId(req)
    const property = await propertyService.update(userId, req.params.propertyId, parseResult.data)
    res.json({ property })
  }),
)

propertyRouter.get(
  '/:propertyId/events',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = getUserId(req)
    const events = await eventService.listForUser(userId, req.params.propertyId)
    res.json({ events })
  }),
)

propertyRouter.post(
  '/:propertyId/events',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parseResult = eventPayloadSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({ message: 'Datos inválidos', issues: parseResult.error.issues })
      return
    }

    const userId = getUserId(req)
    const event = await eventService.createManualEvent(userId, req.params.propertyId, parseResult.data)
    res.status(201).json({ event })
  }),
)

propertyRouter.patch(
  '/:propertyId/events/:eventId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parseResult = eventStatusSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({ message: 'Datos inválidos', issues: parseResult.error.issues })
      return
    }

    const userId = getUserId(req)
    const event = await eventService.updateEventStatus(userId, req.params.propertyId, req.params.eventId, parseResult.data.status)
    res.json({ event })
  }),
)

propertyRouter.delete(
  '/:propertyId/events/:eventId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = getUserId(req)
    await eventService.deleteEvent(userId, req.params.propertyId, req.params.eventId)
    res.status(204).send()
  }),
)

propertyRouter.post(
  '/:propertyId/airbnb/sync',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parseResult = syncPayloadSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({ message: 'Datos inválidos', issues: parseResult.error.issues })
      return
    }

    const userId = getUserId(req)
    const result = await eventService.syncAirbnb(userId, req.params.propertyId, parseResult.data.includeTentative, parseResult.data.icalUrl)
    res.json(result)
  }),
)

app.use('/properties', propertyRouter)

/* ==================== Rutas públicas ==================== */

const publicRequestSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  requesterName: z.string().min(1, 'El nombre es obligatorio'),
  requesterEmail: z.string().email().optional(),
  requesterPhone: z.string().min(4).optional(),
  notes: z.string().max(1000).optional(),
})

const publicRouter = express.Router()

publicRouter.get(
  '/properties/:publicSlug',
  asyncHandler(async (req, res) => {
    const data = await eventService.getPublicAvailability(req.params.publicSlug)
    if (!data) {
      res.status(404).json({ message: 'Propiedad no encontrada' })
      return
    }

    res.json(data)
  }),
)

publicRouter.post(
  '/properties/:publicSlug/requests',
  asyncHandler(async (req, res) => {
    const parseResult = publicRequestSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({ message: 'Datos inválidos', issues: parseResult.error.issues })
      return
    }

    const event = await eventService.createPublicRequest(req.params.publicSlug, parseResult.data)
    res.status(201).json({ event })
  }),
)

app.use('/public', publicRouter)

/* ==================== Handler de errores ==================== */

app.use((error: unknown, _req: Request, res: Response) => {
  if (isServiceError(error)) {
    res.status(error.status).json({ message: error.message })
    return
  }

  console.error('[calendarApi][unhandled]', error)
  res.status(500).json({ message: 'Error inesperado en la API.' })
})

export const calendarApi = (req: Request, res: Response) => {
  app(req, res)
}
