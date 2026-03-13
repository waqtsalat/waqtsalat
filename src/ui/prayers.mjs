/**
 * Prayer list rendering, countdown, date formatting.
 */

import { state, saveState } from '../state.mjs';
import { t } from '../i18n.mjs';
import { $, nowInCasa } from '../utils.mjs';
import { PRAYER_KEYS, TZ } from '../constants.mjs';
import { getPrayerTimesForDate } from '../prayer.mjs';
import { CITIES } from '../cities.mjs';
import { scheduleNotifications } from '../notifications.mjs';

let prayerTimes = null;
let countdownInterval = null;
let lastRenderDate = null;

export function getPrayerTimes() { return prayerTimes; }

export function renderPrayers() {
  if (!state.position) return;
  const now = new Date();
  const { lat, lng } = state.position;
  const casaNow = nowInCasa();
  const todayStr = casaNow.getFullYear() + '-' + (casaNow.getMonth() + 1) + '-' + casaNow.getDate();
  const dayChanged = lastRenderDate !== null && lastRenderDate !== todayStr;
  lastRenderDate = todayStr;
  prayerTimes = getPrayerTimesForDate(now, lat, lng, state.adjustments);
  if (dayChanged) scheduleNotifications(prayerTimes);

  // City name
  const city = CITIES.find(c => c.id === state.position.cityId);
  const cityText = city ? (state.locale === 'ar' ? city.ar : city.fr) : (state.position.cityName || '');
  const cn = $('city-name');
  cn.innerHTML = '<svg class="flag-icon" viewBox="0 0 900 600" aria-hidden="true"><rect width="900" height="600" fill="#c1272d"/><path d="M450 175l-43.6 134.1H264.8l114.6 83.3-43.8 134.2L450 443.3l114.4 83.3-43.8-134.2 114.6-83.3H493.6z" fill="none" stroke="#006233" stroke-width="20"/></svg>' + cityText;

  // Prayer list
  const list = $('prayer-list');
  list.innerHTML = '';
  const nowCasa = nowInCasa();
  const nowMin = nowCasa.getHours() * 60 + nowCasa.getMinutes();
  let nextIdx = -1;
  let secondNextIdx = -1;

  const displayPrayers = PRAYER_KEYS;
  const mins = displayPrayers.map(k => {
    if (!prayerTimes[k]) return null;
    const [h, m] = prayerTimes[k].split(':').map(Number);
    return h * 60 + m;
  });

  // Find first and second upcoming prayers
  // A prayer is considered "passed" 30 mins after its time
  const PASS_BUFFER = 30;
  
  for (let i = 0; i < mins.length; i++) {
    const isPassed = mins[i] !== null && (mins[i] + PASS_BUFFER) <= nowMin;
    if (mins[i] !== null && !isPassed) {
      if (nextIdx === -1) {
        nextIdx = i;
      } else if (secondNextIdx === -1) {
        secondNextIdx = i;
        break;
      }
    }
  }

  displayPrayers.forEach((key, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'listitem');
    // A prayer is "passed" if 30+ mins have elapsed since its time
    const passed = mins[i] !== null && (mins[i] + PASS_BUFFER) <= nowMin;

    if (i === nextIdx) {
      // First upcoming prayer: Yellow highlight (current-prayer style)
      li.classList.add('current-prayer');
      li.setAttribute('aria-current', 'true');
    } else if (i === secondNextIdx) {
      // Second upcoming prayer: White highlight (next-prayer style)
      li.classList.add('next-prayer');
    } else if (passed) {
      li.classList.add('passed');
    } else if (nextIdx >= 0 && i > nextIdx && i !== secondNextIdx) {
      // Future prayers beyond the second one
      const stepsAfterNext = i - nextIdx;
      const opacity = Math.max(0.78, 0.85 - stepsAfterNext * 0.15);
      li.style.opacity = opacity;
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'prayer-name'; nameSpan.textContent = t(key, state.locale);
    const timeSpan = document.createElement('span');
    timeSpan.className = 'prayer-time'; timeSpan.textContent = prayerTimes[key] || '--:--';
    li.appendChild(nameSpan);
    if (i === nextIdx) {
      const cdSpan = document.createElement('span');
      cdSpan.className = 'prayer-countdown-inline';
      cdSpan.id = 'inline-countdown';
      li.appendChild(cdSpan);
    }
    li.appendChild(timeSpan);
    list.appendChild(li);
  });

  // Tomorrow's Fajr
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowTimes = getPrayerTimesForDate(tomorrow, lat, lng, state.adjustments);
  if (tomorrowTimes.fajr) {
    const li = document.createElement('li');
    li.setAttribute('role', 'listitem');
    const isMaghribOrLater = nextIdx >= 5 || nextIdx < 0;
    if (!isMaghribOrLater) li.classList.add('tomorrow-fajr');
    
    // Highlight tomorrow's Fajr if it's the first or second upcoming prayer
    if (nextIdx < 0) {
      // All today's prayers passed: tomorrow's Fajr is current-prayer (yellow)
      li.classList.add('current-prayer');
      li.setAttribute('aria-current', 'true');
    } else if (secondNextIdx < 0) {
      // Only one prayer left today: tomorrow's Fajr is next-prayer (white)
      li.classList.add('next-prayer');
    }
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'prayer-name'; nameSpan.textContent = t('tomorrowFajr', state.locale);
    const timeSpan = document.createElement('span');
    timeSpan.className = 'prayer-time'; timeSpan.textContent = tomorrowTimes.fajr;
    li.appendChild(nameSpan);
    if (nextIdx < 0) {
      const cdSpan = document.createElement('span');
      cdSpan.className = 'prayer-countdown-inline';
      cdSpan.id = 'inline-countdown';
      li.appendChild(cdSpan);
    }
    li.appendChild(timeSpan);
    list.appendChild(li);
  }

  // Inline countdown
  // Determine the target prayer index and day offset
  // The countdown should target the NEXT prayer that hasn't started yet,
  // not the current prayer that's in progress (within 30 min buffer)
  let targetIdx = nextIdx;
  let targetDayOffset = 0;

  // If the "next" prayer has already started (time is in the past),
  // target the second next prayer instead
  if (targetIdx >= 0 && mins[targetIdx] !== null && mins[targetIdx] <= nowMin) {
    targetIdx = secondNextIdx;
  }

  // Special case: If next prayer is Chourouk (sunrise), skip it and target Dhuhr
  // Chourouk is not a prayer with countdown, it's just a time marker
  if (targetIdx === 1) {
    targetIdx = 2; // Target Dhuhr instead
  }

  if (targetIdx < 0) {
    // All today's prayers passed: target is tomorrow's Fajr
    targetIdx = 0;
    targetDayOffset = 1;
  }

  const targetMin = mins[targetIdx];
  updateCountdown(targetMin, nowCasa, targetDayOffset);
  startCountdown(targetIdx, targetDayOffset);
}

