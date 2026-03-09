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

// ── Safe gaps: time ranges when no push notifications are needed ─────────
// Based on Casablanca prayer times (full year min/max with 30min advance + 4min buffer)
// These are Casablanca local time, so DST is handled automatically
const SAFE_GAPS = [
  [22 * 60 + 30, 3 * 60 + 55],  // 22:30 - 03:55 (overnight, ~5h 25m)
  [7 * 60 + 15, 12 * 60],       // 07:15 - 12:00 (morning, ~4h 45m)
  [14 * 60, 15 * 60 + 20],      // 14:00 - 15:20 (midday, ~1h 20m)
];

function isInSafeGap(nowMinutes) {
  // Handle overnight gap that crosses midnight
  for (const [start, end] of SAFE_GAPS) {
    if (start > end) {
      // Gap crosses midnight (e.g., 22:30 - 03:55)
      if (nowMinutes >= start || nowMinutes < end) return true;
    } else {
      // Normal gap within same day
      if (nowMinutes >= start && nowMinutes < end) return true;
    }
  }
  return false;
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
    const isAtTime = Math.abs(pMin - nowMinutes) <= 4;
    const isAdvanceTime = advance > 0 && Math.abs((pMin - advance) - nowMinutes) <= 4;
    if (isAtTime) results.push({ prayer: k, type: 'at-time', name: NAMES[k], time });
    if (isAdvanceTime) results.push({ prayer: k, type: 'advance', name: NAMES[k], time });
  }
  return results;
}

// ── Main push notification sender ─────────────────────────────
async function main() {
  // Early exit if we're in a safe gap (no notifications needed)
  const nowMin = nowCasablancaMinutes();
  if (isInSafeGap(nowMin)) {
    console.log(`Safe gap (${Math.floor(nowMin/60)}:${String(nowMin%60).padStart(2,'0')} Casa), skipping push notifications`);
    return;
  }

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

  // Load server-side dedup state from Gist
  let dedup = {};
  const dedupContent = gist.files?.['push-dedup.json']?.content;
  if (dedupContent) {
    try { dedup = JSON.parse(dedupContent); } catch (e) { /* ignore */ }
  }

  // Current Casablanca date string for dedup key
  const now = new Date();
  const nowMin = nowCasablancaMinutes();
  const casaH = Math.floor(nowMin / 60);
  const casaM = nowMin % 60;
  const casaParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const casaDate = ['year', 'month', 'day'].map(t => casaParts.find(p => p.type === t).value).join('-');
  console.log(`Casablanca: ${String(casaH).padStart(2, '0')}:${String(casaM).padStart(2, '0')} (${casaDate})`);

  // Purge old dedup entries (keep only today)
  for (const key of Object.keys(dedup)) {
    if (!key.endsWith(casaDate)) delete dedup[key];
  }

  // Send push notifications
  let sent = 0;
  let skipped = 0;
  const expired = [];
  let dedupChanged = false;

  for (const [deviceKey, entry] of entries) {
    if (!entry.city || !entry.subscription?.endpoint) continue;
    const prayers = entry.prayers || { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
    const advance = entry.advance || 0;
    const times = getPrayerTimesForDate(now, entry.city.lat, entry.city.lng);

    // Debug: log city and computed prayer times
    const cityId = entry.city.id || `${entry.city.lat.toFixed(2)},${entry.city.lng.toFixed(2)}`;
    const timeStr = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
      .filter(k => times[k]).map(k => `${k}=${times[k]}`).join(' ');
    console.log(`  ${cityId}: ${timeStr}`);

    const matches = findMatchingPrayers(times, nowMin, prayers, advance);

    for (const match of matches) {
      // Server-side dedup: skip if already pushed for this device+prayer+type+date
      const dedupKey = `${deviceKey}-${match.prayer}-${match.type}-${casaDate}`;
      if (dedup[dedupKey]) {
        console.log(`  ⊘ ${match.prayer} (${match.type}) already sent, skipping`);
        skipped++;
        continue;
      }

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
        console.log(`  \u2713 ${match.prayer} (${match.type}) push sent`);
        dedup[dedupKey] = Date.now();
        dedupChanged = true;
        sent++;
      } catch (err) {
        if ([410, 404].includes(err.statusCode)) expired.push(deviceKey);
        else console.log(`  Error ${err.statusCode}: ${err.message}`);
      }
    }
  }

  // Persist dedup state + clean expired subscriptions in a single Gist PATCH
  const gistFiles = {};
  if (dedupChanged) {
    gistFiles['push-dedup.json'] = { content: JSON.stringify(dedup, null, 2) };
  }
  if (expired.length > 0) {
    const clean = { ...subscriptions };
    expired.forEach(k => delete clean[k]);
    gistFiles['subscriptions.json'] = { content: JSON.stringify(clean, null, 2) };
    console.log(`Removed ${expired.length} expired subscription(s)`);
  }
  if (Object.keys(gistFiles).length > 0) {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GIST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files: gistFiles })
    });
  }

  console.log(`Done: ${sent} push(es) sent${skipped ? `, ${skipped} dedup skipped` : ''}`);
}

// Only run when executed directly (not when imported for testing)
import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Push notification error:', err);
    process.exit(1);
  });
}
