/**
 * Audio playback and sound caching.
 * Sounds from: https://github.com/beentheretwice/open-sounds
 */

import { $ } from './utils.mjs';
import { t } from './i18n.mjs';
import { state } from './state.mjs';

export const SOUND_URLS = {
  adhan: 'https://raw.githubusercontent.com/beentheretwice/open-sounds/master/adhan/athan_makkah_official.mp3',
  tone: 'https://raw.githubusercontent.com/beentheretwice/open-sounds/master/notifications/notification_soft_beep.mp3'
};
export const SOUND_CACHE_NAME = 'waqtsalat-sounds-v1';
let soundsReady = false;
let currentAudio = null;

export async function preCacheSounds() {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(SOUND_CACHE_NAME);
    const keys = await cache.keys();
    const cached = keys.map(k => k.url);
    const toFetch = Object.values(SOUND_URLS).filter(u => !cached.some(c => c.endsWith(new URL(u).pathname)));
    if (toFetch.length === 0) { soundsReady = true; updateSoundStatus(); return; }
    updateSoundStatus('loading');
    await Promise.all(toFetch.map(async u => {
      try {
        const resp = await fetch(u, { mode: 'cors' });
        if (resp.ok) await cache.put(u, resp);
      } catch (e) { /* ignore */ }
    }));
    soundsReady = true;
    updateSoundStatus();
  } catch (e) { soundsReady = false; }
}

export function updateSoundStatus(status) {
  const dot = $('s-sound-status-dot');
  const txt = $('s-sound-status-text');
  if (!dot || !txt) return;
  if (status === 'loading') {
    dot.className = 'status-dot loading';
    txt.textContent = t('notifLoading', state.locale);
  } else if (soundsReady) {
    dot.className = 'status-dot ready';
    txt.textContent = t('notifSoundsReady', state.locale);
  } else {
    dot.className = 'status-dot';
    txt.textContent = '';
  }
}

export async function playNotifSound(type) {
  if (type === 'silent') return;
  stopNotifSound();
  const url = SOUND_URLS[type];
  if (!url) return;
  try {
    let audioUrl = url;
    if ('caches' in window) {
      const cache = await caches.open(SOUND_CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) {
        const blob = await cached.clone().blob();
        audioUrl = URL.createObjectURL(blob);
      }
    }
    currentAudio = new Audio(audioUrl);
    currentAudio.volume = 1.0;
    await currentAudio.play();
  } catch (e) {
    try {
      currentAudio = new Audio(url);
      await currentAudio.play();
    } catch (e2) { /* ignore */ }
  }
}

export function stopNotifSound() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    if (currentAudio.src.startsWith('blob:')) URL.revokeObjectURL(currentAudio.src);
    currentAudio = null;
  }
}

// Stop sound on ANY user interaction
export function setupSoundStopListeners() {
  ['keydown', 'mousedown', 'touchstart', 'pointerdown'].forEach(evt => {
    document.addEventListener(evt, () => stopNotifSound(), { passive: true });
  });
  document.addEventListener('visibilitychange', () => stopNotifSound());
}
