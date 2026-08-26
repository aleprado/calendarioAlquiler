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

    if (permission === 'granted' && 'serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js')
      } catch (swErr) {
        console.warn('[NotificationService] Service Worker registration failed:', swErr)
      }
    }

    return permission
  } catch (err) {
    console.warn('[NotificationService] Error requesting permission:', err)
    return 'denied'
  }
}

/**
  * Plays a pleasant dual-tone chime (E5 -> A5) using Web Audio API synth oscillator.
  */
export const playNotificationSound = () => {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    // First note: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(659.25, now)
    gain1.gain.setValueAtTime(0.2, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.35)

    // Second note: A5 (880.00 Hz)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880.0, now + 0.12)
    gain2.gain.setValueAtTime(0.25, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.55)
  } catch (err) {
    console.warn('[NotificationService] Error playing sound:', err)
  }
}

export const showReservationRequestNotification = async (
  propertyName: string,
  requesterName: string,
  dateRangeText: string,
) => {
  // Always play sound on notification event
  playNotificationSound()

  if (!isNotificationSupported() || Notification.permission !== 'granted') return

  try {
    const title = `¡Nueva solicitud de reserva! 🏠`
    const body = `${requesterName} solicitó reservar ${propertyName} (${dateRangeText}).`

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          data: { url: '/' },
        })
        return
      }
    }

    const notification = new Notification(title, {
      body,
      icon: '/favicon.svg',
      tag: `reservation-request-${Date.now()}`,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch (err) {
    console.warn('[NotificationService] Error triggering notification:', err)
  }
}
