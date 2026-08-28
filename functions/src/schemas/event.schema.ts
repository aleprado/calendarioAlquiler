import { z } from 'zod'

export const eventPayloadSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  start: z.string().datetime(),
  end: z.string().datetime(),
  description: z.string().optional(),
  location: z.string().optional(),
})

export const eventUpdateSchema = z
  .object({
    title: z.string().trim().min(1, 'El título no puede estar vacío').optional(),
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    description: z.union([z.string(), z.literal(null)]).optional(),
    location: z.union([z.string(), z.literal(null)]).optional(),
    status: z.enum(['pending', 'confirmed', 'declined']).optional(),
    cleaningStatus: z.enum(['pending', 'done']).optional(),
  })
  .refine(
    (payload) =>
      payload.status !== undefined ||
      payload.cleaningStatus !== undefined ||
      payload.title !== undefined ||
      payload.start !== undefined ||
      payload.end !== undefined ||
      payload.description !== undefined ||
      payload.location !== undefined,
    { message: 'Debes enviar al menos un campo para actualizar' },
  )
  .refine(
    (payload) =>
      (payload.start === undefined && payload.end === undefined) ||
      (payload.start !== undefined && payload.end !== undefined),
    {
      message: 'Si actualizas fechas debes enviar inicio y fin',
    },
  )

export const syncPayloadSchema = z.object({
  icalUrl: z.string().url('icalUrl debe ser una URL válida').optional(),
  includeTentative: z.boolean().optional(),
})
