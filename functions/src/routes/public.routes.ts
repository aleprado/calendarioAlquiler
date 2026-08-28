import { Router } from 'express'
import { eventService } from '../services/eventService'
import { propertyService } from '../services/propertyService'
import { asyncHandler } from '../utils/asyncHandler'
import { publicRequestSchema } from '../schemas/public.schema'

export const publicRouter = Router()

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

    const result = await eventService.createPublicRequest(req.params.publicSlug, parseResult.data)
    res.status(201).json({ event: result.event, notificationSent: result.notificationSent })
  }),
)

publicRouter.post(
  '/properties/:publicSlug/view',
  asyncHandler(async (req, res) => {
    await propertyService.recordPublicView(req.params.publicSlug)
    res.status(204).send()
  }),
)

publicRouter.post(
  '/properties/:publicSlug/quote',
  asyncHandler(async (req, res) => {
    await propertyService.recordPublicQuote(req.params.publicSlug)
    res.status(204).send()
  }),
)
