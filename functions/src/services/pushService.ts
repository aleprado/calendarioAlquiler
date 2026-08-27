import webpush from 'web-push'
import { propertyRepository } from '../repositories/propertyRepository'

// Public VAPID Key (ECDSA P-256)
export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BEjLiN2aPlQKzKfRkPwK9Zueo_ON_FiPPBPmQVm4U8l4dK7m7W8Zmt0Fw2w1G9_OB7TBuiDId94Kw-FvrdZhtoA'

// Private VAPID Key matching the public key above
export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'B8YVh3UTtuzSMYIyMV5SP6mHRec9_OZRe2RiQxBezZI'

try {
  webpush.setVapidDetails(
    'mailto:aleprado@simplealquiler.net',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )
  console.info('[PushService] VAPID details initialized successfully.')
} catch (err) {
  console.error('[PushService] VAPID details initialization error:', err)
}

export interface WebPushPayload {
  title: string
  body: string
  icon?: string
  url?: string
  tag?: string
}

export const pushService = {
  async sendPropertyWebPush(propertyId: string, payload: WebPushPayload): Promise<{ sent: number; failed: number }> {
    const property = await propertyRepository.getById(propertyId)
    if (!property || !property.pushSubscriptions || property.pushSubscriptions.length === 0) {
      console.info(`[PushService] No push subscriptions found for property ${propertyId}`)
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
        console.info(`[PushService] Successfully delivered push notification to endpoint: ${sub.endpoint.slice(0, 45)}...`)
      } catch (err: unknown) {
        failed++
        const statusCode = (err as { statusCode?: number }).statusCode
        const errMessage = (err as Error).message || String(err)
        console.error(`[PushService] Failed sending push notification (status ${statusCode}):`, errMessage)

        // Remove expired/invalid subscriptions (404 Not Found or 410 Gone)
        if (statusCode !== 404 && statusCode !== 410) {
          validSubs.push(sub)
        } else {
          console.info(`[PushService] Removing expired subscription endpoint: ${sub.endpoint.slice(0, 45)}...`)
        }
      }
    }

    // Clean up expired subscriptions if any failed
    if (failed > 0 && validSubs.length !== property.pushSubscriptions.length) {
      try {
        const docRef = (propertyRepository as unknown as { propertiesCollection: { doc: (id: string) => { update: (data: object) => Promise<void> } } }).propertiesCollection?.doc(propertyId)
        if (docRef) {
          await docRef.update({ pushSubscriptions: validSubs })
          console.info(`[PushService] Cleaned up ${property.pushSubscriptions.length - validSubs.length} expired subscriptions from property doc.`)
        }
      } catch (cleanupErr) {
        console.warn('[PushService] Subscription cleanup warning:', cleanupErr)
      }
    }

    console.info(`[PushService] Finished push dispatch for property ${propertyId}: ${sent} sent, ${failed} failed.`)
    return { sent, failed }
  },
}
