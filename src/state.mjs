import { TRANSLATIONS } from './i18n.mjs';

export const state = {
  locale: 'ar',
  position: null, // {lat,lng,cityId,cityName}
  adjustments: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  notifications: { enabled: false, prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }, advance: 0, soundPre: 'tone', soundAt: 'adhan', vibrate: true, badge: true },
  onboarded: false,
  currentView: 'prayers',
};

export function loadState() {
  try {
    const loc = localStorage.getItem('waqt-locale');
    if (loc && TRANSLATIONS[loc]) state.locale = loc;
    const pos = localStorage.getItem('waqt-position');
    if (pos) state.position = JSON.parse(pos);
    const adj = localStorage.getItem('waqt-adjustments');
    if (adj) state.adjustments = { ...state.adjustments, ...JSON.parse(adj) };
    const notif = localStorage.getItem('waqt-notifications');
    if (notif) {
      const saved = JSON.parse(notif);
      // Migrate: old 'sound' key → split into soundPre/soundAt
      if (saved.sound && !saved.soundAt) { saved.soundAt = saved.sound; saved.soundPre = saved.soundPre || 'tone'; delete saved.sound; }
      state.notifications = { ...state.notifications, ...saved };
    }
    state.onboarded = localStorage.getItem('waqt-onboarded') === 'true';
  } catch (e) { /* ignore */ }
}

export function saveState(key, val) {
  try { localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val)); } catch (e) { /* ignore */ }
}
