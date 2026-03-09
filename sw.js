const SW_VERSION = '__SW_VERSION__';
const CACHE_NAME = 'waqtsalat-v' + SW_VERSION;
const SOUND_CACHE_NAME = 'waqtsalat-sounds-v1';
const NOTIF_CACHE_NAME = 'waqtsalat-notif-v1';
const NOTIF_DATA_KEY = '/waqtsalat-notif-data.json';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
];

// ─── Notification Data Persistence (Cache API) ──────────────
// Stores prayer times + settings so SW can fire notifications
// independently of the page (Android background, closed tab, etc.)

async function loadNotifData() {
  try {
    const cache = await caches.open(NOTIF_CACHE_NAME);
    const resp = await cache.match(NOTIF_DATA_KEY);
    if (resp) return await resp.json();
  } catch (e) {}
  return null;
}

async function saveNotifData(data) {
  try {
    const cache = await caches.open(NOTIF_CACHE_NAME);
    await cache.put(NOTIF_DATA_KEY, new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (e) {}
}

// ─── Casablanca Time Helper ─────────────────────────────────
function nowInCasablanca() {
  const now = new Date();
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Casablanca',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
    year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(now).forEach(p => { parts[p.type] = p.value; });
  return {
    h: parseInt(parts.hour === '24' ? '0' : parts.hour),
    m: parseInt(parts.minute),
    day: parts.day, month: parts.month, year: parts.year,
    todayStr: parts.year + '-' + parts.month + '-' + parts.day
  };
}

// ─── SW Notification Check & Fire ───────────────────────────
// Runs independently of the page — triggered by periodicsync,
// fetch piggyback, and message events.

const GRACE_MIN = 5; // 5 min grace period for catch-up

async function swCheckNotifications() {
  const data = await loadNotifData();
  if (!data || !data.settings || !data.settings.enabled) return;
  if (!data.prayerTimes) return;

  const casa = nowInCasablanca();
  const nowMin = casa.h * 60 + casa.m;

  // Reset fired keys on day change
  if (data.date !== casa.todayStr) {
    data.firedKeys = [];
    data.date = casa.todayStr;
  }
  if (!data.firedKeys) data.firedKeys = [];

  const advance = data.settings.advance || 0;
  const prayers = data.settings.prayers || { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
  let changed = false;

  for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    if (!prayers[k] || !data.prayerTimes[k]) continue;
    const [ph, pm] = data.prayerTimes[k].split(':').map(Number);
    const prayerMin = ph * 60 + pm;

    // Advance notification
    if (advance > 0) {
      const advTarget = prayerMin - advance;
      const advKey = k + '-advance';
      const advDiff = nowMin - advTarget;
      if (advDiff >= 0 && advDiff < GRACE_MIN && !data.firedKeys.includes(advKey)) {
        data.firedKeys.push(advKey);
        changed = true;
        await showSwNotification(k, true, data);
      }
    }

    // At-time notification
    const atKey = k + '-atime';
    const atDiff = nowMin - prayerMin;
    if (atDiff >= 0 && atDiff < GRACE_MIN && !data.firedKeys.includes(atKey)) {
      data.firedKeys.push(atKey);
      changed = true;
      await showSwNotification(k, false, data);
    }
  }

  if (changed) await saveNotifData(data);
}

async function showSwNotification(prayerKey, isAdvance, data) {
  const advance = data.settings.advance || 0;
  const time = data.prayerTimes[prayerKey];
  const name = prayerKey.charAt(0).toUpperCase() + prayerKey.slice(1);
  const i18n = data.i18n || {};

  const title = isAdvance
    ? (advance + ' ' + (i18n.minBefore || 'min →') + ' ' + (i18n[prayerKey] || name))
    : ((i18n.athanTime || '') + ' ' + (i18n[prayerKey] || name));
  const body = (i18n.prayerTimes || '') + ' — ' + time;

  const sndPre = data.settings.soundPre || 'tone';
  const sndAt = data.settings.soundAt || data.settings.sound || 'adhan';
  const snd = isAdvance ? sndPre : sndAt;
  const vibrate = data.settings.vibrate !== false;

  await self.registration.showNotification(title.trim(), {
    body,
    icon: 'icons/icon.svg',
    badge: 'icons/icon.svg',
    tag: 'waqtsalat-v2-' + prayerKey + (isAdvance ? '-advance' : ''),
    renotify: true,
    requireInteraction: true,
    vibrate: vibrate ? [200, 100, 200, 100, 300, 100, 200] : [],
    silent: false,
    data: { prayer: prayerKey, isAdvance, sound: snd },
    actions: [
      { action: 'dismiss', title: i18n.dismiss || '✕' },
      ...(!isAdvance ? [{ action: 'snooze', title: i18n.snooze || '⏰ 5min' }] : [])
    ]
  });

  // Tell open pages to play sound
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'PLAY_SOUND', sound: snd, prayer: prayerKey, isAdvance });
  }

  // Set app badge
  try { navigator.setAppBadge && navigator.setAppBadge(1); } catch (e) {}
}

