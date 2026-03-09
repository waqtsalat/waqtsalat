import { describe, it, expect } from 'vitest';
import { getPrayerTimesForDate } from '../src/prayer.mjs';

// ─── Simplified calcPrayers (same algorithm as GitHub Action workflow) ─
const DEG = Math.PI / 180, RAD = 180 / Math.PI;
function mod360(x) { return ((x % 360) + 360) % 360; }

function getCasaOffset(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Casablanca', timeZoneName: 'shortOffset'
  }).formatToParts(date);
  const tz = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+1';
  return parseInt((tz.match(/GMT([+-]?\d+)?/) || [])[1] || '1', 10) * 60;
}

function calcPrayers(date, lat, lng) {
  const toJD = (y, m, d) => {
    if (m <= 2) { y--; m += 12; }
    const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  };
  const jd = toJD(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const T = (jd + 0.5 - 2451545) / 36525;
  const L0 = mod360(280.46646 + 36000.76983 * T);
  const M = mod360(357.52911 + 35999.05029 * T);
  const Mr = M * DEG;
  const C = (1.914602 - 0.004817 * T) * Math.sin(Mr) + 0.019993 * Math.sin(2 * Mr);
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  const eps = 23.439 + 0.00256 * Math.cos(omega * DEG);
  const dec = Math.asin(Math.sin(eps * DEG) * Math.sin(lambda * DEG)) * RAD;
  const y2 = Math.tan(eps * DEG / 2) ** 2;
  const eqt = 4 * RAD * (y2 * Math.sin(2 * L0 * DEG) - 2 * 0.016709 * Math.sin(Mr));
  const transit = 12 + (-lng / 15) - (eqt / 60);
  const ha = angle => {
    const c = (Math.sin(-angle * DEG) - Math.sin(lat * DEG) * Math.sin(dec * DEG))
      / (Math.cos(lat * DEG) * Math.cos(dec * DEG));
    return Math.abs(c) > 1 ? null : Math.acos(c) * RAD / 15;
  };
  const off = getCasaOffset(date);
  const fmt = utcH => {
    if (utcH === null) return null;
    let tot = ((utcH * 60 + off) % 1440 + 1440) % 1440;
    let h = Math.floor(tot / 60), m = Math.round(tot % 60);
    if (m === 60) { m = 0; h = (h + 1) % 24; }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const hSun = ha(0.8333), hFajr = ha(19), hIsha = ha(17);
  const asrA = Math.atan(1 / (1 + Math.tan(Math.abs(lat - dec) * DEG))) * RAD;
  return {
    fajr: fmt(hFajr !== null ? transit - hFajr : null),
    dhuhr: fmt(transit + 5 / 60),
    asr: fmt(ha(-asrA) !== null ? transit + ha(-asrA) : null),
    maghrib: fmt(hSun !== null ? transit + hSun + 5 / 60 : null),
    isha: fmt(hIsha !== null ? transit + hIsha : null),
  };
}

// ─── Helper: parse HH:MM to minutes ──────────────────────────
function toMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// ─── Test cities ─────────────────────────────────────────────
const CITIES = [
  { name: 'Rabat', lat: 34.0209, lng: -6.8416 },
  { name: 'Casablanca', lat: 33.5731, lng: -7.5898 },
  { name: 'Agadir', lat: 30.4278, lng: -9.5981 },
  { name: 'Laayoune', lat: 27.1536, lng: -13.2033 },
];

// Representative dates: winter, spring, summer, autumn
const DATES = [
  new Date(2025, 0, 15),   // Jan 15 — winter
  new Date(2025, 3, 15),   // Apr 15 — spring
  new Date(2025, 6, 15),   // Jul 15 — summer
  new Date(2025, 9, 15),   // Oct 15 — autumn
];

const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const TOLERANCE_MIN = 1; // ±1 minute tolerance

describe('Push workflow calcPrayers vs prayer.mjs getPrayerTimesForDate', () => {
  for (const city of CITIES) {
    for (const date of DATES) {
      const label = `${city.name} on ${date.toISOString().slice(0, 10)}`;

      it(`matches within ±${TOLERANCE_MIN} min for ${label}`, () => {
        const reference = getPrayerTimesForDate(date, city.lat, city.lng);
        const workflow = calcPrayers(date, city.lat, city.lng);

        for (const k of PRAYER_KEYS) {
          const refMin = toMinutes(reference[k]);
          const wfMin = toMinutes(workflow[k]);

          if (refMin === null || wfMin === null) {
            // Both should be null if one is
            expect(wfMin).toBe(refMin);
            continue;
          }

          const diff = Math.abs(refMin - wfMin);
          expect(diff, `${k}: ref=${reference[k]} vs wf=${workflow[k]} (diff=${diff}min)`).toBeLessThanOrEqual(TOLERANCE_MIN);
        }
      });
    }
  }
});
