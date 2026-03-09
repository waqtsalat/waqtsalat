/**
 * WaqtSalat — Entry point
 * Boot sequence, event wiring, and main app orchestration.
 */

'use strict';

import { TRANSLATIONS, t } from './i18n.mjs';
import { state, loadState, saveState } from './state.mjs';
import { TZ } from './constants.mjs';
import { $, showShareToast } from './utils.mjs';
import { CITIES } from './cities.mjs';
import { renderPrayers, getPrayerTimes } from './ui/prayers.mjs';
import { renderQibla, startCompass } from './ui/qibla.mjs';
import { renderSettings, populateCitySelect } from './ui/settings.mjs';
import { renderNav, switchView } from './ui/nav.mjs';
import { setupOnboarding } from './ui/onboarding.mjs';
import { requestNotifPermission, scheduleNotifications, checkNotifBar, syncNotifDataToSW, sendTestNotification, fireTestNotification, clearAppBadge, setAppBadge, wakeScreen } from './notifications.mjs';
import { preCacheSounds, playNotifSound, stopNotifSound, setupSoundStopListeners, updateSoundStatus } from './sounds.mjs';
import { subscribeToPush, unsubscribeFromPush, VAPID_PUBLIC_KEY } from './push.mjs';
import { setupInstallPrompt } from './install.mjs';
import { registerSW, reloadAssets, hardRefresh } from './ui/update.mjs';

// ─── Locale & Meta ───────────────────────────────────────────
function applyLocale() {
  const l = state.locale;
  const dir = l === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = l;
  document.documentElement.dir = dir;
  document.title = t('ogTitle', l);
  $('skip-link').textContent = l === 'ar' ? 'تخطي إلى المحتوى' : l === 'fr' ? 'Aller au contenu' : 'Skip to content';
  const ogLocaleMap = { ar: 'ar_MA', fr: 'fr_MA', en: 'en_US' };
  const setMeta = (sel, val) => { const el = document.querySelector(sel); if (el) el.setAttribute('content', val); };
  setMeta('meta[property="og:title"]', t('ogTitle', l));
  setMeta('meta[property="og:description"]', t('ogDescription', l));
  setMeta('meta[property="og:image:alt"]', t('ogImageAlt', l));
  setMeta('meta[property="og:locale"]', ogLocaleMap[l] || 'ar_MA');
  setMeta('meta[name="twitter:title"]', t('ogTitle', l));
  setMeta('meta[name="twitter:description"]', t('ogDescription', l));
  setMeta('meta[name="twitter:image:alt"]', t('ogImageAlt', l));
  setMeta('meta[name="description"]', t('ogDescription', l));
}

function renderAll() {
  applyLocale();
  renderPrayers(); renderQibla(); renderSettings();
  renderNav();
}

