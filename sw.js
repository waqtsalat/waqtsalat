const SW_VERSION = '1.1.0';
const CACHE_NAME = 'waqtsalat-v' + SW_VERSION;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'PURGE_CACHES') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => self.skipWaiting())
    );
  }
});

// Notification click — open the app
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'snooze') {
    // Snooze: re-show notification after 5 minutes
    const data = event.notification.data || {};
    const title = event.notification.title;
    const options = {
      body: event.notification.body,
      icon: event.notification.icon,
      badge: event.notification.badge,
      tag: (event.notification.tag || 'waqtsalat') + '-snoozed',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 300, 100, 200],
      silent: false,
      data: { ...data, snoozed: true }
    };
    event.waitUntil(
      new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000))
        .then(() => self.registration.showNotification(title, options))
    );
    return;
  }

  // Default: focus or open the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes('waqtsalat') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('./');
    })
  );
});
