# CR-003: Phase 3 — JavaScript Modularization

**Project:** WaqtSalat Modularization  
**Phase:** 3 of 4  
**Risk Level:** Medium  
**Prerequisite:** CR-002 (Phase 2) merged and verified  
**Estimated Effort:** 3–5 days (incremental sub-PRs recommended)  

---

## Objective

Extract the ~1,200 remaining lines of inline JavaScript from `index.html` into properly structured ES modules under `src/`. Eliminate duplicate code between the inline script and the existing `src/*.mjs` files. Vite (from Phase 2) bundles everything back into a single file for production.

---

## Motivation

After Phases 1 and 2, `index.html` still contains ~1,200 lines of inline JS covering state management, UI rendering, compass heading, AR mode, notifications, push subscriptions, PWA install, audio playback, and boot logic. This is the primary source of context-window overflow for Claude Code and the main barrier to targeted, safe edits.

---

## Guiding Principles

1. **One module extraction per sub-PR.** Each extraction is independently testable and revertable.
2. **No logic changes.** Code is moved, not refactored. Function signatures and behavior remain identical.
3. **Canonical source wins.** Where `src/prayer.mjs` (tested, documented) and the inline copy diverge, the `src/` version is canonical. The inline copy is deleted.
4. **`sw.js` is NOT modularized.** It stays as a standalone file for browser compatibility. Accept the small amount of duplication.
5. **Each sub-PR must pass all tests** (unit, lint, e2e) before merging.

---

## Extraction Order and Rationale

The order proceeds from zero-DOM-dependency pure functions to heavily DOM-coupled UI code. Each step builds on the previous.

---

### Sub-PR 3.1: Reconcile `src/prayer.mjs` (Canonical Prayer Engine)

**What:** Remove the inline prayer calculation functions from `index.html` and import from `src/prayer.mjs` instead.

