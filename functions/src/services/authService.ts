import type { DecodedIdToken } from 'firebase-admin/auth'
import type { NextFunction, Request, Response } from 'express'
import { getAuth } from '../firebaseAdmin'

const BEARER_PREFIX = 'bearer '

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken
}

export class AuthService {
  async verifyRequest(req: Request): Promise<DecodedIdToken> {
    const header = req.headers.authorization
    if (!header) {
      throw new Error('Autenticación requerida')
    }

    const lower = header.toLowerCase()
    if (!lower.startsWith(BEARER_PREFIX)) {
      throw new Error('Formato de token inválido')
    }

    const token = header.slice(BEARER_PREFIX.length).trim()
    if (!token) {
      throw new Error('Token vacío')
    }

    return await getAuth().verifyIdToken(token)
  }

  middleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      next()
      return
    }

    try {
      const decoded = await this.verifyRequest(req)
      req.user = decoded
      next()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Autenticación requerida'
      res.status(message === 'Autenticación requerida' ? 401 : 403).json({ message })
    }
  }
}

export const authService = new AuthService()
