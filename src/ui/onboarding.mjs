/**
 * Onboarding wizard.
 */

import { state, saveState } from '../state.mjs';
import { t } from '../i18n.mjs';
import { $ } from '../utils.mjs';
import { CITIES } from '../cities.mjs';
import { populateCitySelect } from './settings.mjs';

export function setupOnboarding(applyLocale, renderAll) {
  if (state.onboarded && state.position) {
    $('onboarding').classList.add('hidden');
    return;
  }

  const ob = $('onboarding');
  let step = 0;

  populateCitySelect($('ob-city-select'));

  ob.querySelectorAll('.lang-choices button').forEach(b => {
    b.classList.toggle('selected', b.dataset.lang === state.locale);
  });
  $('ob-lang-title').textContent = t('onboardingLang', state.locale);
  $('ob-lang-next').textContent = t('next', state.locale) + ' \u2192';
  $('ob-city-title').textContent = t('onboardingCity', state.locale);
  $('ob-gps-text').textContent = t('gpsLocate', state.locale);
  $('ob-city-next').textContent = t('next', state.locale) + ' \u2192';
  $('ob-done-title').textContent = t('onboardingDone', state.locale);
  $('ob-done-btn').textContent = t('done', state.locale) + ' \u2713';

  ob.querySelectorAll('.lang-choices button').forEach(btn => {
    btn.addEventListener('click', () => {
      ob.querySelectorAll('.lang-choices button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.locale = btn.dataset.lang;
      saveState('waqt-locale', state.locale);
      applyLocale();
      const prevCity = $('ob-city-select').value;
      populateCitySelect($('ob-city-select'));
      if (prevCity) $('ob-city-select').value = prevCity;
      $('ob-lang-title').textContent = t('onboardingLang', state.locale);
      $('ob-lang-next').textContent = t('next', state.locale) + ' \u2192';
      $('ob-city-title').textContent = t('onboardingCity', state.locale);
      $('ob-gps-text').textContent = t('gpsLocate', state.locale);
      $('ob-city-next').textContent = t('next', state.locale) + ' \u2192';
      $('ob-done-title').textContent = t('onboardingDone', state.locale);
      $('ob-done-btn').textContent = t('done', state.locale) + ' \u2713';
    });
  });

  function showStep(n) {
    ob.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    ob.querySelector(`[data-step="${n}"]`).classList.add('active');
  }

  $('ob-lang-next').addEventListener('click', () => { step = 1; showStep(1); });

  $('ob-gps-btn').addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      let nearest = CITIES[0], minDist = Infinity;
      CITIES.forEach(c => {
        const d = Math.hypot(c.lat - latitude, c.lng - longitude);
        if (d < minDist) { minDist = d; nearest = c; }
      });
      $('ob-city-select').value = nearest.id;
    }, () => { /* ignore */ }, { enableHighAccuracy: true, timeout: 10000 });
  });

  $('ob-city-next').addEventListener('click', () => {
    const cityId = $('ob-city-select').value;
    const city = CITIES.find(c => c.id === cityId);
    if (city) {
      state.position = { lat: city.lat, lng: city.lng, cityId: city.id, cityName: city.fr };
      saveState('waqt-position', state.position);
    }
    step = 2; showStep(2);
  });

  $('ob-done-btn').addEventListener('click', () => {
    state.onboarded = true;
    saveState('waqt-onboarded', 'true');
    ob.classList.add('hidden');
    renderAll();
  });
}
