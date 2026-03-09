/**
 * PWA Install prompt and platform detection.
 */

import { state } from './state.mjs';
import { t } from './i18n.mjs';
import { $ } from './utils.mjs';

let deferredInstallPrompt = null;

export function getDeferredInstallPrompt() { return deferredInstallPrompt; }

export function isStandalone() {
  return window.matchMedia('(display-mode:standalone)').matches
    || window.navigator.standalone === true;
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export function detectPlatform() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  if (/iPad|iPhone|iPod/.test(ua) || (/Mac/.test(platform) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Win/.test(platform)) return 'windows';
  if (/Mac/.test(platform)) return 'mac';
  if (/Linux/.test(platform)) return 'linux';
  return 'unknown';
}

export function getDndInstructions() {
  const p = detectPlatform();
  if (p === 'android') return t('notifDndAndroid', state.locale);
  if (p === 'ios') return t('notifDndIos', state.locale);
  if (p === 'windows') return t('notifDndWindows', state.locale);
  if (p === 'mac') return t('notifDndMac', state.locale);
  return t('notifDndGeneric', state.locale);
}

export function setupInstallPrompt() {
  if (isStandalone()) return;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallBanner('native');
  });
  window.addEventListener('appinstalled', () => {
    $('install-banner').classList.remove('show');
    deferredInstallPrompt = null;
  });

  if (state.onboarded && !sessionStorage.getItem('waqt-install-dismissed')) {
    setTimeout(() => {
      if (!deferredInstallPrompt && !isStandalone()) {
        showInstallBanner(isIOS() ? 'ios' : 'manual');
      }
    }, 3000);
  }
}

export function showInstallBanner(mode) {
  const banner = $('install-banner');
  $('install-title').textContent = t('installApp', state.locale);
  $('btn-install-later').textContent = t('later', state.locale);

  if (mode === 'native') {
    $('install-desc').textContent = t('installDesc', state.locale);
    $('btn-install').textContent = t('install', state.locale);
    $('btn-install').style.display = '';
    $('btn-install').onclick = () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(() => {
          deferredInstallPrompt = null;
          banner.classList.remove('show');
        });
      }
    };
  } else if (mode === 'ios') {
    $('install-desc').textContent = t('installIOS', state.locale).replace('{icon}', '\u2B06');
    $('btn-install').style.display = 'none';
  } else {
    $('install-desc').textContent = t('installManual', state.locale);
    $('btn-install').style.display = 'none';
  }

  banner.classList.add('show');

  $('btn-install-later').onclick = () => {
    banner.classList.remove('show');
    sessionStorage.setItem('waqt-install-dismissed', '1');
  };
}
