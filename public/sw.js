const SW_VERSION = '1.7.0';
const CACHE_NAME = 'waqtsalat-v' + SW_VERSION;
const SOUND_CACHE_NAME = 'waqtsalat-sounds-v1';
const NOTIF_CACHE_NAME = 'waqtsalat-notif-v1';
const NOTIF_DATA_KEY = '/waqtsalat-notif-data.json';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './src/styles.css',
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

// ─── SW Self-Scheduling ──────────────────────────────────────
// Keeps SW alive via chained waitUntil+setTimeout to catch prayers
// between periodicsync/push events. Browser may kill after ~5 min,
// so we cap each sleep at 4 min. Complementary to VAPID push.

let wakeupScheduled = false;

function scheduleNextWakeup() {
  if (wakeupScheduled) return Promise.resolve();
  return loadNotifData().then(data => {
    if (!data?.settings?.enabled || !data?.prayerTimes) return;

    const casa = nowInCasablanca();
    const nowMin = casa.h * 60 + casa.m;
    const advance = data.settings.advance || 0;
    const prayers = data.settings.prayers || { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
    let nextMin = Infinity;

    for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      if (!prayers[k] || !data.prayerTimes[k]) continue;
      const [ph, pm] = data.prayerTimes[k].split(':').map(Number);
      const pMin = ph * 60 + pm;
      if (advance > 0 && (pMin - advance) > nowMin) nextMin = Math.min(nextMin, pMin - advance);
      if (pMin > nowMin) nextMin = Math.min(nextMin, pMin);
    }

    if (nextMin === Infinity || nextMin <= nowMin) return;

    const delayMs = (nextMin - nowMin) * 60000;
    if (delayMs <= 0 || delayMs > 18 * 3600000) return;

    wakeupScheduled = true;
    // Cap at 4 min to avoid browser killing the SW (~5 min limit)
    const sleepMs = Math.min(delayMs, 4 * 60000);
    return new Promise(resolve => {
      setTimeout(() => {
        wakeupScheduled = false;
        swCheckNotifications()
          .then(() => scheduleNextWakeup())
          .then(resolve, resolve);
      }, sleepMs);
    });
  });
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
      await swCheckNotifications();
      if (event.data.settings?.enabled && event.data.prayerTimes) {
        await scheduleNextWakeup();
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
    // Dedup: skip if this prayer was already shown today (by SW polling or earlier push)
    const notifData = await loadNotifData();
    const casa = nowInCasablanca();
    const dedupKey = `${prayer}-${isAdvance ? 'advance' : 'atime'}`;

    if (notifData?.firedKeys?.includes(dedupKey) && notifData.date === casa.todayStr) {
      return; // already shown by SW polling or previous push
    }

    // Mark as fired to prevent duplicates from subsequent pushes or SW polling
    if (notifData) {
      if (!notifData.firedKeys) notifData.firedKeys = [];
      if (notifData.date !== casa.todayStr) {
        notifData.firedKeys = [];
        notifData.date = casa.todayStr;
      }
      notifData.firedKeys.push(dedupKey);
      await saveNotifData(notifData);
    }

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

    // Schedule next wakeup to keep SW alive for remaining prayers
    await scheduleNextWakeup();
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
      // Keep SW alive for next prayer
      await scheduleNextWakeup();
    })());
  }
});
