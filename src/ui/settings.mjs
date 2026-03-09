/**
 * Settings view rendering.
 */

import { state, loadState, saveState } from '../state.mjs';
import { t } from '../i18n.mjs';
import { $ } from '../utils.mjs';
import { CITIES } from '../cities.mjs';
import { updateSoundStatus } from '../sounds.mjs';
import { getDndInstructions } from '../install.mjs';
import { renderCapabilities } from '../capabilities.mjs';
import { renderPrayers } from './prayers.mjs';

export function renderSettings() {
  // City
  $('s-city-title').textContent = t('city', state.locale);
  $('s-city-label').textContent = t('selectCity', state.locale);
  populateCitySelect($('s-city-select'));
  if (state.position) $('s-city-select').value = state.position.cityId || '';

  // Language
  $('s-lang-title').textContent = t('language', state.locale);
  $('s-lang-label').textContent = t('language', state.locale);
  $('s-lang-select').value = state.locale;

  // Notifications
  $('s-notif-title').textContent = t('notifications', state.locale);
  $('s-notif-exp-badge').textContent = t('experimental', state.locale);
  $('s-notif-label').textContent = t('enableNotifications', state.locale);
  $('s-notif-toggle').checked = state.notifications.enabled;

  const notifDetail = $('s-notif-detail');
  if (state.notifications.enabled) notifDetail.classList.add('show');
  else notifDetail.classList.remove('show');

  // Per-prayer toggle chips
  const prayerGrid = $('s-notif-prayers-grid');
  prayerGrid.innerHTML = '';
  const prayers = state.notifications.prayers || { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
  ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => {
    const chip = document.createElement('label');
    chip.className = 'notif-prayer-chip' + (prayers[k] ? ' active' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = prayers[k]; cb.dataset.prayer = k;
    const dot = document.createElement('span');
    dot.className = 'chip-dot';
    const name = document.createElement('span');
    name.textContent = t(k, state.locale);
    chip.appendChild(cb); chip.appendChild(dot); chip.appendChild(name);
    cb.addEventListener('change', () => {
      state.notifications.prayers[k] = cb.checked;
      chip.classList.toggle('active', cb.checked);
      saveState('waqt-notifications', state.notifications);
      // scheduleNotifications imported lazily to avoid circular deps
      import('../notifications.mjs').then(({ scheduleNotifications }) => {
        import('./prayers.mjs').then(({ getPrayerTimes }) => {
          scheduleNotifications(getPrayerTimes());
        });
      });
    });
    prayerGrid.appendChild(chip);
  });

  // Advance alert
  $('s-notif-advance-label').textContent = t('notifAdvance', state.locale);
  $('opt-adv-0').textContent = t('notifAdvance0', state.locale);
  $('opt-adv-5').textContent = t('notifAdvance5', state.locale);
  $('opt-adv-10').textContent = t('notifAdvance10', state.locale);
  $('opt-adv-15').textContent = t('notifAdvance15', state.locale);
  $('opt-adv-30').textContent = t('notifAdvance30', state.locale);
  $('s-notif-advance').value = state.notifications.advance || 0;

  // Sound — pre-notification
  $('s-notif-sound-pre-label').textContent = t('notifSoundPre', state.locale);
  $('opt-sndpre-silent').textContent = t('notifSoundSilent', state.locale);
  $('opt-sndpre-tone').textContent = t('notifSoundTone', state.locale);
  $('opt-sndpre-adhan').textContent = t('notifSoundAdhan', state.locale);
  $('s-notif-sound-pre').value = state.notifications.soundPre || 'tone';
  $('btn-test-sound-pre').textContent = t('notifSoundTest', state.locale);

  // Sound — at prayer time
  $('s-notif-sound-at-label').textContent = t('notifSoundAt', state.locale);
  $('opt-sndat-silent').textContent = t('notifSoundSilent', state.locale);
  $('opt-sndat-tone').textContent = t('notifSoundTone', state.locale);
  $('opt-sndat-adhan').textContent = t('notifSoundAdhan', state.locale);
  $('s-notif-sound-at').value = state.notifications.soundAt || 'adhan';
  $('btn-test-sound-at').textContent = t('notifSoundTest', state.locale);

  // Vibrate
  $('s-notif-vibrate-label').textContent = t('notifVibrate', state.locale);
  $('s-notif-vibrate').checked = state.notifications.vibrate !== false;

  // Badge
  $('s-notif-badge-label').textContent = t('notifBadge', state.locale);
  $('s-notif-badge').checked = state.notifications.badge !== false;

  // Permission badge
  const permBadge = $('s-notif-perm-badge');
  if ('Notification' in window) {
    const p = Notification.permission;
    permBadge.textContent = t(p === 'granted' ? 'notifPermGranted' : p === 'denied' ? 'notifPermDenied' : 'notifPermDefault', state.locale);
    permBadge.className = 'notif-perm-badge ' + p;
  } else {
    permBadge.style.display = 'none';
  }

  // Sound status
  updateSoundStatus();

  // Test button
  $('btn-test-notif-text').textContent = t('notifTestBtn', state.locale);

  // DND panel
  $('s-notif-dnd-title').textContent = t('notifDndTitle', state.locale);
  $('s-notif-dnd-text').textContent = getDndInstructions();

  // Sound credits
  $('s-notif-credits').innerHTML =
    '<strong>' + t('soundCredits', state.locale) + '</strong><br>' +
    t('soundCreditsAdhan', state.locale) + '<br>' +
    t('soundCreditsTone', state.locale) + '<br>' +
    '<a href="https://github.com/beentheretwice/open-sounds" target="_blank" rel="noopener">' + t('soundCreditsRepo', state.locale) + '</a>';

  // Device capabilities
  renderCapabilities();

  // Notification tester
  $('s-notif-test-label').textContent = t('notifTestLabel', state.locale);
  $('btn-test-notif').textContent = t('notifSoundTest', state.locale);
  $('notif-test-title').textContent = t('notifTestTitle', state.locale);
  $('notif-test-desc').textContent = t('notifTestDesc', state.locale);
  $('notif-test-now').textContent = t('notifTestNow', state.locale);
  $('notif-test-10s').textContent = t('notifTest10s', state.locale);
  $('notif-test-1m').textContent = t('notifTest1m', state.locale);
  $('notif-test-5m').textContent = t('notifTest5m', state.locale);
  $('notif-test-send').textContent = t('notifTestSend', state.locale);
  $('notif-test-cancel').textContent = t('notifTestCancel', state.locale);
  $('notif-test-status').textContent = '';

  // Adjustments
  $('s-adj-title').textContent = t('adjustments', state.locale);
  const adjRows = $('s-adj-rows');
  adjRows.innerHTML = '';
  ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => {
    const row = document.createElement('div');
    row.className = 'setting-row';
    const label = document.createElement('label');
    label.textContent = t(k, state.locale); label.setAttribute('for', 'adj-' + k);
    const val = document.createElement('span');
    val.className = 'adj-val'; val.id = 'adj-val-' + k;
    val.textContent = (state.adjustments[k] >= 0 ? '+' : '') + state.adjustments[k];
    const input = document.createElement('input');
    input.type = 'range'; input.id = 'adj-' + k; input.min = '-15'; input.max = '15'; input.step = '1';
    input.value = state.adjustments[k];
    input.setAttribute('aria-label', t(k, state.locale) + ' ' + t('adjustments', state.locale));
    input.addEventListener('input', () => {
      const v = parseInt(input.value, 10);
      state.adjustments[k] = v;
      val.textContent = (v >= 0 ? '+' : '') + v;
      saveState('waqt-adjustments', state.adjustments);
      renderPrayers();
    });
    row.appendChild(label); row.appendChild(val); row.appendChild(input);
    adjRows.appendChild(row);
  });

  // Buttons
  $('btn-export').textContent = t('exportConfig', state.locale);
  $('btn-import').textContent = t('importConfig', state.locale);
  $('btn-reset').textContent = t('resetConfig', state.locale);
  $('btn-hard-refresh').textContent = t('hardRefresh', state.locale);

  // Help popup i18n
  $('help-fab').setAttribute('aria-label', t('helpInfo', state.locale));
  $('reload-fab').setAttribute('aria-label', t('reloadAssets', state.locale));
  $('reload-fab').title = t('reloadAssets', state.locale);
  $('help-fab').title = t('helpInfo', state.locale);
  $('help-beta-text').textContent = t('betaWarning', state.locale);
  $('help-label-contribute').textContent = t('helpContribute', state.locale);
  $('help-desc-contribute').textContent = t('helpContributeDesc', state.locale);
  $('help-label-report').textContent = t('helpReport', state.locale);
  $('help-desc-report').textContent = t('helpReportDesc', state.locale);
  $('help-popup-close').textContent = t('helpClose', state.locale);
  $('help-popup-title').textContent = t('appName', state.locale);
  $('help-label-share').textContent = t('helpShare', state.locale);
  $('help-desc-share').textContent = t('helpShareDesc', state.locale);
  // Help feature badges
  $('help-feature-noads').querySelector('span').textContent = t('helpNoAds', state.locale);
  $('help-feature-noads').href = t('helpUrlAds', state.locale);
  $('help-feature-notracking').querySelector('span').textContent = t('helpNoTracking', state.locale);
  $('help-feature-notracking').href = t('helpUrlTracking', state.locale);
  $('help-feature-free').querySelector('span').textContent = t('helpFree', state.locale);
  $('help-feature-habous').querySelector('span').textContent = t('helpHabous', state.locale);
  $('help-feature-habous').href = t('helpUrlHabous', state.locale);
  $('help-feature-opensource').querySelector('span').textContent = t('helpOpenSource', state.locale);
  $('help-feature-opensource').href = t('helpUrlOpenSource', state.locale);
}

export function populateCitySelect(sel) {
  sel.innerHTML = '';
  CITIES.forEach(c => {
    const name = state.locale === 'ar' ? c.ar : c.fr;
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = name;
    sel.appendChild(opt);
  });
}
