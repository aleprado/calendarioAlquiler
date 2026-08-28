import { Router } from 'express'
import { authService, type AuthenticatedRequest } from '../services/authService'
import { propertyService } from '../services/propertyService'
import { propertyRepository } from '../repositories/propertyRepository'
import { pushService } from '../services/pushService'
import { mapLinkService } from '../services/mapLinkService'
import { googlePhotosService } from '../services/googlePhotosService'
import { asyncHandler } from '../utils/asyncHandler'
import { getUserId } from '../utils/auth'
import {
  propertyPayloadSchema,
  propertyUpdateSchema,
  propertyJoinSchema,
  mapResolveSchema,
  googlePhotosImportSchema,
} from '../schemas/property.schema'
import { eventRouter } from './event.routes'

export const propertyRouter = Router()

// Aplicar middleware de autenticación a todas las rutas privadas de propiedades
propertyRouter.use((req, res, next) => {
  void authService.middleware(req as AuthenticatedRequest, res, next)
})

propertyRouter.use(eventRouter)

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

propertyRouter.post(
  '/join',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parseResult = propertyJoinSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({ message: 'Datos inválidos', issues: parseResult.error.issues })
      return
    }

    const userId = getUserId(req)
    const property = await propertyService.joinByShareCode(userId, parseResult.data.code)
    res.json({ property })
  }),
)

propertyRouter.post(
  '/resolve-map-link',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parseResult = mapResolveSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({ message: 'Datos inválidos', issues: parseResult.error.issues })
      return
    }

    const resolved = await mapLinkService.resolveGoogleMapsLink(parseResult.data.url)
    res.json({ resolved })
  }),
)

propertyRouter.post(
  '/import-google-photos',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parseResult = googlePhotosImportSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({ message: 'Datos inválidos', issues: parseResult.error.issues })
      return
    }

    const imported = await googlePhotosService.importAlbumImages(parseResult.data.url, parseResult.data.limit)
    res.json({ imported })
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

propertyRouter.post(
  '/:propertyId/push-subscription',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const subscription = req.body
    if (subscription && subscription.endpoint && subscription.keys) {
      await propertyRepository.addPushSubscription(req.params.propertyId, subscription)
    }
    res.json({ ok: true })
  }),
)

propertyRouter.post(
  '/:propertyId/test-push',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = getUserId(req)
    const property = await propertyService.getOwnedProperty(userId, req.params.propertyId)
    const propertyName = property.name || 'Propiedad'

    const result = await pushService.sendPropertyWebPush(req.params.propertyId, {
      title: '🔔 ¡Prueba de Notificación Push!',
      body: `Las notificaciones para "${propertyName}" están configuradas y funcionando en segundo plano.`,
      url: '/',
      tag: `test-push-${Date.now()}`,
    })

    res.json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
      totalSubscriptions: property?.pushSubscriptions?.length ?? 0,
    })
  }),
)