**Inline functions to remove:**
- `mod360()`
- `toJD()`
- `solarPos()` (inline version — less accurate than `src/prayer.mjs`'s `solarPosition()`)
- `calcPrayerTimes()`
- `getCasaOffset()` → use `getCasablancaOffset()` from `src/prayer.mjs`
- `getPrayerTimesLocal()` → use `getPrayerTimesForDate()` from `src/prayer.mjs`
- `calcQibla()` → use `calculateQibla()` from `src/prayer.mjs`
- `distKaaba()` → use `distanceToKaaba()` from `src/prayer.mjs`

**In `index.html`:** Replace the inline `<script>` IIFE opening with:
```html
<script type="module">
import {
  getPrayerTimesForDate,
  getCasablancaOffset,
  calculateQibla,
  distanceToKaaba,
} from './src/prayer.mjs';
```

**Adaptation needed:** The inline code uses slightly different function names and signatures. Callers in `index.html` must be updated:
- `getPrayerTimesLocal(date, lat, lng, adj)` → `getPrayerTimesForDate(date, lat, lng, adj)` (same signature)
- `calcQibla(lat, lng)` → `calculateQibla(lat, lng)` (same signature)
- `distKaaba(lat, lng)` → `distanceToKaaba(lat, lng)` (same signature)
- `getCasaOffset(date)` → `getCasablancaOffset(date)` (same signature)

**Also needed:** The inline code uses constants `PRAYER_KEYS`, `KAABA_LAT`, `KAABA_LNG`, `TZ`, `DEG`, `RAD` which are not all exported from `src/prayer.mjs`. Either export them or define them locally where needed. `PRAYER_KEYS` and `TZ` are UI-level constants and should stay in the main app code or a new `src/constants.mjs`.

**New file:** `src/constants.mjs`
```javascript
export const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const TZ = 'Africa/Casablanca';
export const KAABA_LAT = 21.4225;
export const KAABA_LNG = 39.8262;
```

**Test impact:** Unit tests already import from `src/prayer.mjs`. No changes needed. The e2e tests validate the rendered output, which should be identical since the canonical `src/prayer.mjs` produces results within ±1 minute of the inline version (already validated by `tests/prayer.test.mjs`).

**Risk:** If the inline version had compensating bugs (e.g., an error that was offset by another error), switching to `src/prayer.mjs` could shift prayer times by 1 minute for some edge cases. The reference dataset tests catch this.

**Files changed:** `index.html`, `src/constants.mjs` (new)  
**Lines removed from index.html:** ~120

---

### Sub-PR 3.2: Reconcile `src/cities.mjs` and `src/i18n.mjs`

**What:** The Phase 1 extraction created `src/cities-data.js` and `src/locales/*.js` using global variable patterns. Now convert them to proper ES module imports.

**Changes:**
- Delete `src/cities-data.js` (global pattern).
- Delete `src/locales/ar.js`, `src/locales/fr.js`, `src/locales/en.js` (global pattern).
- In `index.html`, import from the existing canonical modules:
  ```javascript
  import { CITIES } from './src/cities.mjs';
  import { TRANSLATIONS } from './src/i18n.mjs';
  ```
- Remove `window.__WAQT_CITIES` and `window.__WAQT_LOCALES` references.
- Remove the `<script>` tags that loaded the global-pattern files.
- Update the `t()` function to use `TRANSLATIONS` instead of `TR`.

**Also reconcile:** The `src/i18n.mjs` `TRANSLATIONS` object may have slightly different keys than the inline `TR` object (the inline version has keys like `notifTestTitle` that `src/i18n.mjs` may lack). Merge any missing keys into `src/i18n.mjs` before switching.

**SW asset list:** Remove the global-pattern files from the `ASSETS` array in `public/sw.js`. Vite now bundles these modules into the HTML.

**Files changed:** `index.html`, `src/i18n.mjs` (merge missing keys), `public/sw.js`  
**Files deleted:** `src/cities-data.js`, `src/locales/ar.js`, `src/locales/fr.js`, `src/locales/en.js`  
**Lines removed from index.html:** ~20 (global refs + script tags)

---

### Sub-PR 3.3: Extract Compass/Heading Engine → `src/compass.mjs`

**What:** Move all compass-related code into a self-contained module.

**Functions to extract:**
- `smoothHeading()` and all heading filter state (`_filteredHeading`, `_lastHeadingTime`, `_headingAccuracy`, `_compassSource`, `_headingSamples`, etc.)
- `updateHeadingStability()`
- `getHeadingVariance()`
- `tiltCompensatedHeading()`
- `extractHeading()`
- `processHeading()`
- `updateAccuracyUI()` — this touches the DOM (`$('compass-accuracy')`, etc.). Either pass DOM references as parameters, or split into a pure processing function and a UI update function.
- `tryAbsoluteOrientationSensor()`
- `addOrientationListener()`
- `startCompass()`

**Module exports:**
```javascript
export { addOrientationListener, startCompass, processHeading, extractHeading, getHeadingVariance };
```

**DOM coupling decision:** `updateAccuracyUI()` and `startCompass()` directly access DOM elements by ID. Two approaches:
- **Option A:** Pass a DOM accessor function (`$` or `document.getElementById`) as a parameter.
- **Option B:** Keep thin DOM-touching wrappers in the main app code; extract only the pure compass math.

**Recommended:** Option B. Export pure functions (`smoothHeading`, `tiltCompensatedHeading`, `processHeading`, `getHeadingVariance`, `extractHeading`). Keep `startCompass()` and `updateAccuracyUI()` in the main code as thin wrappers that call the pure functions and update DOM.

**Files created:** `src/compass.mjs`  
**Lines removed from index.html:** ~120

---

### Sub-PR 3.4: Extract AR Mode → `src/ar.mjs`

**What:** Move all Three.js AR code into a dynamically imported module.

**Functions to extract:**
- `loadThreeJS()` (lazy Three.js loader)
- `ensureGeolocation()`
- `startAR()`
- `initARScene()`
- `createQiblaObjects()`
- `onARResize()`
- `arRenderLoop()`
- `updateDirectionHint()`
- `updateARCalibration()`
- `updateARHUD()`
- `stopAR()`
- All AR-specific state: `arStream`, `arAnimFrame`, `arHeading`, `arPitch`, `arTargetHeading`, `arTargetPitch`, `arRenderer`, `arScene`, `arCamera`, `arQiblaGroup`, `arPitchListener`

**Import pattern:** The AR button handler in the main code uses dynamic import:
```javascript
$('btn-ar').addEventListener('click', async () => {
  const { startAR } = await import('./src/ar.mjs');
  startAR(state, $);
});
```

**Dependencies the AR module needs:**
- `state.position` (lat/lng) — pass as parameter
- `calculateQibla`, `distanceToKaaba` — import from `src/prayer.mjs`
- `addOrientationListener`, `processHeading`, `extractHeading`, `getHeadingVariance` — import from `src/compass.mjs`
- `t()` function — import from `src/i18n.mjs` or pass as parameter
- DOM element accessor `$()` — pass as parameter

**Files created:** `src/ar.mjs`  
**Lines removed from index.html:** ~250

---

### Sub-PR 3.5: Extract Audio/Sound System → `src/sounds.mjs`

**What:** Move all audio playback and sound caching code.

**Functions to extract:**
- `preCacheSounds()`
- `updateSoundStatus()`
- `playNotifSound()`
- `stopNotifSound()`
- Sound URL constants (`SOUND_URLS`, `SOUND_CACHE_NAME`)
- `currentAudio` state
- Sound-stop event listeners (`keydown`, `mousedown`, `touchstart`, `pointerdown`, `visibilitychange`)

**Module exports:**
```javascript
export { preCacheSounds, playNotifSound, stopNotifSound, updateSoundStatus, SOUND_URLS };
```

**DOM coupling:** `updateSoundStatus()` accesses DOM elements. Use Option B again — export the pure function and keep DOM wrappers in the main code.

**Files created:** `src/sounds.mjs`  
**Lines removed from index.html:** ~60

---

### Sub-PR 3.6: Extract Notification System → `src/notifications.mjs`

**What:** Move all client-side notification logic.

**Functions to extract:**
- `requestNotifPermission()`
- `scheduleNotifications()`
- `syncNotifDataToSW()`
- `checkAndFireNotifications()`
- `fireNotification()`
- `sendTestNotification()`
- `fireTestNotification()`
- Notification state: `notifTimeouts`, `notifCheckInterval`, `firedNotifs`, `firedNotifsDate`, `NOTIF_GRACE_MS`
- `setAppBadge()`, `clearAppBadge()`
- `wakeScreen()`

**Dependencies:**
- `state` (notifications settings, position, locale) — pass as parameter or import state module
- `prayerTimes` — pass as parameter
- `t()` — import from i18n
- `playNotifSound()` — import from `src/sounds.mjs`
- `nowInCasa()` — shared utility, extract to `src/utils.mjs`

**New utility file:** `src/utils.mjs`
```javascript
export function nowInCasa() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Casablanca' }));
}
export function $(id) { return document.getElementById(id); }
```

**Files created:** `src/notifications.mjs`, `src/utils.mjs`  
**Lines removed from index.html:** ~200

---

### Sub-PR 3.7: Extract Push Subscription → `src/push.mjs`

**What:** Move VAPID push subscription and Gist storage code.

**Functions to extract:**
- `urlBase64ToUint8Array()`
- `subscribeToPush()`
- `storeSubscriptionInGist()`
- `unsubscribeFromPush()`

**Dependencies:**
- `VAPID_PUBLIC_KEY`, `GIST_ID`, `GIST_TOKEN` — imported from build-time defines (via `src/constants.mjs` or directly)
- `state` — pass as parameter

**Files created:** `src/push.mjs`  
**Lines removed from index.html:** ~100

---

### Sub-PR 3.8: Extract PWA Install + Platform Detection → `src/install.mjs`

**What:** Move install prompt and platform detection code.

**Functions to extract:**
- `isStandalone()`
- `isIOS()`
- `detectPlatform()`
- `getDndInstructions()`
- `setupInstallPrompt()`
- `showInstallBanner()`
- `deferredInstallPrompt` state

**Files created:** `src/install.mjs`  
**Lines removed from index.html:** ~80

---

### Sub-PR 3.9: Extract Device Capabilities → `src/capabilities.mjs`

**What:** Move the capability detection grid code.

**Functions to extract:**
- `detectCapabilities()`
- `renderCapabilities()`

**Files created:** `src/capabilities.mjs`  
**Lines removed from index.html:** ~120

---

### Sub-PR 3.10: Extract UI Renderers → `src/ui/`

**What:** Move the DOM rendering functions. This is the largest and most coupled extraction.

**Split into:**
- `src/ui/prayers.mjs` — `renderPrayers()`, `updateCountdown()`, `startCountdown()`, `formatGregorian()`, `formatHijri()`, hijri month names
- `src/ui/qibla.mjs` — `renderQibla()`
- `src/ui/settings.mjs` — `renderSettings()`, `populateCitySelect()`
- `src/ui/nav.mjs` — `renderNav()`, `switchView()`
- `src/ui/onboarding.mjs` — `setupOnboarding()`
- `src/ui/notifications-ui.mjs` — notification bar (`checkNotifBar`), tester popup, DND panel rendering
- `src/ui/help.mjs` — help popup, share toast
- `src/ui/update.mjs` — update banner, reload assets, hard refresh

**Shared dependency:** All UI modules need `$()` (DOM accessor) and `t()` (i18n). Import from `src/utils.mjs` and `src/i18n.mjs`.

**State management:** Currently `state` is a local variable in the IIFE. After extraction, either:
- **Option A:** Create `src/state.mjs` that exports a shared state object and `loadState()`/`saveState()` functions. All modules import from it.
- **Option B:** Pass `state` as a parameter to every function.

**Recommended:** Option A. Create `src/state.mjs`:
```javascript
export const state = {
  locale: 'ar',
  position: null,
  adjustments: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  notifications: { enabled: false, prayers: {...}, advance: 0, soundPre: 'tone', soundAt: 'adhan', vibrate: true, badge: true },
  onboarded: false,
  currentView: 'prayers',
};

export function loadState() { /* ... */ }
export function saveState(key, val) { /* ... */ }
```

**Files created:** `src/state.mjs`, `src/ui/prayers.mjs`, `src/ui/qibla.mjs`, `src/ui/settings.mjs`, `src/ui/nav.mjs`, `src/ui/onboarding.mjs`, `src/ui/notifications-ui.mjs`, `src/ui/help.mjs`, `src/ui/update.mjs`  
**Lines removed from index.html:** ~400

---

### Sub-PR 3.11: Create `src/app.mjs` (Entry Point) and Finalize

**What:** The remaining inline JS in `index.html` is boot/init code. Move it to `src/app.mjs`.

**`src/app.mjs` contains:**
- `setupEvents()` (event wiring — calls into all other modules)
- `registerSW()`
- `showUpdateBanner()`
- Boot sequence: `loadState()`, URL param handling, `applyLocale()`, `setupOnboarding()`, `setupEvents()`, `renderAll()`, `registerSW()`, `setupInstallPrompt()`, `checkNotifBar()`, `scheduleNotifications()`, `preCacheSounds()`, periodic sync registration.

**`index.html` becomes:**
```html
<script type="module" src="src/app.mjs"></script>
```

One line of JavaScript in `index.html`. Vite bundles everything at build time.

**Files created:** `src/app.mjs`  
**Lines removed from index.html:** remaining ~100  
**Final inline JS in index.html:** 0 lines (just a `<script type="module" src>` tag)

---

## ESLint Configuration Update

**After all sub-PRs:** Update `eslint.config.mjs`:
```javascript
export default [
  {
    files: ['src/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        localStorage: 'readonly', location: 'readonly', history: 'readonly',
        console: 'readonly', setTimeout: 'readonly', setInterval: 'readonly',
        clearTimeout: 'readonly', clearInterval: 'readonly',
        fetch: 'readonly', caches: 'readonly', URL: 'readonly',
        Intl: 'readonly', Notification: 'readonly', Audio: 'readonly',
        DeviceOrientationEvent: 'readonly', AbsoluteOrientationSensor: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        sessionStorage: 'readonly', confirm: 'readonly', alert: 'readonly',
        THREE: 'readonly',
      }
    },
    rules: { /* same rules */ }
  }
];
```

---

## Target File Structure After Phase 3

```
src/
├── app.mjs                  # Entry point, boot, event wiring
├── state.mjs                # Shared state, localStorage
├── constants.mjs            # PRAYER_KEYS, TZ, KAABA coords, VAPID keys
├── utils.mjs                # $(), nowInCasa()
├── prayer.mjs               # Prayer calculation (canonical, existing)
├── cities.mjs               # City database (canonical, existing)
├── i18n.mjs                 # i18n system (canonical, existing, extended)
├── compass.mjs              # Heading engine, orientation
├── ar.mjs                   # AR mode (lazy-loaded)
├── sounds.mjs               # Audio playback, caching
├── notifications.mjs        # Notification scheduling, firing
├── push.mjs                 # VAPID push subscription
├── install.mjs              # PWA install prompt
├── capabilities.mjs         # Device capability detection
├── ui/
│   ├── prayers.mjs          # Prayer list, countdown, dates
│   ├── qibla.mjs            # Qibla compass view
│   ├── settings.mjs         # Settings view
│   ├── nav.mjs              # Navigation, view switching
│   ├── onboarding.mjs       # Onboarding wizard
│   ├── notifications-ui.mjs # Notification bar, tester popup
│   ├── help.mjs             # Help popup, share
│   └── update.mjs           # Update banner, reload, hard refresh
└── styles.css               # All CSS (from Phase 1)
```

---

## Testing Strategy

### Per Sub-PR

- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] `npm run test:e2e` passes
- [ ] Manual smoke test in browser (the specific feature that was extracted)

### After All Sub-PRs

- [ ] Full manual test of every feature: onboarding, prayer times display, city switching, language switching, countdown, qibla compass, AR mode, notification toggle, sound test, advance alerts, badge, install prompt, help popup, share, export/import settings, reset, hard refresh, reload assets, update banner
- [ ] Offline test: install, disconnect, verify everything works
- [ ] Build size verification: `dist/index.html` < 100 KB gzipped
- [ ] Deploy to staging environment and verify push notifications

---

## Rollback Plan

Each sub-PR can be reverted independently. The app continues to work as long as the inline code or the modular import exists — they're mutually exclusive (you either have the inline function or the import, not both).

If the entire phase needs reverting, revert all sub-PRs in reverse order. Phase 1 and Phase 2 changes remain intact.

---

## What This Phase Does NOT Touch

- `public/sw.js` contents — not modularized (browser compatibility)
- Push notification workflow (`.github/workflows/push-notifications.yml`) — addressed in Phase 4
- `tests/push.test.mjs` — addressed in Phase 4
- Build configuration — established in Phase 2, unchanged here
- Deploy workflow — unchanged from Phase 2
