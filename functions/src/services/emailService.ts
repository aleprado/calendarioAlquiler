import sgMail from '@sendgrid/mail'

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const NOTIFY_FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY)
}

export interface ReservationNotificationPayload {
  to: string[]
  propertyName: string
  requesterName: string
  requesterEmail?: string
  requesterPhone?: string
  start: string
  end: string
}

const hasValidConfig = () => {
  if (!SENDGRID_API_KEY) {
    console.warn('[emailService] SENDGRID_API_KEY no configurada; omitiendo envío de correo.')
    return false
  }
  if (!NOTIFY_FROM_EMAIL) {
    console.warn('[emailService] NOTIFY_FROM_EMAIL no configurado; omitiendo envío de correo.')
    return false
  }
  return true
}

export const sendReservationRequestEmail = async (payload: ReservationNotificationPayload): Promise<void> => {
  if (!hasValidConfig()) {
    return
  }

  if (!Array.isArray(payload.to) || payload.to.length === 0) {
    console.warn('[emailService] No hay destinatarios para la notificación; omitiendo envío.')
    return
  }

  const uniqueRecipients = Array.from(new Set(payload.to.filter((email) => !!email)))
  if (uniqueRecipients.length === 0) {
    console.warn('[emailService] Destinatarios inválidos; omitiendo envío.')
    return
  }

  const lines = [
    `Hola,`,
    '',
    `Se generó una nueva solicitud de reserva para "${payload.propertyName}".`,
    `Fechas: ${payload.start} → ${payload.end}`,
    '',
    `Solicitante: ${payload.requesterName || 'Sin nombre'}`,
    payload.requesterEmail ? `Email: ${payload.requesterEmail}` : undefined,
    payload.requesterPhone ? `Teléfono: ${payload.requesterPhone}` : undefined,
    '',
    '— Equipo Simple Alquiler',
  ].filter(Boolean)

  try {
    await sgMail.send({
      to: uniqueRecipients,
      from: NOTIFY_FROM_EMAIL as string,
      subject: `Nueva solicitud de reserva para ${payload.propertyName}`,
      text: lines.join('\n'),
    })
  } catch (error) {
    console.error('[emailService] Error al enviar notificación de reserva', error)
  }
}
