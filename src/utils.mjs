import { getCasablancaOffset } from './prayer.mjs';

export function $(id) { return document.getElementById(id); }

/**
 * Current time as a Casablanca wall-clock Date.
 *
 * Returns a Date shifted so that its UTC accessors (getUTCHours,
 * getUTCMinutes, getUTCDate, ...) report the Casablanca wall time.
 * The shift uses the decree-aware offset from prayer.mjs, so the result
 * is independent of the device's tzdata freshness — a device whose
 * tzdata predates the 2026-09-20 DST abolition would otherwise report
 * GMT+1 wall time. Never use local accessors on the returned Date.
 */
export function nowInCasa() {
  const now = new Date();
  return new Date(now.getTime() + getCasablancaOffset(now) * 60000);
}

export function showShareToast(msg) {
  const el = $('share-toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._tid);
  el._tid = setTimeout(() => el.classList.remove('show'), 2500);
}