// ─── Events ───────────────────────────────────────────────────
function setupEvents() {
  // Navigation
  $('nav-prayers').addEventListener('click', () => switchView('prayers'));
  $('nav-qibla').addEventListener('click', () => switchView('qibla'));
  $('nav-settings').addEventListener('click', () => switchView('settings'));

  // Settings: city change
  $('s-city-select').addEventListener('change', e => {
    const city = CITIES.find(c => c.id === e.target.value);
    if (city) {
      state.position = { lat: city.lat, lng: city.lng, cityId: city.id, cityName: city.fr };
      saveState('waqt-position', state.position);
      renderPrayers(); renderQibla(); renderSettings();
    }
  });

  // Settings: language
  $('s-lang-select').addEventListener('change', e => {
    state.locale = e.target.value;
    saveState('waqt-locale', state.locale);
    renderAll();
  });

  // Settings: notifications
  $('s-notif-toggle').addEventListener('change', e => {
    state.notifications.enabled = e.target.checked;
    saveState('waqt-notifications', state.notifications);
    if (e.target.checked) requestNotifPermission(getPrayerTimes());
    checkNotifBar();
    if (e.target.checked) {
      requestNotifPermission(getPrayerTimes());
      preCacheSounds();
      $('s-notif-detail').classList.add('show');
    } else {
      $('s-notif-detail').classList.remove('show');
      // Clear scheduled timeouts
      clearAppBadge();
    }
    checkNotifBar();
    if (e.target.checked && VAPID_PUBLIC_KEY) {
      subscribeToPush().catch(() => { /* ignore */ });
    } else if (!e.target.checked) {
      unsubscribeFromPush().catch(() => { /* ignore */ });
    }
    const permBadge = $('s-notif-perm-badge');
    if ('Notification' in window) {
      setTimeout(() => {
        const p = Notification.permission;
        permBadge.textContent = t(p === 'granted' ? 'notifPermGranted' : p === 'denied' ? 'notifPermDenied' : 'notifPermDefault', state.locale);
        permBadge.className = 'notif-perm-badge ' + p;
      }, 500);
    }
  });

  // Notification advance
  $('s-notif-advance').addEventListener('change', e => {
    state.notifications.advance = parseInt(e.target.value, 10);
    saveState('waqt-notifications', state.notifications);
    scheduleNotifications(getPrayerTimes());
  });

  // Notification sound — pre-notification
  $('s-notif-sound-pre').addEventListener('change', e => {
    state.notifications.soundPre = e.target.value;
    saveState('waqt-notifications', state.notifications);
    syncNotifDataToSW(getPrayerTimes());
  });

  // Test pre-notification sound
  $('btn-test-sound-pre').addEventListener('click', () => {
    const snd = state.notifications.soundPre || 'tone';
    if (snd !== 'silent') playNotifSound(snd);
    if (state.notifications.vibrate && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  });

  // Notification sound — at prayer time
  $('s-notif-sound-at').addEventListener('change', e => {
    state.notifications.soundAt = e.target.value;
    saveState('waqt-notifications', state.notifications);
    syncNotifDataToSW(getPrayerTimes());
  });

  // Test at-time sound
  $('btn-test-sound-at').addEventListener('click', () => {
    const snd = state.notifications.soundAt || 'adhan';
    if (snd !== 'silent') playNotifSound(snd);
    if (state.notifications.vibrate && navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
  });

  // Vibrate toggle
  $('s-notif-vibrate').addEventListener('change', e => {
    state.notifications.vibrate = e.target.checked;
    saveState('waqt-notifications', state.notifications);
  });

  // Badge toggle
  $('s-notif-badge').addEventListener('change', e => {
    state.notifications.badge = e.target.checked;
    saveState('waqt-notifications', state.notifications);
    if (!e.target.checked) clearAppBadge();
  });

  // Test notification
  $('btn-test-notif').addEventListener('click', sendTestNotification);
  // Notification tester popup
  $('btn-test-notif').addEventListener('click', () => {
    $('notif-test-status').textContent = '';
    $('notif-test-send').disabled = false;
    const opts = $('notif-test-options').querySelectorAll('.notif-test-opt');
    opts.forEach(o => o.classList.remove('selected'));
    opts[0].classList.add('selected');
    opts[0].querySelector('input').checked = true;
    $('notif-test-overlay').classList.add('show');
  });
  $('notif-test-options').addEventListener('change', () => {
    const opts = $('notif-test-options').querySelectorAll('.notif-test-opt');
    opts.forEach(o => {
      o.classList.toggle('selected', o.querySelector('input').checked);
    });
    $('notif-test-status').textContent = '';
    $('notif-test-send').disabled = false;
  });
  $('notif-test-cancel').addEventListener('click', () => {
    $('notif-test-overlay').classList.remove('show');
  });
  $('notif-test-overlay').addEventListener('click', e => {
    if (e.target === $('notif-test-overlay')) $('notif-test-overlay').classList.remove('show');
  });
  $('notif-test-send').addEventListener('click', async () => {
    const delay = parseInt(document.querySelector('input[name="notif-test-delay"]:checked').value, 10);
    const btn = $('notif-test-send');
    btn.disabled = true;

    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') {
      $('notif-test-status').textContent = t('notifBlocked', state.locale);
      return;
    }
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    }

    if (delay === 0) {
      fireTestNotification();
      $('notif-test-status').textContent = t('notifTestSent', state.locale);
      setTimeout(() => $('notif-test-overlay').classList.remove('show'), 1200);
    } else {
      setTimeout(() => fireTestNotification(), delay * 1000);
      const label = delay < 60 ? t('notifTest10s', state.locale) : delay < 300 ? t('notifTest1m', state.locale) : t('notifTest5m', state.locale);
      $('notif-test-status').textContent = t('notifTestScheduled', state.locale) + ' (' + label + ')';
      setTimeout(() => $('notif-test-overlay').classList.remove('show'), 1500);
    }
  });

  // Help popup
  $('help-fab').addEventListener('click', () => {
    $('help-popup-overlay').classList.add('show');
  });
  $('help-popup-close').addEventListener('click', () => {
    $('help-popup-overlay').classList.remove('show');
  });
  $('help-popup-overlay').addEventListener('click', (e) => {
    if (e.target === $('help-popup-overlay')) $('help-popup-overlay').classList.remove('show');
  });

  // Share
  $('help-link-share').addEventListener('click', async () => {
    const base = 'https://waqtsalat.github.io/waqtsalat/';
    const url = state.locale === 'ar' ? base : base + '?lang=' + state.locale;
    const title = t('ogTitle', state.locale);
    const text = t('ogDescription', state.locale);
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); } catch (e) { /* ignore */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        showShareToast(t('shareCopied', state.locale));
      } catch (e) {
        const inp = document.createElement('input');
        inp.value = url; document.body.appendChild(inp);
        inp.select(); document.execCommand('copy');
        document.body.removeChild(inp);
        showShareToast(t('shareCopied', state.locale));
      }
    }
    $('help-popup-overlay').classList.remove('show');
  });

  // Compass
  $('btn-compass').addEventListener('click', startCompass);

  // AR
  $('btn-ar').addEventListener('click', () => {
    import('./ar.mjs').then(({ startAR }) => startAR());
  });
  $('ar-close').addEventListener('click', () => {
    import('./ar.mjs').then(({ stopAR }) => stopAR());
  });

  // Export
  $('btn-export').addEventListener('click', () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('waqt-')) data[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date().toISOString().slice(0, 10);
    a.download = 'waqtsalat-config-' + d + '.json';
    a.click(); URL.revokeObjectURL(a.href);
  });

  // Import
  $('btn-import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        for (const [k, v] of Object.entries(data)) {
          if (k.startsWith('waqt-')) localStorage.setItem(k, v);
        }
        loadState(); renderAll();
      } catch (err) { /* ignore */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Reset
  $('btn-reset').addEventListener('click', () => {
    if (!confirm(t('resetConfirm', state.locale))) return;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('waqt-')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    location.reload();
  });

  // Hard refresh
  $('btn-hard-refresh').addEventListener('click', hardRefresh);

  // Reload assets button
  $('reload-fab').addEventListener('click', reloadAssets);

  // Visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.position) {
      renderPrayers();
      scheduleNotifications(getPrayerTimes());
    }
  });
}

