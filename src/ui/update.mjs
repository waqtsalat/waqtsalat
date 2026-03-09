/**
 * Update banner, reload assets, hard refresh.
 */

import { state } from '../state.mjs';
import { t } from '../i18n.mjs';
import { $ } from '../utils.mjs';
import { preCacheSounds } from '../sounds.mjs';

// ─── Reload Assets (keep settings) ───────────────────────────
export async function reloadAssets() {
  const fab = $('reload-fab');
  const toast = $('reload-toast');
  if (fab.classList.contains('spinning')) return;

  fab.classList.add('spinning');
  fab.classList.remove('success', 'error');
  toast.textContent = t('reloadingAssets', state.locale);
  toast.classList.add('show');

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
      await navigator.serviceWorker.register('sw.js');
    }

    if (state.notifications.enabled) {
      await preCacheSounds();
    }

    fab.classList.remove('spinning');
    fab.classList.add('success');
    toast.textContent = t('reloadDone', state.locale);

    setTimeout(() => {
      toast.classList.remove('show');
      location.reload();
    }, 1200);
  } catch (e) {
    fab.classList.remove('spinning');
    fab.classList.add('error');
    toast.textContent = t('reloadFail', state.locale);
    setTimeout(() => {
      toast.classList.remove('show');
      fab.classList.remove('error');
    }, 3000);
  }
}

// ─── Hard Refresh ────────────────────────────────────────────
export async function hardRefresh() {
  if (!confirm(t('hardRefreshConfirm', state.locale))) return;
  const btn = $('btn-hard-refresh');
  btn.disabled = true;
  btn.textContent = t('hardRefreshing', state.locale);

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (reg.active) reg.active.postMessage({ type: 'PURGE_CACHES' });
      await reg.unregister();
    }
  }

  if ('indexedDB' in window && indexedDB.databases) {
    try {
      const dbs = await indexedDB.databases();
      await Promise.all(dbs.map(db => new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(db.name);
        req.onsuccess = resolve; req.onerror = reject;
      })));
    } catch (e) { /* ignore */ }
  }

  localStorage.clear();
  sessionStorage.clear();
  location.reload();
}

// ─── Service Worker ───────────────────────────────────────────
const SW_UPDATE_INTERVAL = 60 * 60 * 1000;

export function registerSW(stopNotifSoundFn, scheduleNotificationsFn, playNotifSoundFn, setAppBadgeFn, wakeScreenFn, getPrayerTimesFn) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(reg);
        }
      });
    });
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateBanner(reg);
    }
    setInterval(() => reg.update(), SW_UPDATE_INTERVAL);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update();
    });
    window.addEventListener('online', () => reg.update());
  });
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'STOP_SOUND') stopNotifSoundFn();
    if (event.data?.type === 'RESCHEDULE_NOTIFICATIONS') scheduleNotificationsFn(getPrayerTimesFn());
    if (event.data?.type === 'PLAY_SOUND') {
      const snd = event.data.sound || 'tone';
      if (snd !== 'silent') { try { playNotifSoundFn(snd); } catch (e) { /* ignore */ } }
      if (state.notifications.vibrate && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 300, 100, 200]);
      }
      wakeScreenFn();
      setAppBadgeFn(1);
    }
  });
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}

export function showUpdateBanner(reg) {
  const banner = $('update-banner');
  $('update-text').textContent = t('updateAvailable', state.locale);
  $('btn-update-now').textContent = t('updateNow', state.locale);
  $('btn-update-later').textContent = t('later', state.locale);
  banner.classList.add('show');

  $('btn-update-now').onclick = () => {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    banner.classList.remove('show');
  };
  $('btn-update-later').onclick = () => banner.classList.remove('show');
}
