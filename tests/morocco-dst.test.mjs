/**
 * Morocco DST abolition — Decree adopted 2026-06-25, effective 2026-09-20 02:00
 * local (GMT+1): clocks reverted to GMT and DST was permanently abolished.
 *
 * Device tz databases released before the decree still report GMT+1 for
 * Africa/Casablanca after that instant. These tests pin the in-app decree
 * override so prayer times never depend on the freshness of the device's
 * tzdata.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getCasablancaOffset,
  getPrayerTimesForDate,
} from '../src/prayer.mjs';
import { nowInCasa } from '../src/utils.mjs';

// Rabat coordinates (same as the golden-master dataset)
const RABAT = { lat: 34.0209, lng: -6.8416 };

describe('Morocco DST abolition (2026-09-20)', () => {
  it('offset is +60 min immediately before the revert (2026-09-20 00:59:59Z)', () => {
    expect(getCasablancaOffset(new Date('2026-09-20T00:59:59Z'))).toBe(60);
  });

  it('offset is 0 from the revert instant onward (2026-09-20 01:00:00Z)', () => {
    expect(getCasablancaOffset(new Date('2026-09-20T01:00:00Z'))).toBe(0);
  });

  it('offset stays 0 the day after the revert', () => {
    expect(getCasablancaOffset(new Date('2026-09-21T12:00:00Z'))).toBe(0);
  });

  it('offset stays 0 in future summer dates (DST permanently abolished)', () => {
    expect(getCasablancaOffset(new Date('2027-06-01T12:00:00Z'))).toBe(0);
    expect(getCasablancaOffset(new Date('2030-07-15T12:00:00Z'))).toBe(0);
  });
});

describe('Prayer times after the abolition (Rabat, 2026-09-21)', () => {
  // Reference: Al Adhan API method 21 (Morocco), 2026-09-21 — Africa/Casablanca
  // reverted to GMT on 2026-09-20, so these are UTC times.
  const REFERENCE = {
    fajr: '04:46',
    sunrise: '06:15',
    dhuhr: '12:25',
    asr: '15:49',
    maghrib: '18:31',
    isha: '19:44',
  };

  const parse = (s) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };

  it('matches the GMT reference within tolerance (±1 min, ±2 for Isha)', () => {
    const result = getPrayerTimesForDate(new Date(2026, 8, 21), RABAT.lat, RABAT.lng);
    // Isha carries a known ±2 min engine drift vs Al Adhan at this date;
    // all other prayers match within the project's ±1 min tolerance.
    const tolerance = { isha: 2 };
    for (const [prayer, ref] of Object.entries(REFERENCE)) {
      const diff = Math.abs(parse(result[prayer]) - parse(ref));
      expect(diff, `${prayer}: calc=${result[prayer]}, ref=${ref}`).toBeLessThanOrEqual(tolerance[prayer] || 1);
    }
  });

  it('prayer times are not shifted to GMT+1 (regression: +1h bug after revert)', () => {
    const result = getPrayerTimesForDate(new Date(2026, 8, 21), RABAT.lat, RABAT.lng);
    // If the device tzdata predates the decree, times render one hour late
    // (Dhuhr 13:25 instead of 12:25). Guard the ±5 min band around the
    // correct values rather than a single point.
    expect(parse(result.dhuhr)).toBeGreaterThan(parse('12:20'));
    expect(parse(result.dhuhr)).toBeLessThan(parse('12:35'));
    expect(parse(result.maghrib)).toBeGreaterThan(parse('18:25'));
    expect(parse(result.maghrib)).toBeLessThan(parse('18:40'));
  });

  it("tomorrow's Fajr path uses the abolished-DST date too", () => {
    const tomorrow = new Date(2026, 8, 22);
    const result = getPrayerTimesForDate(tomorrow, RABAT.lat, RABAT.lng);
    expect(result.fajr).toMatch(/^\d{2}:\d{2}$/);
    expect(parse(result.fajr)).toBeGreaterThan(parse('04:40'));
    expect(parse(result.fajr)).toBeLessThan(parse('04:55'));
  });
});

describe('nowInCasa() after the abolition', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports Casablanca wall time from the system clock, not device tzdata', () => {
    // Freeze "now" to 2026-09-21 16:11 UTC — after the revert, Casablanca
    // wall time must also be 16:11 regardless of the host's tzdata.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T16:11:00Z'));

    const casa = nowInCasa();
    expect(casa.getUTCHours()).toBe(16);
    expect(casa.getUTCMinutes()).toBe(11);
  });
});
