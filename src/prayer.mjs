/**
 * Prayer times calculation engine — Méthode Habous (Maroc)
 * Based on Jean Meeus "Astronomical Algorithms" (US Naval Observatory reference)
 *
 * Fajr: 19°, Isha: 17°, Asr: standard (shadow = 1x object length + noon shadow)
 * Timezone: Africa/Casablanca exclusively
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// Habous method angles (non-configurable)
const FAJR_ANGLE = 19;
const ISHA_ANGLE = 17;

// ─── Julian Date ───────────────────────────────────────────────

export function toJulianDate(year, month, day) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

// ─── Solar Coordinates (Meeus Ch.25) ───────────────────────────

export function solarPosition(jd) {
  const T = (jd - 2451545.0) / 36525.0; // Julian centuries from J2000.0

  // Geometric mean longitude (deg)
  const L0 = mod360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);

  // Mean anomaly (deg)
  const M = mod360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mrad = M * DEG;

  // Equation of center (deg)
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
    + 0.000289 * Math.sin(3 * Mrad);

  // Sun's true longitude
  const sunLon = L0 + C;

  // Apparent longitude (nutation + aberration)
  const omega = 125.04 - 1934.136 * T;
  const lambda = sunLon - 0.00569 - 0.00478 * Math.sin(omega * DEG);

  // Obliquity of ecliptic (deg)
  const epsilon0 = 23.0 + (26.0 + (21.448 - 46.815 * T - 0.00059 * T * T + 0.001813 * T * T * T) / 60.0) / 60.0;
  const epsilon = epsilon0 + 0.00256 * Math.cos(omega * DEG);

  // Declination
  const declination = Math.asin(Math.sin(epsilon * DEG) * Math.sin(lambda * DEG)) * RAD;

  // Right ascension
  const ra = Math.atan2(
    Math.cos(epsilon * DEG) * Math.sin(lambda * DEG),
    Math.cos(lambda * DEG)
  ) * RAD;

  // Equation of time (minutes)
  const y = Math.tan(epsilon * DEG / 2) ** 2;
  const L0rad = L0 * DEG;
  const ecc = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const EqT = 4 * RAD * (
    y * Math.sin(2 * L0rad)
    - 2 * ecc * Math.sin(Mrad)
    + 4 * ecc * y * Math.sin(Mrad) * Math.cos(2 * L0rad)
    - 0.5 * y * y * Math.sin(4 * L0rad)
    - 1.25 * ecc * ecc * Math.sin(2 * Mrad)
  );

  return { declination, equationOfTime: EqT };
}

// ─── Prayer Time Calculations ──────────────────────────────────

/**
 * Calculate all 6 prayer times for a given date and location.
 * @param {Date} date - The date (in local time, only year/month/day used)
 * @param {number} lat - Latitude in degrees
 * @param {number} lng - Longitude in degrees
 * @returns {Object} Prayer times as {fajr, sunrise, dhuhr, asr, maghrib, isha}
 *          each as {hours, minutes} in UTC
 */
export function calculatePrayerTimes(date, lat, lng) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const jd = toJulianDate(year, month, day);
  const { declination: dec, equationOfTime: eqt } = solarPosition(jd + 0.5);

  // Transit (Dhuhr) in UTC hours
  const transit = 12 + (-lng / 15) - (eqt / 60);

  // Hour angle for a given altitude angle
  const hourAngle = (angle) => {
    const cosH = (
      Math.sin(-angle * DEG) - Math.sin(lat * DEG) * Math.sin(dec * DEG)
    ) / (Math.cos(lat * DEG) * Math.cos(dec * DEG));

    if (cosH > 1) return null;  // never rises
    if (cosH < -1) return null; // never sets
    return Math.acos(cosH) * RAD / 15; // in hours
  };

  // Sunrise/Sunset: standard refraction + solar semi-diameter = 0.8333°
  const hSun = hourAngle(0.8333);

  // Fajr: 19° below horizon
  const hFajr = hourAngle(FAJR_ANGLE);

  // Isha: 17° below horizon
  const hIsha = hourAngle(ISHA_ANGLE);

  // Asr: shadow = object length + noon shadow (Malikite/Standard)
  const asrAngle = asrShadowAngle(dec, lat);
  const hAsr = hourAngle(-asrAngle); // negative because it's above horizon

  const dhuhr = transit;
  const sunrise = hSun !== null ? transit - hSun : null;
  const sunset = hSun !== null ? transit + hSun : null;
  const fajr = hFajr !== null ? transit - hFajr : null;
  const isha = hIsha !== null ? transit + hIsha : null;
  const asr = hAsr !== null ? transit + hAsr : null;

  return {
    fajr: toHM(fajr),
    sunrise: toHM(sunrise),
    dhuhr: toHM(dhuhr),
    asr: toHM(asr),
    maghrib: toHM(sunset),
    isha: toHM(isha),
  };
}