// ─── Throttled check (avoid running too frequently) ─────────
let lastCheckTs = 0;
const CHECK_THROTTLE_MS = 30000; // 30s minimum between checks

function throttledCheck() {
  const now = Date.now();
  if (now - lastCheckTs < CHECK_THROTTLE_MS) return Promise.resolve();
  lastCheckTs = now;
  return swCheckNotifications();
}

// ─── Notification Triggers API ────────────────────────────────
// Planifie des notifications à des timestamps exacts.
// L'OS réveille le SW lui-même — pas besoin que l'app soit ouverte.
// Support : Chrome 80+ Android. Détection via self.registration.showTrigger.

function casaTimestampFromHHMM(timeStr) {
  // Convertit "HH:MM" (heure locale Casablanca) en timestamp UTC
  const [localH, localM] = timeStr.split(':').map(Number);
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Casablanca',
    timeZoneName: 'shortOffset'
  });
  const tzStr = fmt.formatToParts(now).find(p => p.type === 'timeZoneName')?.value || 'GMT+1';
  const match = tzStr.match(/GMT([+-]?\d+)?/);
  const offsetH = parseInt(match?.[1] || '1', 10);
  const d = new Date();
  d.setHours(localH - offsetH, localM, 0, 0);
  return d.getTime();
}

async function scheduleTriggeredNotifications(prayerTimes, settings, i18n) {
  // Vérifier le support de l'API
  if (!self.registration.showTrigger) return false;

  // Nettoyer les notifications déjà planifiées pour aujourd'hui
  const existing = await self.registration.getNotifications({ includeTriggered: true });
  for (const n of existing) {
    if (n.tag?.startsWith('waqtsalat-trigger-')) n.close();
  }

  const prayers = settings.prayers || { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
  const advance = settings.advance || 0;
  const now = Date.now();
  let count = 0;

  for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    if (!prayers[k] || !prayerTimes[k]) continue;
    const prayerTs = casaTimestampFromHHMM(prayerTimes[k]);

    // Notification avancée (si configurée)
    if (advance > 0) {
      const advTs = prayerTs - advance * 60 * 1000;
      if (advTs > now + 30000) {
        const title = `${advance} ${i18n.minBefore || 'min'} → ${i18n[k] || k}`;
        await self.registration.showNotification(title, {
          body: `${i18n.prayerTimes || ''} — ${prayerTimes[k]}`,
          icon: 'icons/icon.svg',
          badge: 'icons/icon.svg',
          tag: `waqtsalat-trigger-${k}-advance`,
          showTrigger: new TimestampTrigger(advTs),
          requireInteraction: true,
          silent: false,
          vibrate: [200, 100, 200],
          data: { prayer: k, isAdvance: true, sound: settings.soundPre || 'tone' },
          actions: [{ action: 'dismiss', title: i18n.dismiss || '✕' }]
        });
        count++;
      }
    }

    // Notification à l'heure exacte
    if (prayerTs > now + 30000) {
      const title = `${i18n.athanTime || 'Prayer time'} ${i18n[k] || k}`;
      await self.registration.showNotification(title, {
        body: `${i18n.prayerTimes || ''} — ${prayerTimes[k]}`,
        icon: 'icons/icon.svg',
        badge: 'icons/icon.svg',
        tag: `waqtsalat-trigger-${k}-atime`,
        showTrigger: new TimestampTrigger(prayerTs),
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 300, 100, 200],
        data: { prayer: k, isAdvance: false, sound: settings.soundAt || 'adhan' },
        actions: [
          { action: 'dismiss', title: i18n.dismiss || '✕' },
          { action: 'snooze', title: i18n.snooze || '⏰ 5min' }
        ]
      });
      count++;
    }
  }

  console.log(`[SW] Scheduled ${count} triggered notifications`);
  return count > 0;
}

