export const isNotificationSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window

export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied'
  return Notification.permission
}

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) return 'denied'
  try {
    const permission = await Notification.requestPermission()
    return permission
  } catch (err) {
    console.warn('[NotificationService] Error requesting permission:', err)
    return 'denied'
  }
}

export const showReservationRequestNotification = (propertyName: string, requesterName: string, dateRangeText: string) => {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return

  try {
    const title = `¡Nueva solicitud de reserva! 🏠`
    const options: NotificationOptions = {
      body: `${requesterName} solicitó reservar ${propertyName} (${dateRangeText}).`,
      icon: '/favicon.svg',
      tag: `reservation-request-${Date.now()}`,
    }

    const notification = new Notification(title, options)
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch (err) {
    console.warn('[NotificationService] Error triggering notification:', err)
  }
}
