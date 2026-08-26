import webpush from 'web-push'
import { propertyRepository } from '../repositories/propertyRepository'

// Public VAPID Key provided by user (Firebase Web Push Key)
export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BN69lsJppxa6138aXSSN8KQ65SKPIXX34IYlUT6m7dZl06RpUaPy8UrfLLzHs5uu9YcOY6M4Ti_SmqxUTyaoHjo'

// Private VAPID Key (or generated fallback key if not set in environment)
export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'N2Z8wY-WvL3mX9r_kK1pQ8u_V4bC7tS0xY2zL9aB5nE'

try {
  webpush.setVapidDetails(
    'mailto:aleprado@simplealquiler.net',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )
} catch (err) {
  console.warn('[PushService] VAPID details initialization warning:', err)
}

export interface WebPushPayload {
  title: string
  body: string
  icon?: string
  url?: string
}

export const pushService = {
  async sendPropertyWebPush(propertyId: string, payload: WebPushPayload): Promise<{ sent: number; failed: number }> {
    const property = await propertyRepository.getById(propertyId)
    if (!property || !property.pushSubscriptions || property.pushSubscriptions.length === 0) {
      return { sent: 0, failed: 0 }
    }

    const payloadString = JSON.stringify(payload)
    let sent = 0
    let failed = 0
    const validSubs: typeof property.pushSubscriptions = []

    for (const sub of property.pushSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          payloadString
        )
        sent++
        validSubs.push(sub)
      } catch (err: unknown) {
        failed++
        const statusCode = (err as { statusCode?: number }).statusCode
        // Remove expired/invalid subscriptions (404 Not Found or 410 Gone)
        if (statusCode !== 404 && statusCode !== 410) {
          validSubs.push(sub)
        }
      }
    }

    // Clean up expired subscriptions if any failed
    if (failed > 0 && validSubs.length !== property.pushSubscriptions.length) {
      try {
        const docRef = (propertyRepository as unknown as { propertiesCollection: { doc: (id: string) => { update: (data: object) => Promise<void> } } }).propertiesCollection?.doc(propertyId)
        if (docRef) {
          await docRef.update({ pushSubscriptions: validSubs })
        }
      } catch {
        // Ignore cleanup error
      }
    }

    return { sent, failed }
  },
}
