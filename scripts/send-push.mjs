#!/usr/bin/env node
import { getPrayerTimesForDate } from '../src/prayer.mjs';

// ── Environment variables (from GitHub Secrets) ───────────────
const {
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL,
  GIST_ID, GIST_TOKEN
} = process.env;

// ── Current Casablanca time in minutes since midnight ─────────
function nowCasablancaMinutes() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Casablanca', hour: 'numeric', minute: 'numeric', hour12: false
  }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour').value);
  const m = parseInt(parts.find(p => p.type === 'minute').value);
  return h * 60 + m;
}

// ── Find prayers matching current time ────────────────────────
const NAMES = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

export function findMatchingPrayers(prayerTimes, nowMinutes, prayers, advance) {
  const results = [];
  for (const [k, time] of Object.entries(prayerTimes)) {
    if (!prayers[k] || !time) continue;
    if (k === 'sunrise') continue; // sunrise is not a prayer notification
    const [ph, pm] = time.split(':').map(Number);
    const pMin = ph * 60 + pm;
    const isAtTime = Math.abs(pMin - nowMinutes) <= 2;
    const isAdvanceTime = advance > 0 && Math.abs((pMin - advance) - nowMinutes) <= 2;
    if (isAtTime) results.push({ prayer: k, type: 'at-time', name: NAMES[k], time });
    if (isAdvanceTime) results.push({ prayer: k, type: 'advance', name: NAMES[k], time });
  }
  return results;
}

// ── Main push notification sender ─────────────────────────────
async function main() {
  // Dynamic import for web-push (installed at runtime in CI)
  const webpush = (await import('web-push')).default;

  webpush.setVapidDetails(
    `mailto:${VAPID_EMAIL}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  // Read subscriptions from GitHub Gist
  const gistResp = await fetch(
    `https://api.github.com/gists/${GIST_ID}`,
    { headers: { 'Authorization': `token ${GIST_TOKEN}` } }
  );
  if (!gistResp.ok) { console.log('Gist fetch failed:', gistResp.status); return; }

  const gist = await gistResp.json();
  const content = gist.files?.['subscriptions.json']?.content;
  if (!content) { console.log('No subscriptions.'); return; }

  const subscriptions = JSON.parse(content);
  const entries = Object.entries(subscriptions);
  console.log(`Found ${entries.length} subscription(s)`);

  // Current Casablanca time
  const now = new Date();
  const nowMin = nowCasablancaMinutes();
  const casaH = Math.floor(nowMin / 60);
  const casaM = nowMin % 60;
  console.log(`Casablanca: ${String(casaH).padStart(2, '0')}:${String(casaM).padStart(2, '0')}`);

  // Send push notifications
  let sent = 0;
  const expired = [];

  for (const [deviceKey, entry] of entries) {
    if (!entry.city || !entry.subscription?.endpoint) continue;
    const prayers = entry.prayers || { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
    const advance = entry.advance || 0;
    const times = getPrayerTimesForDate(now, entry.city.lat, entry.city.lng);

    const matches = findMatchingPrayers(times, nowMin, prayers, advance);

    for (const match of matches) {
      const title = match.type === 'advance'
        ? `${advance} min \u2192 ${match.name}`
        : `\uD83D\uDD4C ${match.name} \u2014 ${match.time}`;

      try {
        await webpush.sendNotification(
          entry.subscription,
          JSON.stringify({
            title,
            body: match.type === 'advance'
              ? `${match.name} dans ${advance} minutes`
              : "C'est l'heure de la priere",
            prayer: match.prayer,
            isAdvance: match.type === 'advance',
            sound: match.type === 'advance' ? (entry.soundPre || 'tone') : (entry.soundAt || 'adhan'),
            time: match.time
          }),
          { TTL: 300, urgency: 'high' }
        );
        console.log(`\u2713 ${match.prayer} push sent`);
        sent++;
      } catch (err) {
        if ([410, 404].includes(err.statusCode)) expired.push(deviceKey);
        else console.log(`  Error ${err.statusCode}: ${err.message}`);
      }
    }
  }

  // Clean up expired subscriptions
  if (expired.length > 0) {
    const headers = {
      'Authorization': `token ${GIST_TOKEN}`,
      'Content-Type': 'application/json'
    };
    const clean = { ...subscriptions };
    expired.forEach(k => delete clean[k]);
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        files: { 'subscriptions.json': { content: JSON.stringify(clean, null, 2) } }
      })
    });
    console.log(`Removed ${expired.length} expired subscription(s)`);
  }

  console.log(`Done: ${sent} push(es) sent`);
}

// Only run when executed directly (not when imported for testing)
import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Push notification error:', err);
    process.exit(1);
  });
}
