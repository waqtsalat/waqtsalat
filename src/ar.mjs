/**
 * AR Camera Mode (Three.js Qibla Finder)
 * Dynamically loaded module — only imported when AR button is clicked.
 */

import { calculateQibla, distanceToKaaba } from './prayer.mjs';
import { addOrientationListener, processHeading, extractHeading, getHeadingVariance } from './compass.mjs';
import { $ } from './utils.mjs';
import { t } from './i18n.mjs';
import { state } from './state.mjs';

const DEG = Math.PI / 180;

// ─── AR state ────────────────────────────────────────────────
let arStream = null;
let arAnimFrame = null;
let arHeading = null;
let arPitch = 0;
let arTargetHeading = null;
let arTargetPitch = 0;
let arRenderer = null;
let arScene = null;
let arCamera = null;
let arQiblaGroup = null;
let arPitchListener = null;

// ─── Lazy-load Three.js on demand ────────────────────────────
let _threeLoaded = false;
let _threeLoading = false;
function loadThreeJS() {
  return new Promise((resolve, reject) => {
    if (_threeLoaded) { resolve(); return; }
    if (_threeLoading) {
      const check = setInterval(() => {
        if (_threeLoaded) { clearInterval(check); resolve(); }
      }, 50);
      return;
    }
    _threeLoading = true;
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = () => { _threeLoaded = true; _threeLoading = false; resolve(); };
    s.onerror = () => { _threeLoading = false; reject(new Error('Failed to load Three.js')); };
    document.head.appendChild(s);
  });
}

// Request geolocation lazily
function ensureGeolocation() {
  return new Promise((resolve, reject) => {
    if (state.position) { resolve(state.position); return; }
    if (!navigator.geolocation) { reject(new Error('No geolocation')); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      import('./cities.mjs').then(({ CITIES }) => {
        let nearest = CITIES[0], minDist = Infinity;
        CITIES.forEach(c => {
          const d = Math.hypot(c.lat - latitude, c.lng - longitude);
          if (d < minDist) { minDist = d; nearest = c; }
        });
        state.position = { lat: nearest.lat, lng: nearest.lng, cityId: nearest.id, cityName: nearest.fr };
        import('./state.mjs').then(({ saveState }) => {
          saveState('waqt-position', state.position);
        });
        resolve(state.position);
      });
    }, err => reject(err), { enableHighAccuracy: true, timeout: 10000 });
  });
}

export function startAR() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert(t('arNotSupported', state.locale)); return;
  }

  const overlay = $('ar-overlay');
  const video = $('ar-video');

  overlay.classList.remove('hidden');
  const cal = $('ar-calibration');
  cal.style.display = 'block';
  cal.textContent = 'Loading AR...';

  Promise.all([
    loadThreeJS(),
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    }),
    ensureGeolocation()
  ]).then(([_, stream]) => {
    arStream = stream;
    video.srcObject = stream;
    cal.style.display = 'none';

    initARScene();

    addOrientationListener(e => {
      if (e._processedHeading !== undefined) {
        arTargetHeading = e._processedHeading;
      } else {
        const raw = extractHeading(e);
        if (raw !== null) arTargetHeading = processHeading(raw);
      }
    });

    arPitchListener = e => {
      if (e.beta !== null && e.beta !== undefined) {
        arTargetPitch = Math.max(-85, Math.min(85, 90 - e.beta));
      }
    };
    window.addEventListener('deviceorientation', arPitchListener, true);

    updateARHUD();
    arRenderLoop();
  }).catch(err => {
    overlay.classList.add('hidden');
    alert(t('arNotSupported', state.locale));
  });
}

function initARScene() {
  const container = $('ar-3d-container');

  arScene = new THREE.Scene();

  arCamera = new THREE.PerspectiveCamera(
    60, container.clientWidth / container.clientHeight, 0.1, 500
  );
  arCamera.position.set(0, 1.6, 0);
  arCamera.rotation.order = 'YXZ';

  arRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  arRenderer.setSize(container.clientWidth, container.clientHeight);
  arRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  arRenderer.setClearColor(0x000000, 0);
  container.appendChild(arRenderer.domElement);

  createQiblaObjects();
  window.addEventListener('resize', onARResize);
}