function updateCountdown(targetMin, now, dayOffset = 0) {
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const targetSec = targetMin * 60 + dayOffset * 86400;
  let diff = targetSec - nowSec;

  // Safety: if diff is still negative (shouldn't happen with correct dayOffset),
  // add a day
  if (diff < 0) diff += 86400;

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const txt = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  const el = $('inline-countdown');
  if (el) el.textContent = txt;
}

function startCountdown(targetIdx, targetDayOffset) {
  if (countdownInterval) clearInterval(countdownInterval);
  let lastNowMin = -1;
  countdownInterval = setInterval(() => {
    const now = nowInCasa();
    // Re-calculate targetMin from current prayerTimes on each tick
    const pt = getPrayerTimes();
    const displayPrayers = PRAYER_KEYS;
    const mins = displayPrayers.map(k => {
      if (!pt || !pt[k]) return null;
      const [h, m] = pt[k].split(':').map(Number);
      return h * 60 + m;
    });

    const actualTargetMin = mins[targetIdx] ?? mins[0];
    updateCountdown(actualTargetMin, now, targetDayOffset);

    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin !== lastNowMin) {
      lastNowMin = nowMin;
      renderPrayers();
    }
  }, 1000);
}

export function formatGregorian(date, locale) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA' : locale, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: TZ
  }).format(date);
}

const HIJRI_MONTHS = {
  en: ['Muharram', 'Safar', 'Rabi\' al-Awwal', 'Rabi\' al-Thani', 'Jumada al-Ula', 'Jumada al-Thani', 'Rajab', 'Sha\'ban', 'Ramadan', 'Shawwal', 'Dhu al-Qi\'dah', 'Dhu al-Hijjah'],
  fr: ['Mouharram', 'Safar', 'Rabi\' al-Awal', 'Rabi\' al-Thani', 'Joumada al-Oula', 'Joumada al-Thania', 'Rajab', 'Chaabane', 'Ramadan', 'Chawwal', 'Dhou al-Qi\'da', 'Dhou al-Hijja']
};

export function formatHijri(date, locale) {
  try {
    if (locale === 'ar') {
      return new Intl.DateTimeFormat('ar-MA', {
        calendar: 'islamic-umalqura', day: 'numeric', month: 'long', year: 'numeric',
        timeZone: TZ
      }).format(date);
    }
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric', timeZone: TZ
    }).formatToParts(date);
    const d = parts.find(p => p.type === 'day')?.value;
    const m = parseInt(parts.find(p => p.type === 'month')?.value, 10);
    const y = parts.find(p => p.type === 'year')?.value?.replace(/\s*AH/, '');
    const months = HIJRI_MONTHS[locale] || HIJRI_MONTHS.en;
    if (d && m && y) return d + ' ' + months[m - 1] + ' ' + y;
    return '';
  } catch (e) { return ''; }
}