// ─── Boot ─────────────────────────────────────────────────────
loadState();

// URL ?lang= parameter overrides saved locale
const urlParams = new URLSearchParams(location.search);
const urlLang = urlParams.get('lang');
if (urlLang && TRANSLATIONS[urlLang]) {
  state.locale = urlLang;
  saveState('waqt-locale', urlLang);
  urlParams.delete('lang');
  const clean = urlParams.toString();
  history.replaceState(null, '', location.pathname + (clean ? '?' + clean : ''));
} else if (!localStorage.getItem('waqt-locale')) {
  const lang = navigator.language?.slice(0, 2);
  if (TRANSLATIONS[lang]) state.locale = lang;
}

applyLocale();
$('help-popup-version').textContent = `v1.0.0 · ${__BUILD_TIMESTAMP__}`;
setupOnboarding(applyLocale, renderAll);
setupEvents();
setupSoundStopListeners();
if (state.onboarded && state.position) renderAll();
registerSW(stopNotifSound, scheduleNotifications, playNotifSound, setAppBadge, wakeScreen, getPrayerTimes);
setupInstallPrompt();
checkNotifBar();
if (state.notifications.enabled && state.position) scheduleNotifications(getPrayerTimes());
if (state.notifications.enabled) preCacheSounds();
document.addEventListener('visibilitychange', () => { if (!document.hidden) clearAppBadge(); });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(reg => {
    if (reg.periodicSync) {
      reg.periodicSync.register('reschedule-notifications', { minInterval: 15 * 60 * 1000 }).catch(() => { /* ignore */ });
    }
  });
}