function createQiblaObjects() {
  if (!state.position) return;
  const qAngle = calculateQibla(state.position.lat, state.position.lng);
  const qRad = qAngle * DEG;

  arQiblaGroup = new THREE.Group();
  const dist = 80;

  // Blue beam (core + glow)
  const beamGeom = new THREE.CylinderGeometry(0.06, 0.06, dist, 8);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x2979FF, transparent: true, opacity: 0.7 });
  const beam = new THREE.Mesh(beamGeom, beamMat);
  beam.rotation.x = Math.PI / 2;
  beam.position.set(0, 0.05, -dist / 2);
  arQiblaGroup.add(beam);

  const glowGeom = new THREE.CylinderGeometry(0.18, 0.18, dist, 8);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x2979FF, transparent: true, opacity: 0.18 });
  const glow = new THREE.Mesh(glowGeom, glowMat);
  glow.rotation.x = Math.PI / 2;
  glow.position.set(0, 0.05, -dist / 2);
  arQiblaGroup.add(glow);

  const stripGeom = new THREE.PlaneGeometry(1.2, dist);
  const stripMat = new THREE.MeshBasicMaterial({
    color: 0x2979FF, transparent: true, opacity: 0.08, side: THREE.DoubleSide
  });
  const strip = new THREE.Mesh(stripGeom, stripMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, -0.48, -dist / 2);
  arQiblaGroup.add(strip);

  // 3D Kaaba
  const kaabaGrp = new THREE.Group();
  kaabaGrp.position.set(0, 2, -dist);
  kaabaGrp.userData.isKaaba = true;

  const bodyGeom = new THREE.BoxGeometry(9, 10.5, 9);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  kaabaGrp.add(new THREE.Mesh(bodyGeom, bodyMat));

  const bandGeom = new THREE.BoxGeometry(9.18, 0.66, 9.18);
  const bandMat = new THREE.MeshBasicMaterial({ color: 0xc9a84c });
  const band1 = new THREE.Mesh(bandGeom, bandMat);
  band1.position.y = 1.5;
  kaabaGrp.add(band1);
  const band2 = new THREE.Mesh(bandGeom.clone(), bandMat.clone());
  band2.position.y = -0.45;
  kaabaGrp.add(band2);
  const topTrim = new THREE.Mesh(
    new THREE.BoxGeometry(9.18, 0.36, 9.18),
    new THREE.MeshBasicMaterial({ color: 0xc9a84c })
  );
  topTrim.position.y = 5.25;
  kaabaGrp.add(topTrim);

  kaabaGrp.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(bodyGeom),
    new THREE.LineBasicMaterial({ color: 0xc9a84c })
  ));

  arQiblaGroup.add(kaabaGrp);

  // Ground dots
  for (let i = 5; i < dist; i += 5) {
    const dotGeom = new THREE.CircleGeometry(0.12, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x2979FF, transparent: true,
      opacity: Math.max(0.06, 0.35 - i / dist * 0.3), side: THREE.DoubleSide
    });
    const dot = new THREE.Mesh(dotGeom, dotMat);
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(0, -0.49, -i);
    arQiblaGroup.add(dot);
  }

  // Concentric ground rings at Kaaba
  [2, 4, 6].forEach(r => {
    const ringGeom = new THREE.RingGeometry(r - 0.04, r + 0.04, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xc9a84c, transparent: true, opacity: 0.15, side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, -0.48, -dist);
    arQiblaGroup.add(ring);
  });

  arQiblaGroup.rotation.y = -qRad;
  arScene.add(arQiblaGroup);
}

function onARResize() {
  if (!arRenderer || !arCamera) return;
  const c = $('ar-3d-container');
  arCamera.aspect = c.clientWidth / c.clientHeight;
  arCamera.updateProjectionMatrix();
  arRenderer.setSize(c.clientWidth, c.clientHeight);
}

