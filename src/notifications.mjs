/**
 * Client-side notification scheduling and firing.
 */

import { state, saveState } from './state.mjs';
import { t } from './i18n.mjs';
import { nowInCasa, $ } from './utils.mjs';
import { playNotifSound, SOUND_URLS } from './sounds.mjs';

let notifTimeouts = [];
let notifCheckInterval = null;
let firedNotifs = new Set();
let firedNotifsDate = '';
const NOTIF_GRACE_MS = 5 * 60 * 1000;

// ─── Badge API ───────────────────────────────────────────────
export async function setAppBadge(count) {
  if (!state.notifications.badge) return;
  try {
    if (navigator.setAppBadge) await navigator.setAppBadge(count || 1);
  } catch (e) { /* ignore */ }
}

export async function clearAppBadge() {
  try {
    if (navigator.clearAppBadge) await navigator.clearAppBadge();
    else if (navigator.setAppBadge) await navigator.setAppBadge(0);
  } catch (e) { /* ignore */ }
}

// ─── Screen Wake Lock ────────────────────────────────────────
export async function wakeScreen() {
  if (!('wakeLock' in navigator)) return null;
  try {
    const lock = await navigator.wakeLock.request('screen');
    setTimeout(() => lock.release(), 30000);
    return lock;
  } catch (e) { return null; }
}

// ─── Notifications ────────────────────────────────────────────
export function requestNotifPermission(prayerTimes) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') return scheduleNotifications(prayerTimes);
  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') scheduleNotifications(prayerTimes);
      checkNotifBar();
    });
  }
}

export function scheduleNotifications(prayerTimes) {
  notifTimeouts.forEach(clearTimeout);
  notifTimeouts = [];
  if (notifCheckInterval) clearInterval(notifCheckInterval);
  notifCheckInterval = null;
  syncNotifDataToSW(prayerTimes);
  if (!state.notifications.enabled || !state.position || !prayerTimes) return;
  if (Notification.permission !== 'granted') return;

  checkAndFireNotifications(prayerTimes);
  notifCheckInterval = setInterval(() => checkAndFireNotifications(prayerTimes), 15000);
}

export function getNotifTimeouts() { return notifTimeouts; }
export function setNotifTimeouts(val) { notifTimeouts = val; }
export function getNotifCheckInterval() { return notifCheckInterval; }
export function setNotifCheckInterval(val) { notifCheckInterval = val; }

export function syncNotifDataToSW(prayerTimes) {
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: 'SYNC_NOTIF_DATA',
    prayerTimes: prayerTimes || null,
    settings: state.notifications,
    i18n: {
      fajr: t('fajr', state.locale), dhuhr: t('dhuhr', state.locale), asr: t('asr', state.locale),
      maghrib: t('maghrib', state.locale), isha: t('isha', state.locale),
      athanTime: t('notifAthanTime', state.locale), minBefore: t('notifMinBefore', state.locale),
      prayerTimes: t('prayerTimes', state.locale), dismiss: t('notifDismiss', state.locale),
      snooze: t('notifSnooze', state.locale)
    }
  });
}

export function checkAndFireNotifications(prayerTimes) {
  if (!state.notifications.enabled || !prayerTimes) return;
  if (Notification.permission !== 'granted') return;

  const now = nowInCasa();
  const nowMs = now.getTime();
  const todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();

  if (firedNotifsDate !== todayStr) {
    firedNotifs.clear();
    firedNotifsDate = todayStr;
  }

  const advanceMin = state.notifications.advance || 0;
  const prayers = state.notifications.prayers || { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };

  ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => {
    if (!prayers[k] || !prayerTimes[k]) return;
    const [h, m] = prayerTimes[k].split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    const prayerMs = target.getTime();

    if (advanceMin > 0) {
      const advDiff = (prayerMs - advanceMin * 60000) - nowMs;
      const advKey = k + '-advance';
      if (advDiff <= 0 && advDiff > -NOTIF_GRACE_MS && !firedNotifs.has(advKey)) {
        firedNotifs.add(advKey);
        fireNotification(k, true, prayerTimes);
      }
    }

    const diff = prayerMs - nowMs;
    const atKey = k + '-atime';
    if (diff <= 0 && diff > -NOTIF_GRACE_MS && !firedNotifs.has(atKey)) {
      firedNotifs.add(atKey);
      fireNotification(k, false, prayerTimes);
    }
  });
}