// ─── Service Worker Lifecycle ───────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== SOUND_CACHE_NAME && k !== NOTIF_CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
  // Piggyback: check notifications on any fetch event (keeps SW alive)
  event.waitUntil(throttledCheck());
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
  // Receive prayer times + notification settings from page
  if (event.data && event.data.type === 'SYNC_NOTIF_DATA') {
    event.waitUntil((async () => {
      const existing = await loadNotifData() || {};
      const casa = nowInCasablanca();
      const newData = {
        prayerTimes: event.data.prayerTimes,
        settings: event.data.settings,
        i18n: event.data.i18n || existing.i18n || {},
        date: existing.date === casa.todayStr ? existing.date : casa.todayStr,
        firedKeys: existing.date === casa.todayStr ? (existing.firedKeys || []) : []
      };
      await saveNotifData(newData);
      if (event.data.settings?.enabled && event.data.prayerTimes) {
        // Couche 1 : Notification Triggers (Chrome Android) — le plus fiable
        const triggered = await scheduleTriggeredNotifications(
          event.data.prayerTimes,
          event.data.settings,
          event.data.i18n || {}
        ).catch(() => false);

        // Couche 2 : Polling SW existant — fallback si Triggers non disponible
        if (!triggered) await swCheckNotifications();
      } else {
        // Notifications désactivées — annuler les triggers planifiés
        if (self.registration.getNotifications) {
          const pending = await self.registration.getNotifications({ includeTriggered: true });
          for (const n of pending) {
            if (n.tag?.startsWith('waqtsalat-trigger-')) n.close();
          }
        }
        await swCheckNotifications();
      }
    })());
  }
});

// ─── VAPID Push (Couche 3) ────────────────────────────────────
// Reçoit les pushes envoyés par le GitHub Action.
// Se réveille même app complètement fermée sur iOS 16.4+ et Android.

self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'WaqtSalat', body: event.data.text() }; }

  const { title, body, prayer, isAdvance, sound } = payload;

  event.waitUntil((async () => {
    // Signaler aux pages ouvertes de jouer le son (le SW ne peut pas)
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'PLAY_SOUND', sound: sound || 'adhan', prayer, isAdvance });
    }

    await self.registration.showNotification(title, {
      body,
      icon: 'icons/icon.svg',
      badge: 'icons/icon.svg',
      tag: `waqtsalat-v2-${prayer}${isAdvance ? '-advance' : ''}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 300, 100, 200],
      silent: false,
      data: { prayer, isAdvance, sound },
      actions: [
        { action: 'dismiss', title: '✕' },
        ...(!isAdvance ? [{ action: 'snooze', title: '⏰ 5min' }] : [])
      ]
    });

    try { navigator.setAppBadge && navigator.setAppBadge(1); } catch {}
  })());
});

// Notification click — open the app, handle snooze/dismiss, clear badge
self.addEventListener('notificationclick', event => {
  event.notification.close();

  try { navigator.clearAppBadge && navigator.clearAppBadge(); } catch (e) {}

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

  // Default click or 'dismiss': focus or open the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Tell the page to stop playing sound
      for (const client of clients) {
        client.postMessage({ type: 'STOP_SOUND' });
      }
      for (const client of clients) {
        if (client.url.includes('waqtsalat') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('./');
    })
  );
});

// Notification close (swipe away) — clear badge
self.addEventListener('notificationclose', event => {
  try { navigator.clearAppBadge && navigator.clearAppBadge(); } catch (e) {}
});

// Periodic Background Sync — check notifications directly from SW
self.addEventListener('periodicsync', event => {
  if (event.tag === 'reschedule-notifications') {
    event.waitUntil((async () => {
      // SW checks notifications independently
      await swCheckNotifications();
      // Also tell open pages to reschedule (for sound playback)
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({ type: 'RESCHEDULE_NOTIFICATIONS' });
      }
    })());
  }
});
