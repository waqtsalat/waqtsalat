/**
 * Navigation and view switching.
 */

import { state } from '../state.mjs';
import { t } from '../i18n.mjs';
import { $ } from '../utils.mjs';

export function renderNav() {
  $('nav-prayers-text').textContent = t('prayerTimes', state.locale);
  $('nav-qibla-text').textContent = t('qibla', state.locale);
  $('nav-settings-text').textContent = t('settings', state.locale);
}

export function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-' + view).classList.add('active');
  document.querySelectorAll('nav.bottom-bar button').forEach(b => {
    b.classList.remove('active'); b.removeAttribute('aria-current');
  });
  const btn = $('nav-' + view);
  btn.classList.add('active'); btn.setAttribute('aria-current', 'page');
}
