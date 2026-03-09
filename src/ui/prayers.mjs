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

  const displayPrayers = PRAYER_KEYS;
  const mins = displayPrayers.map(k => {
    if (!prayerTimes[k]) return null;
    const [h, m] = prayerTimes[k].split(':').map(Number);
    return h * 60 + m;
  });

  for (let i = 0; i < mins.length; i++) {
    if (mins[i] !== null && mins[i] > nowMin) { nextIdx = i; break; }
  }

  const currentIdx = nextIdx > 0 ? nextIdx - 1 : (nextIdx === 0 ? -1 : displayPrayers.length - 1);

  displayPrayers.forEach((key, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'listitem');
    const passed = mins[i] !== null && mins[i] <= nowMin;

    if (i === currentIdx) {
      li.classList.add('current-prayer'); li.setAttribute('aria-current', 'true');
    } else if (i === nextIdx) {
      li.classList.add('next-prayer');
    } else if (passed) {
      li.classList.add('passed');
    } else if (nextIdx >= 0 && i > nextIdx) {
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
    if (nextIdx < 0) { li.classList.add('next-prayer'); }
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
  if (nextIdx >= 0) {
    updateCountdown(mins[nextIdx], nowCasa);
  } else {
    updateCountdown(mins[0] + 1440, nowCasa);
  }

  startCountdown(nextIdx >= 0 ? mins[nextIdx] : (mins[0] + 1440));
}

function updateCountdown(targetMin, now) {
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let diff = targetMin * 60 - nowSec;
  if (diff < 0) diff += 86400;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const txt = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  const el = $('inline-countdown');
  if (el) el.textContent = txt;
}

function startCountdown(targetMin) {
  if (countdownInterval) clearInterval(countdownInterval);
  let lastNowMin = -1;
  countdownInterval = setInterval(() => {
    const now = nowInCasa();
    updateCountdown(targetMin, now);
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
