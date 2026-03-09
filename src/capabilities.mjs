/**
 * Device capability detection and rendering.
 */

import { state } from './state.mjs';
import { t } from './i18n.mjs';
import { $ } from './utils.mjs';
import { detectPlatform, getDeferredInstallPrompt } from './install.mjs';

export function detectCapabilities() {
  const caps = [];

  // 1. Notifications
  try {
    const api = 'Notification' in window;
    let status = 'available';
    let perm = null;
    if (api) {
      perm = Notification.permission;
      if (perm === 'denied') status = 'partial';
    } else { status = 'unavailable'; }
    caps.push({ id: 'notif', name: t('capNotif', state.locale), desc: t('capNotifDesc', state.locale), status, perm });
  } catch (e) { caps.push({ id: 'notif', name: t('capNotif', state.locale), desc: t('capNotifDesc', state.locale), status: 'unavailable' }); }

  // 2. Geolocation
  try {
    const api = 'geolocation' in navigator;
    caps.push({ id: 'geo', name: t('capGeo', state.locale), desc: t('capGeoDesc', state.locale), status: api ? 'available' : 'unavailable' });
  } catch (e) { caps.push({ id: 'geo', name: t('capGeo', state.locale), desc: t('capGeoDesc', state.locale), status: 'unavailable' }); }

  // 3. Compass
  try {
    const api = 'DeviceOrientationEvent' in window;
    const needsPerm = typeof DeviceOrientationEvent.requestPermission === 'function';
    caps.push({ id: 'compass', name: t('capCompass', state.locale), desc: t('capCompassDesc', state.locale), status: api ? 'available' : 'unavailable',
      note: needsPerm ? '(requires permission)' : null });
  } catch (e) { caps.push({ id: 'compass', name: t('capCompass', state.locale), desc: t('capCompassDesc', state.locale), status: 'unavailable' }); }

  // 4. AR
  try {
    const hasOrientation = 'DeviceOrientationEvent' in window;
    const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const status = hasOrientation && hasMedia ? 'available' : hasOrientation || hasMedia ? 'partial' : 'unavailable';
    caps.push({ id: 'ar', name: t('capAR', state.locale), desc: t('capARDesc', state.locale), status });
  } catch (e) { caps.push({ id: 'ar', name: t('capAR', state.locale), desc: t('capARDesc', state.locale), status: 'unavailable' }); }

  // 5. Vibration
  try {
    caps.push({ id: 'vibrate', name: t('capVibrate', state.locale), desc: t('capVibrateDesc', state.locale),
      status: 'vibrate' in navigator ? 'available' : 'unavailable' });
  } catch (e) { caps.push({ id: 'vibrate', name: t('capVibrate', state.locale), desc: t('capVibrateDesc', state.locale), status: 'unavailable' }); }

  // 6. Screen Wake Lock
  try {
    caps.push({ id: 'wakeLock', name: t('capWakeLock', state.locale), desc: t('capWakeLockDesc', state.locale),
      status: 'wakeLock' in navigator ? 'available' : 'unavailable' });
  } catch (e) { caps.push({ id: 'wakeLock', name: t('capWakeLock', state.locale), desc: t('capWakeLockDesc', state.locale), status: 'unavailable' }); }

  // 7. Service Worker
  try {
    caps.push({ id: 'sw', name: t('capSW', state.locale), desc: t('capSWDesc', state.locale),
      status: 'serviceWorker' in navigator ? 'available' : 'unavailable' });
  } catch (e) { caps.push({ id: 'sw', name: t('capSW', state.locale), desc: t('capSWDesc', state.locale), status: 'unavailable' }); }

  // 8. Badge API
  try {
    caps.push({ id: 'badge', name: t('capBadge', state.locale), desc: t('capBadgeDesc', state.locale),
      status: 'setAppBadge' in navigator ? 'available' : 'unavailable' });
  } catch (e) { caps.push({ id: 'badge', name: t('capBadge', state.locale), desc: t('capBadgeDesc', state.locale), status: 'unavailable' }); }

  // 9. Share API
  try {
    caps.push({ id: 'share', name: t('capShare', state.locale), desc: t('capShareDesc', state.locale),
      status: 'share' in navigator ? 'available' : 'unavailable' });
  } catch (e) { caps.push({ id: 'share', name: t('capShare', state.locale), desc: t('capShareDesc', state.locale), status: 'unavailable' }); }

  // 10. Install (PWA)
  try {
    const isStandaloneMode = window.matchMedia('(display-mode:standalone)').matches || navigator.standalone;
    const canInstall = !!getDeferredInstallPrompt();
    const status = isStandaloneMode ? 'available' : canInstall ? 'available' : 'partial';
    caps.push({ id: 'install', name: t('capInstall', state.locale), desc: t('capInstallDesc', state.locale), status });
  } catch (e) { caps.push({ id: 'install', name: t('capInstall', state.locale), desc: t('capInstallDesc', state.locale), status: 'partial' }); }

  // 11. Periodic Background Sync
  try {
    const api = 'serviceWorker' in navigator;
    caps.push({ id: 'bgSync', name: t('capBgSync', state.locale), desc: t('capBgSyncDesc', state.locale),
      status: api ? 'partial' : 'unavailable' });
  } catch (e) { caps.push({ id: 'bgSync', name: t('capBgSync', state.locale), desc: t('capBgSyncDesc', state.locale), status: 'unavailable' }); }

  // 12. Camera
  try {
    const api = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    caps.push({ id: 'camera', name: t('capCamera', state.locale), desc: t('capCameraDesc', state.locale),
      status: api ? 'available' : 'unavailable' });
  } catch (e) { caps.push({ id: 'camera', name: t('capCamera', state.locale), desc: t('capCameraDesc', state.locale), status: 'unavailable' }); }

  // 13. DND
  try {
    const notifApi = 'Notification' in window;
    let dndStatus = 'partial';
    let dndNote = t('capDndUnknown', state.locale);
    if (!notifApi) {
      dndStatus = 'unavailable';
    } else if (Notification.permission === 'denied') {
      dndStatus = 'unavailable';
      dndNote = t('capPermDenied', state.locale);
    } else if (Notification.permission === 'granted') {
      dndStatus = 'partial';
      dndNote = detectPlatform() + ' — ' + t('capDndUnknown', state.locale);
    }
    caps.push({ id: 'dnd', name: t('capDnd', state.locale), desc: t('capDndDesc', state.locale), status: dndStatus, note: dndNote });
  } catch (e) { caps.push({ id: 'dnd', name: t('capDnd', state.locale), desc: t('capDndDesc', state.locale), status: 'partial', note: t('capDndUnknown', state.locale) }); }

  return caps;
}