/**
 * Calculate the altitude angle for Asr (standard/Malikite).
 * tan(A) = 1 / (1 + tan(|lat - dec|))
 * Actually: cot(A) = 1 + cot(zenith_at_noon) = 1 + tan(|lat - dec|)
 * So A = atan(1 / (1 + tan(|lat - dec|)))
 */
function asrShadowAngle(dec, lat) {
  const diff = Math.abs(lat - dec);
  const shadowRatio = 1 + Math.tan(diff * DEG);
  return Math.atan(1 / shadowRatio) * RAD;
}

// ─── Format Prayer Times for Casablanca Timezone ───────────────

/**
 * Get prayer times formatted as HH:MM strings in Africa/Casablanca timezone.
 * @param {Date} date - The date
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} [adjustments] - Optional per-prayer minute adjustments
 * @returns {Object} Prayer times as HH:MM strings in local time
 */
export function getPrayerTimesForDate(date, lat, lng, adjustments = {}) {
  const utcTimes = calculatePrayerTimes(date, lat, lng);

  // Get UTC offset for Africa/Casablanca on this date
  const offsetMinutes = getCasablancaOffset(date);

  const result = {};
  for (const [prayer, hm] of Object.entries(utcTimes)) {
    if (!hm) {
      result[prayer] = null;
      continue;
    }
    let totalMinutes = hm.hours * 60 + hm.minutes + offsetMinutes;
    const adj = adjustments[prayer] || 0;
    totalMinutes += adj;

    // Normalize to 0-1440
    totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;

    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    result[prayer] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return result;
}

/**
 * Get UTC offset for Africa/Casablanca in minutes for a given date.
 * Uses Intl API to correctly handle Morocco's DST rules.
 */
export function getCasablancaOffset(date) {
  // Use Intl to get the actual offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Casablanca',
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(date);
  const tzPart = parts.find(p => p.type === 'timeZoneName');
  if (!tzPart) return 0;

  const str = tzPart.value; // e.g., "GMT+1" or "GMT"
  const match = str.match(/GMT([+-]?\d+)?(?::(\d+))?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const mins = parseInt(match[2] || '0', 10);
  return hours * 60 + (hours < 0 ? -mins : mins);
}

// ─── Qibla ─────────────────────────────────────────────────────

const KAABA_LAT = 21.4225;
const KAABA_LNG = 39.8262;

/**
 * Calculate Qibla direction from a given location.
 * @returns {number} Bearing in degrees from North (clockwise)
 */
export function calculateQibla(lat, lng) {
  const phi1 = lat * DEG;
  const phi2 = KAABA_LAT * DEG;
  const dLambda = (KAABA_LNG - lng) * DEG;

  const x = Math.sin(dLambda);
  const y = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(dLambda);

  let qibla = Math.atan2(x, y) * RAD;
  return (qibla + 360) % 360;
}

/**
 * Calculate distance to Kaaba in km (haversine).
 */
export function distanceToKaaba(lat, lng) {
  const R = 6371;
  const dLat = (KAABA_LAT - lat) * DEG;
  const dLng = (KAABA_LNG - lng) * DEG;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat * DEG) * Math.cos(KAABA_LAT * DEG) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Helpers ───────────────────────────────────────────────────

function mod360(x) {
  return ((x % 360) + 360) % 360;
}

function toHM(hours) {
  if (hours === null || hours === undefined) return null;
  // Normalize to 0-24
  hours = ((hours % 24) + 24) % 24;
  const h = Math.floor(hours);
  const m = (hours - h) * 60;
  return { hours: h, minutes: m };
}
