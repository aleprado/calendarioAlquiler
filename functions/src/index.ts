import express from 'express'
import cors from 'cors'
import type { Request, Response } from 'express'
import { propertyRouter } from './routes/property.routes'
import { publicRouter } from './routes/public.routes'
import { isServiceError } from './utils/errors'

const app = express()
const corsOptions = {
  origin: true,
  credentials: true,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'calendar-api' })
})

app.use('/properties', propertyRouter)
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