export function renderCapabilities() {
  const caps = detectCapabilities();
  $('s-cap-title').textContent = t('capTitle', state.locale);

  const avail = caps.filter(c => c.status === 'available').length;
  const partial = caps.filter(c => c.status === 'partial').length;
  const unavail = caps.filter(c => c.status === 'unavailable').length;
  const summary = $('s-cap-summary');
  summary.innerHTML =
    '<span class="cap-summary-count"><span class="cap-dot available"></span>' + avail + ' ' + t('capAvailable', state.locale) + '</span>' +
    (partial ? '<span class="cap-summary-count"><span class="cap-dot partial"></span>' + partial + ' ' + t('capPartial', state.locale) + '</span>' : '') +
    '<span class="cap-summary-count"><span class="cap-dot unavailable"></span>' + unavail + ' ' + t('capUnavailable', state.locale) + '</span>';

  const grid = $('s-cap-grid');
  grid.innerHTML = '';
  caps.forEach(cap => {
    const item = document.createElement('div');
    item.className = 'cap-item ' + cap.status;
    item.setAttribute('role', 'listitem');

    const dot = document.createElement('span');
    dot.className = 'cap-dot ' + cap.status;

    const info = document.createElement('div');
    info.className = 'cap-info';

    const name = document.createElement('span');
    name.className = 'cap-name';
    name.textContent = cap.name;

    const desc = document.createElement('span');
    desc.className = 'cap-desc';
    desc.textContent = cap.desc;

    info.appendChild(name);
    info.appendChild(desc);

    if (cap.perm) {
      const permEl = document.createElement('span');
      permEl.className = 'cap-perm ' + (cap.perm === 'granted' ? 'granted' : cap.perm === 'denied' ? 'denied' : 'prompt');
      permEl.textContent = t(cap.perm === 'granted' ? 'capPermGranted' : cap.perm === 'denied' ? 'capPermDenied' : 'capPermPrompt', state.locale);
      info.appendChild(permEl);
    }
    if (cap.note) {
      const noteEl = document.createElement('span');
      noteEl.className = 'cap-note';
      noteEl.textContent = cap.note;
      info.appendChild(noteEl);
    }

    item.appendChild(dot);
    item.appendChild(info);
    grid.appendChild(item);
  });

  // Async check: Periodic Background Sync
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      const bgItem = grid.querySelector('.cap-item:nth-child(11)');
      if (!bgItem) return;
      if (reg.periodicSync) {
        bgItem.className = 'cap-item available';
        bgItem.querySelector('.cap-dot').className = 'cap-dot available';
      } else {
        bgItem.className = 'cap-item unavailable';
        bgItem.querySelector('.cap-dot').className = 'cap-dot unavailable';
      }
    }).catch(() => { /* ignore */ });
  }
}
