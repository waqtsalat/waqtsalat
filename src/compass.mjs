/**
 * Compass heading engine (precision-optimized)
 * Low-pass filter with circular (angular) averaging to smooth heading jitter.
 * Pure functions exported; DOM wrappers stay in the main app code.
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// ─── Heading filter state ────────────────────────────────────
const HEADING_FILTER_ALPHA = 0.15; // Lower = smoother but slower response
let _filteredHeading = null;
let _lastHeadingTime = 0;
let _headingAccuracy = null; // degrees of accuracy (null=unknown)
let _compassSource = 'none'; // 'sensor-api','absolute','relative','webkit'
let _headingSamples = []; // for variance/stability detection
const MAX_HEADING_SAMPLES = 20;

export function smoothHeading(raw) {
  if (_filteredHeading === null) { _filteredHeading = raw; return raw; }
  // Circular interpolation: find shortest angular path
  let diff = raw - _filteredHeading;
  // Normalize to ±180
  diff = ((diff + 540) % 360) - 180;
  _filteredHeading = (_filteredHeading + HEADING_FILTER_ALPHA * diff + 360) % 360;
  return _filteredHeading;
}

export function updateHeadingStability(heading) {
  _headingSamples.push(heading);
  if (_headingSamples.length > MAX_HEADING_SAMPLES) _headingSamples.shift();
}

export function getHeadingVariance() {
  if (_headingSamples.length < 5) return 999;
  // Circular variance
  let sinSum = 0, cosSum = 0;
  for (const h of _headingSamples) {
    sinSum += Math.sin(h * DEG);
    cosSum += Math.cos(h * DEG);
  }
  const n = _headingSamples.length;
  const R = Math.sqrt((sinSum / n) ** 2 + (cosSum / n) ** 2);
  return (1 - R) * 360; // 0=perfectly stable, 360=random
}

// Tilt-compensated heading from raw alpha/beta/gamma
export function tiltCompensatedHeading(alpha, beta, gamma) {
  const a = alpha * DEG, b = beta * DEG, g = gamma * DEG;
  const sA = Math.sin(a), cA = Math.cos(a);
  const sB = Math.sin(b), cB = Math.cos(b);
  const sG = Math.sin(g), cG = Math.cos(g);

  if (cB * cB > 0.0625) {
    return (Math.atan2(-sA * cB, cA * cB) * RAD + 360) % 360;
  }
  const fE = -(cA * sG + sA * sB * cG);
  const fN = -(sA * sG - cA * sB * cG);
  if (fE * fE + fN * fN > 0.0625) {
    return (Math.atan2(fE, fN) * RAD + 360) % 360;
  }
  // Gimbal-lock fallback
  return (360 - alpha) % 360;
}

export function extractHeading(e) {
  // iOS: webkitCompassHeading is hardware-fused true compass heading (best source)
  if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
    _compassSource = 'webkit';
    if (e.webkitCompassAccuracy !== undefined) {
      _headingAccuracy = e.webkitCompassAccuracy;
    }
    return e.webkitCompassHeading;
  }
  // Android absolute orientation events
  if (e.absolute && e.alpha !== null) {
    _compassSource = 'absolute';
    if (e.beta !== null && e.gamma !== null) {
      return tiltCompensatedHeading(e.alpha, e.beta, e.gamma);
    }
    return (360 - e.alpha) % 360;
  }
  return null;
}

// Process raw heading: smooth + track stability
export function processHeading(raw) {
  const smoothed = smoothHeading(raw);
  updateHeadingStability(smoothed);
  _lastHeadingTime = Date.now();
  return smoothed;
}

export function getHeadingAccuracy() {
  return _headingAccuracy;
}

export function getCompassSource() {
  return _compassSource;
}

// Try to use AbsoluteOrientationSensor (Generic Sensor API) — best precision
export function tryAbsoluteOrientationSensor(callback) {
  if (!('AbsoluteOrientationSensor' in window)) return false;
  try {
    const sensor = new AbsoluteOrientationSensor({ frequency: 30, referenceFrame: 'device' });
    sensor.addEventListener('reading', () => {
      const [qx, qy, qz, qw] = sensor.quaternion;
      const east = 2 * (qx * qy - qw * qz);
      const north = 1 - 2 * (qx * qx + qz * qz);
      let heading = Math.atan2(east, north) * RAD;
      if (east * east + north * north < 0.0625) {
        const fE = -(2 * (qx * qz + qw * qy));
        const fN = -(2 * (qy * qz - qw * qx));
        if (fE * fE + fN * fN > 0.01) heading = Math.atan2(fE, fN) * RAD;
      }
      const compassHeading = (heading + 360) % 360;
      _compassSource = 'sensor-api';
      callback(processHeading(compassHeading));
    });
    sensor.addEventListener('error', () => { /* fall through to other methods */ });
    sensor.start();
    return true;
  } catch (e) { return false; }
}

export function addOrientationListener(handler, updateAccuracyFn) {
  // 1. Try AbsoluteOrientationSensor first (most precise, hardware sensor fusion)
  const wrappedHandler = heading => {
    handler({ _processedHeading: heading });
    if (updateAccuracyFn) updateAccuracyFn();
  };
  if (tryAbsoluteOrientationSensor(wrappedHandler)) return;

  // Wrap handler to add smoothing + accuracy tracking
  const smoothedHandler = e => {
    const raw = extractHeading(e);
    if (raw !== null) {
      const smoothed = processHeading(raw);
      if (updateAccuracyFn) updateAccuracyFn();
      handler({ ...e, _processedHeading: smoothed });
    }
  };

  // 2. iOS: must request permission, uses deviceorientation + webkitCompassHeading
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(r => {
      if (r === 'granted') window.addEventListener('deviceorientation', smoothedHandler, true);
    });
    return;
  }
  // 3. Android: prefer deviceorientationabsolute for true compass heading
  let gotAbsolute = false;
  const absHandler = e => {
    gotAbsolute = true;
    smoothedHandler(e);
  };
  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', absHandler, true);
    setTimeout(() => {
      if (!gotAbsolute) {
        window.addEventListener('deviceorientation', smoothedHandler, true);
      }
    }, 1000);
  } else {
    window.addEventListener('deviceorientation', smoothedHandler, true);
  }
}
