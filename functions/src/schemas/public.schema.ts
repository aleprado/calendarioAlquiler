import { z } from 'zod'

export const publicRequestSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  requesterName: z.string().min(1, 'El nombre es obligatorio'),
  requesterEmail: z.string().email().optional(),
  requesterPhone: z.string().min(4).optional(),
  notes: z.string().max(1000).optional(),
})
