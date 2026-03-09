/**
 * Qibla compass view rendering.
 */

import { state } from '../state.mjs';
import { t } from '../i18n.mjs';
import { $ } from '../utils.mjs';
import { calculateQibla, distanceToKaaba } from '../prayer.mjs';
import { addOrientationListener, extractHeading, processHeading, getHeadingVariance, getHeadingAccuracy } from '../compass.mjs';

const DEG = Math.PI / 180;

export function renderQibla() {
  if (!state.position) return;
  const { lat, lng } = state.position;
  const angle = calculateQibla(lat, lng);
  const dist = distanceToKaaba(lat, lng);

  $('qibla-needle').setAttribute('transform', `rotate(${angle},100,100)`);

  $('lbl-n').textContent = t('north', state.locale);
  $('lbl-s').textContent = t('south', state.locale);
  $('lbl-e').textContent = t('east', state.locale);
  $('lbl-w').textContent = t('west', state.locale);

  $('qibla-angle').textContent = t('qiblaAngle', state.locale) + ': ' + angle.toFixed(1) + t('degrees', state.locale);
  $('qibla-distance').textContent = t('qiblaDistance', state.locale) + ': ' + Math.round(dist) + ' ' + t('km', state.locale);
  $('btn-compass').textContent = t('enableCompass', state.locale);
  $('btn-ar').textContent = t('enableAR', state.locale);

  $('compass-svg').setAttribute('aria-label',
    t('qiblaDirection', state.locale) + ' ' + angle.toFixed(1) + t('degrees', state.locale));

  // Compass ticks
  const ticks = $('compass-ticks');
  ticks.innerHTML = '';
  for (let d = 0; d < 360; d += 15) {
    const a = (d - 90) * DEG;
    const r1 = d % 90 === 0 ? 82 : 86;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', 100 + Math.cos(a) * r1); line.setAttribute('y1', 100 + Math.sin(a) * r1);
    line.setAttribute('x2', 100 + Math.cos(a) * 90); line.setAttribute('y2', 100 + Math.sin(a) * 90);
    line.setAttribute('stroke', 'var(--muted)'); line.setAttribute('stroke-width', d % 90 === 0 ? '2' : '1');
    ticks.appendChild(line);
  }
}

export function updateAccuracyUI() {
  const el = $('compass-accuracy');
  const dot = $('accuracy-dot');
  const txt = $('accuracy-text');
  if (!el) return;

  const variance = getHeadingVariance();
  const headingAccuracy = getHeadingAccuracy();
  let level, label;

  if (headingAccuracy !== null) {
    if (headingAccuracy < 15) { level = 'high'; label = '\u00B1' + Math.round(headingAccuracy) + '\u00B0'; }
    else if (headingAccuracy < 30) { level = 'medium'; label = '\u00B1' + Math.round(headingAccuracy) + '\u00B0'; }
    else { level = 'low'; label = '\u00B1' + Math.round(headingAccuracy) + '\u00B0'; }
  } else {
    if (variance < 5) { level = 'high'; label = t('accuracyHigh', state.locale); }
    else if (variance < 20) { level = 'medium'; label = t('accuracyMedium', state.locale); }
    else { level = 'low'; label = t('accuracyLow', state.locale); }
  }

  el.style.display = 'flex';
  dot.className = 'accuracy-dot ' + level;
  txt.textContent = label;

  const banner = $('calibration-banner');
  if (level === 'low') {
    banner.textContent = t('calibrationNeeded', state.locale) + ' — ' + t('calibrationHint', state.locale);
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
  }
}

export function startCompass() {
  if (!window.DeviceOrientationEvent && !('AbsoluteOrientationSensor' in window)) return;
  const handler = e => {
    const heading = e._processedHeading !== undefined ? e._processedHeading : extractHeading(e);
    if (heading !== null) {
      const h = e._processedHeading !== undefined ? heading : processHeading(heading);
      $('compass-rotate').setAttribute('transform', `rotate(${-h},100,100)`);
      const qAngle = calculateQibla(state.position.lat, state.position.lng);
      $('qibla-needle').setAttribute('transform', `rotate(${qAngle - h},100,100)`);
      $('qibla-angle').textContent = t('qiblaAngle', state.locale) + ': ' + qAngle.toFixed(1) + t('degrees', state.locale) + ' (' + t('heading', state.locale) + ': ' + Math.round(h) + '\u00B0)';
    }
  };
  addOrientationListener(handler, updateAccuracyUI);
}
