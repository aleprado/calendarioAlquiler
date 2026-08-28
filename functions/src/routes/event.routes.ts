import { Router } from 'express'
import type { AuthenticatedRequest } from '../services/authService'
import { eventService } from '../services/eventService'
import { asyncHandler } from '../utils/asyncHandler'
import { getUserId } from '../utils/auth'
import {
  eventPayloadSchema,
  eventUpdateSchema,
  syncPayloadSchema,
} from '../schemas/event.schema'

export const eventRouter = Router({ mergeParams: true })

eventRouter.get(
  '/:propertyId/events',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = getUserId(req)
    const events = await eventService.listForUser(userId, req.params.propertyId)
    res.json({ events })
  }),
)

eventRouter.post(
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

eventRouter.patch(
  '/:propertyId/events/:eventId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parseResult = eventUpdateSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({ message: 'Datos inválidos', issues: parseResult.error.issues })
      return
    }

    const userId = getUserId(req)
    const event = await eventService.updateEvent(userId, req.params.propertyId, req.params.eventId, parseResult.data)
    res.json({ event })
  }),
)

eventRouter.delete(
  '/:propertyId/events/:eventId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = getUserId(req)
    await eventService.deleteEvent(userId, req.params.propertyId, req.params.eventId)
    res.status(204).send()
  }),
)

eventRouter.post(
  '/:propertyId/airbnb/sync',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parseResult = syncPayloadSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({ message: 'Datos inválidos', issues: parseResult.error.issues })
      return
    }

    const userId = getUserId(req)
    const result = await eventService.syncAirbnb(
      userId,
      req.params.propertyId,
      parseResult.data.includeTentative,
      parseResult.data.icalUrl,
    )
    res.json(result)
  }),
)