function arRenderLoop() {
  if (!arRenderer) return;

  if (arTargetHeading !== null) {
    if (arHeading === null) { arHeading = arTargetHeading; }
    else {
      let d = arTargetHeading - arHeading;
      d = ((d + 540) % 360) - 180;
      arHeading = (arHeading + d * 0.12 + 360) % 360;
    }
    arCamera.rotation.y = -arHeading * DEG;
  }

  arPitch += (arTargetPitch - arPitch) * 0.1;
  arCamera.rotation.x = arPitch * DEG;

  if (arQiblaGroup) {
    arQiblaGroup.traverse(obj => {
      if (obj.userData.isKaaba) {
        obj.position.y = 2 + Math.sin(Date.now() * 0.0015) * 0.35;
        obj.rotation.y += 0.003;
      }
    });

    arQiblaGroup.children.forEach(c => {
      if (c.isMesh && c.material && c.material.opacity > 0.1 && c.material.opacity < 0.75
          && c.geometry.type === 'CylinderGeometry') {
        const base = c.material.userData?.baseOpacity;
        if (!base) { c.material.userData = { baseOpacity: c.material.opacity }; }
        const b = c.material.userData.baseOpacity;
        c.material.opacity = b + Math.sin(Date.now() * 0.003) * 0.1;
      }
    });
  }

  updateDirectionHint();
  updateARCalibration();

  arRenderer.render(arScene, arCamera);
  arAnimFrame = requestAnimationFrame(arRenderLoop);
}

function updateDirectionHint() {
  if (!state.position || arHeading === null) return;
  const hint = $('ar-direction-hint');
  const qAngle = calculateQibla(state.position.lat, state.position.lng);
  let diff = qAngle - arHeading;
  diff = ((diff + 180) % 360 + 360) % 360 - 180;

  if (Math.abs(diff) > 30) {
    hint.style.display = 'flex';
    hint.textContent = (diff > 0 ? '\u2192 ' : '\u2190 ') + t('qiblaDirection', state.locale);
    hint.style.background = diff > 0
      ? 'linear-gradient(90deg,transparent,rgba(41,121,255,0.35))'
      : 'linear-gradient(270deg,transparent,rgba(41,121,255,0.35))';
  } else if (Math.abs(diff) < 5) {
    hint.style.display = 'flex';
    hint.textContent = '\u2713 ' + t('qiblaDirection', state.locale);
    hint.style.background = 'rgba(46,204,113,0.35)';
  } else {
    hint.style.display = 'none';
  }
}

function updateARCalibration() {
  const cal = $('ar-calibration');
  const variance = getHeadingVariance();
  if (variance > 20) {
    cal.style.display = 'block';
    cal.textContent = t('calibrationHint', state.locale);
  } else {
    cal.style.display = 'none';
  }
}

function updateARHUD() {
  if (!state.position) return;
  const qAngle = calculateQibla(state.position.lat, state.position.lng);
  const dist = distanceToKaaba(state.position.lat, state.position.lng);
  $('ar-bearing').textContent = qAngle.toFixed(1) + '\u00B0';
  $('ar-bearing-label').textContent = t('qiblaAngle', state.locale);
  $('ar-distance').textContent = Math.round(dist) + ' ' + t('km', state.locale);
  $('ar-distance-label').textContent = t('qiblaDistance', state.locale);
}

export function stopAR() {
  $('ar-overlay').classList.add('hidden');
  if (arStream) { arStream.getTracks().forEach(t => t.stop()); arStream = null; }
  if (arAnimFrame) { cancelAnimationFrame(arAnimFrame); arAnimFrame = null; }
  if (arPitchListener) {
    window.removeEventListener('deviceorientation', arPitchListener, true);
    arPitchListener = null;
  }
  if (arRenderer) {
    arRenderer.dispose();
    const c = $('ar-3d-container');
    if (c) c.innerHTML = '';
    arRenderer = null;
  }
  if (arScene) {
    arScene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
    arScene = null;
  }
  arCamera = null; arQiblaGroup = null;
  arHeading = null; arPitch = 0;
  arTargetHeading = null; arTargetPitch = 0;
  window.removeEventListener('resize', onARResize);
}
