// Service Worker for background Web Push Notifications
// Works even when the web application tab or browser is closed!

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Handle incoming background Push events from Web Push server / FCM
self.addEventListener('push', (event) => {
  let data = {
    title: '¡Nueva solicitud de reserva! 🏠',
    body: 'Se ha registrado una nueva consulta para tu propiedad.',
    icon: '/favicon.svg',
    url: '/',
  }

  if (event.data) {
    try {
      const parsed = event.data.json()
      data = { ...data, ...parsed }
    } catch {
      data.body = event.data.text() || data.body
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
    },
    actions: [
      { action: 'open', title: 'Ver Reserva' },
    ],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// Handle click on the background notification banner
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
