import { describe, it, expect } from 'vitest';
import { findMatchingPrayers } from '../scripts/send-push.mjs';
import { getPrayerTimesForDate } from '../src/prayer.mjs';

describe('Push notification prayer matching', () => {
  const allPrayers = { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };

  it('matches a prayer at exact time', () => {
    const times = { fajr: '06:00', dhuhr: '13:05', asr: '16:30', maghrib: '19:00', isha: '20:30' };
    const matches = findMatchingPrayers(times, 13 * 60 + 5, allPrayers, 0);
    expect(matches).toHaveLength(1);
    expect(matches[0].prayer).toBe('dhuhr');
    expect(matches[0].type).toBe('at-time');
  });

  it('matches within +/- 2 minute tolerance', () => {
    const times = { fajr: '06:00', dhuhr: '13:05', asr: '16:30', maghrib: '19:00', isha: '20:30' };
    const matches = findMatchingPrayers(times, 13 * 60 + 7, allPrayers, 0);
    expect(matches).toHaveLength(1);
    expect(matches[0].prayer).toBe('dhuhr');
  });

  it('does not match outside tolerance', () => {
    const times = { fajr: '06:00', dhuhr: '13:05', asr: '16:30', maghrib: '19:00', isha: '20:30' };
    const matches = findMatchingPrayers(times, 13 * 60 + 8, allPrayers, 0);
    expect(matches).toHaveLength(0);
  });

  it('respects per-prayer toggles', () => {
    const times = { fajr: '06:00', dhuhr: '13:05', asr: '16:30', maghrib: '19:00', isha: '20:30' };
    const prayers = { fajr: true, dhuhr: false, asr: true, maghrib: true, isha: true };
    const matches = findMatchingPrayers(times, 13 * 60 + 5, prayers, 0);
    expect(matches).toHaveLength(0);
  });

  it('fires advance notification at correct offset', () => {
    const times = { fajr: '06:00', dhuhr: '13:05', asr: '16:30', maghrib: '19:00', isha: '20:30' };
    const matches = findMatchingPrayers(times, 13 * 60 + 5 - 10, allPrayers, 10);
    const advMatch = matches.find(m => m.type === 'advance');
    expect(advMatch).toBeDefined();
    expect(advMatch.prayer).toBe('dhuhr');
  });

  it('ignores sunrise in prayer matching', () => {
    const times = { fajr: '06:00', sunrise: '07:30', dhuhr: '13:05', asr: '16:30', maghrib: '19:00', isha: '20:30' };
    const matches = findMatchingPrayers(times, 7 * 60 + 30, allPrayers, 0);
    expect(matches).toHaveLength(0);
  });

  it('prayer times from src/prayer.mjs produce valid HH:MM format', () => {
    const date = new Date(2025, 5, 15);
    const times = getPrayerTimesForDate(date, 34.0209, -6.8416);
    for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      expect(times[k]).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it('prayer time format is SW-compatible (HH:MM strings with valid ranges)', () => {
    const date = new Date(2025, 5, 15);
    const times = getPrayerTimesForDate(date, 34.0209, -6.8416);
    for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      expect(times[k]).toMatch(/^\d{2}:\d{2}$/);
      const [h, m] = times[k].split(':').map(Number);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(24);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThan(60);
    }
  });
});
