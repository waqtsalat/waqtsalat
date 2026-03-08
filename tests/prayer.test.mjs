import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  toJulianDate,
  solarPosition,
  calculatePrayerTimes,
  getPrayerTimesForDate,
  getCasablancaOffset,
  calculateQibla,
  distanceToKaaba,
} from '../src/prayer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Julian Date', () => {
  it('computes JD for J2000.0 epoch (2000-01-01 12:00 TT)', () => {
    // J2000.0 = JD 2451545.0 at noon Jan 1 2000
    const jd = toJulianDate(2000, 1, 1.5);
    expect(jd).toBeCloseTo(2451545.0, 1);
  });

  it('computes JD for 1999-01-01', () => {
    const jd = toJulianDate(1999, 1, 1);
    expect(jd).toBeCloseTo(2451179.5, 1);
  });

  it('computes JD for 2025-06-15', () => {
    // Known value
    const jd = toJulianDate(2025, 6, 15);
    expect(jd).toBeCloseTo(2460841.5, 1);
  });
});

describe('Solar Position', () => {
  it('computes declination near summer solstice 2025', () => {
    const jd = toJulianDate(2025, 6, 21);
    const { declination } = solarPosition(jd + 0.5);
    // Summer solstice: declination ~23.44°
    expect(declination).toBeCloseTo(23.44, 0);
  });

  it('computes declination near winter solstice 2025', () => {
    const jd = toJulianDate(2025, 12, 21);
    const { declination } = solarPosition(jd + 0.5);
    // Winter solstice: declination ~-23.44°
    expect(declination).toBeCloseTo(-23.44, 0);
  });

  it('computes declination near equinox 2025', () => {
    const jd = toJulianDate(2025, 3, 20);
    const { declination } = solarPosition(jd + 0.5);
    // Near equinox: declination ~0°
    expect(Math.abs(declination)).toBeLessThan(1);
  });

  it('equation of time is within expected range', () => {
    // EqT is always between about -17 and +14 minutes
    for (let month = 1; month <= 12; month++) {
      const jd = toJulianDate(2025, month, 15);
      const { equationOfTime } = solarPosition(jd + 0.5);
      expect(equationOfTime).toBeGreaterThan(-18);
      expect(equationOfTime).toBeLessThan(17);
    }
  });
});

describe('Prayer Times Calculation', () => {
  // Rabat coordinates
  const RABAT = { lat: 34.0209, lng: -6.8416 };

  it('calculates prayer times for Rabat (basic sanity)', () => {
    const date = new Date(2025, 0, 15); // Jan 15, 2025
    const times = calculatePrayerTimes(date, RABAT.lat, RABAT.lng);

    // All prayers should be defined
    expect(times.fajr).not.toBeNull();
    expect(times.sunrise).not.toBeNull();
    expect(times.dhuhr).not.toBeNull();
    expect(times.asr).not.toBeNull();
    expect(times.maghrib).not.toBeNull();
    expect(times.isha).not.toBeNull();
  });

  it('prayer times are in correct chronological order', () => {
    const date = new Date(2025, 5, 15); // Jun 15
    const times = calculatePrayerTimes(date, RABAT.lat, RABAT.lng);

    const toMin = (hm) => hm.hours * 60 + hm.minutes;
    expect(toMin(times.fajr)).toBeLessThan(toMin(times.sunrise));
    expect(toMin(times.sunrise)).toBeLessThan(toMin(times.dhuhr));
    expect(toMin(times.dhuhr)).toBeLessThan(toMin(times.asr));
    expect(toMin(times.asr)).toBeLessThan(toMin(times.maghrib));
    expect(toMin(times.maghrib)).toBeLessThan(toMin(times.isha));
  });

  it('Dhuhr is approximately at solar noon (around 12:00-13:00 UTC for Rabat)', () => {
    const date = new Date(2025, 5, 15);
    const times = calculatePrayerTimes(date, RABAT.lat, RABAT.lng);
    // Rabat is at ~-6.84° lng, so solar noon is ~12:27 UTC
    const dhuhrUTC = times.dhuhr.hours + times.dhuhr.minutes / 60;
    expect(dhuhrUTC).toBeGreaterThan(11.5);
    expect(dhuhrUTC).toBeLessThan(13.5);
  });

  it('getPrayerTimesForDate returns formatted strings', () => {
    const date = new Date(2025, 0, 15);
    const result = getPrayerTimesForDate(date, RABAT.lat, RABAT.lng);

    for (const prayer of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      expect(result[prayer]).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it('adjustments shift prayer times', () => {
    const date = new Date(2025, 0, 15);
    const base = getPrayerTimesForDate(date, RABAT.lat, RABAT.lng);
    const adjusted = getPrayerTimesForDate(date, RABAT.lat, RABAT.lng, { fajr: 5 });

    // Parse times
    const [bh, bm] = base.fajr.split(':').map(Number);
    const [ah, am] = adjusted.fajr.split(':').map(Number);
    const diff = (ah * 60 + am) - (bh * 60 + bm);
    expect(diff).toBe(5);
  });
});

describe('Casablanca Timezone Offset', () => {
  it('returns a valid offset (0 or 60 minutes)', () => {
    const winterDate = new Date(2025, 0, 15); // January — GMT+1
    const offset = getCasablancaOffset(winterDate);
    // Morocco uses GMT+1 in winter (since 2018 decree)
    expect([0, 60]).toContain(offset);
  });

  it('handles summer date', () => {
    const summerDate = new Date(2025, 6, 15); // July
    const offset = getCasablancaOffset(summerDate);
    expect([0, 60]).toContain(offset);
  });
});

describe('Qibla', () => {
  it('calculates Qibla direction from Rabat (~80-110° ESE)', () => {
    const qibla = calculateQibla(34.0209, -6.8416);
    expect(qibla).toBeGreaterThan(70);
    expect(qibla).toBeLessThan(120);
  });

  it('calculates Qibla direction from Dakhla (more easterly)', () => {
    const qibla = calculateQibla(23.7148, -15.957);
    expect(qibla).toBeGreaterThan(50);
    expect(qibla).toBeLessThan(100);
  });

  it('distance to Kaaba from Rabat is ~4000-5500 km', () => {
    const dist = distanceToKaaba(34.0209, -6.8416);
    expect(dist).toBeGreaterThan(4000);
    expect(dist).toBeLessThan(5500);
  });

  it('distance to Kaaba from Dakhla is ~5000-6500 km', () => {
    const dist = distanceToKaaba(23.7148, -15.957);
    expect(dist).toBeGreaterThan(5000);
    expect(dist).toBeLessThan(7000);
  });
});

describe('Rabat reference dataset (Al-Adhan method=21, Morocco)', () => {
  const dataset = JSON.parse(
    readFileSync(resolve(__dirname, 'data', 'rabat-reference.json'), 'utf8')
  );
  const { lat, lng, data: entries } = dataset;

  const parseHHMM = (s) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };

  for (const entry of entries) {
    const [y, m, d] = entry.date.split('-').map(Number);

    it(`matches reference for ${entry.date}`, () => {
      const date = new Date(y, m - 1, d);
      const result = getPrayerTimesForDate(date, lat, lng);

      for (const prayer of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        const calc = parseHHMM(result[prayer]);
        const ref = parseHHMM(entry[prayer]);
        const diff = Math.abs(calc - ref);
        expect(diff, `${prayer} on ${entry.date}: calc=${result[prayer]}, ref=${entry[prayer]}`).toBeLessThanOrEqual(1);
      }
    });
  }
});