export async function fireNotification(prayerKey, isAdvance, prayerTimes) {
  if (Notification.permission !== 'granted') return;
  const sndPre = state.notifications.soundPre || 'tone';
  const sndAt = state.notifications.soundAt || state.notifications.sound || 'adhan';
  const snd = isAdvance ? sndPre : sndAt;
  const advMin = state.notifications.advance || 0;

  const title = isAdvance
    ? (advMin + ' ' + t('notifMinBefore', state.locale) + ' ' + t(prayerKey, state.locale))
    : (t('notifAthanTime', state.locale) + ' ' + t(prayerKey, state.locale));
  const body = t('prayerTimes', state.locale) + ' — ' + prayerTimes[prayerKey];
  const vibPattern = state.notifications.vibrate ? [200, 100, 200, 100, 300, 100, 200] : [];

  if (snd !== 'silent') {
    try { await playNotifSound(snd); } catch (e) { /* ignore */ }
  }

  if (state.notifications.vibrate && navigator.vibrate) {
    navigator.vibrate(vibPattern);
  }

  wakeScreen();
  setAppBadge(1);

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification(title, {
      body,
      icon: 'icons/icon.svg',
      badge: 'icons/icon.svg',
      tag: 'waqtsalat-v2-' + prayerKey + (isAdvance ? '-advance' : ''),
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 300, 100, 200],
      silent: false,
      data: { prayer: prayerKey, isAdvance, sound: snd, soundUrl: SOUND_URLS[snd] || null },
      actions: [
        { action: 'dismiss', title: t('notifDismiss', state.locale) },
        ...(!isAdvance ? [{ action: 'snooze', title: t('notifSnooze', state.locale) }] : [])
      ]
    });
  } else {
    new Notification(title, { body, icon: 'icons/icon.svg', tag: 'waqtsalat-v2-' + prayerKey, requireInteraction: true });
  }
}

export async function sendTestNotification() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
  }
  const snd = state.notifications.soundAt || 'adhan';
  const vibPattern = state.notifications.vibrate ? [200, 100, 200, 100, 300, 100, 200] : [];

  if (snd !== 'silent') { try { await playNotifSound(snd); } catch (e) { /* ignore */ } }
  if (state.notifications.vibrate && navigator.vibrate) navigator.vibrate(vibPattern);
  setAppBadge(1);
  wakeScreen();
}

export async function fireTestNotification() {
  const title = t('notifTestTitle', state.locale) + ' — WaqtSalat';
  const body = t('notifTestDesc', state.locale);
  const snd = state.notifications.soundAt || 'tone';
  if (snd !== 'silent') { try { playNotifSound(snd); } catch (e) { /* ignore */ } }
  if (state.notifications.vibrate && navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification(title, {
      body, icon: 'icons/icon.svg', badge: 'icons/icon.svg',
      tag: 'waqtsalat-v2-test', renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      silent: false,
      data: { prayer: 'test', isAdvance: false, sound: snd },
      actions: [{ action: 'dismiss', title: t('notifDismiss', state.locale) }]
    });
  } else {
    new Notification(title, { body, icon: 'icons/icon.svg', tag: 'waqtsalat-v2-test', requireInteraction: true });
  }
  setTimeout(() => clearAppBadge(), 10000);
}

// ─── Notification Bar (blocked / prompt) ─────────────────────
let notifBarDismissed = false;

export function checkNotifBar() {
  if (!('Notification' in window) || !state.onboarded) return;
  const bar = $('notif-bar');
  const perm = Notification.permission;

  if (notifBarDismissed) { bar.classList.remove('show'); return; }

  if (perm === 'denied') {
    bar.className = 'notif-bar show blocked';
    $('notif-bar-text').textContent = t('notifBlocked', state.locale);
    $('notif-bar-action').style.display = 'none';
  } else if (perm === 'default' && !state.notifications.enabled) {
    bar.className = 'notif-bar show prompt';
    $('notif-bar-text').textContent = t('notifEnable', state.locale);
    $('notif-bar-action').textContent = t('enableNow', state.locale);
    $('notif-bar-action').style.display = '';
    $('notif-bar-action').onclick = () => {
      state.notifications.enabled = true;
      saveState('waqt-notifications', state.notifications);
      $('s-notif-toggle').checked = true;
      requestNotifPermission(null);
      setTimeout(() => checkNotifBar(), 500);
    };
  } else {
    bar.classList.remove('show');
    return;
  }

  $('notif-bar-dismiss').onclick = () => {
    bar.classList.remove('show');
    notifBarDismissed = true;
  };
}
