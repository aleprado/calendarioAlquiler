import type { AuthenticatedRequest } from '../services/authService'
import { ServiceError } from './errors'

export const getUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new ServiceError('Autenticación requerida', 401)
  }
  return req.user.uid
}
