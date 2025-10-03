import type { NextFunction, Request, Response } from 'express'
import { config, requireAuth } from './config'

const decodeBasicAuth = (header: string) => {
  if (!header.toLowerCase().startsWith('basic ')) return null
  const token = header.slice(6)
  const decoded = Buffer.from(token, 'base64').toString('utf8')
  const [user, password] = decoded.split(':')
  if (!user || password === undefined) return null
  return { user, password }
}

export const basicAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health') {
    return next()
  }

  if (config.allowUnauthenticated) {
    return next()
  }

  try {
    requireAuth()
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Configuración inválida' })
    return
  }

  const header = req.headers.authorization ?? ''
  const credentials = decodeBasicAuth(header)

  if (!credentials) {
    res.setHeader('WWW-Authenticate', 'Basic realm="CalendarioAlquiler"')
    res.status(401).json({ message: 'Autenticación requerida' })
    return
  }

  if (credentials.user !== config.basicAuthUser || credentials.password !== config.basicAuthPassword) {
    res.status(403).json({ message: 'Credenciales inválidas' })
    return
  }

  next()
}
