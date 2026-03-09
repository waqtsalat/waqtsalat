# CR-004: Phase 4 — Workflow Alignment and Cleanup

**Project:** WaqtSalat Modularization  
**Phase:** 4 of 4  
**Risk Level:** Low-Medium  
**Prerequisite:** CR-003 (Phase 3) merged and verified  
**Estimated Effort:** 1–2 days  

---

## Objective

Align the push notification GitHub Action workflow with the canonical `src/prayer.mjs` module. Remove duplicate prayer calculation code. Clean up obsolete files and test artifacts. Ensure all three prayer calculation consumers (app, SW, GitHub Action) are tested and documented.

---

## Motivation

After Phase 3, the app imports prayer calculations from `src/prayer.mjs`. However, two other consumers still maintain independent copies:

1. **`.github/workflows/push-notifications.yml`** — Contains ~60 lines of inline prayer calculation in the `actions/github-script` block. This is a simplified version that omits higher-order terms.
2. **`public/sw.js`** — Does not calculate prayer times (it receives them from the page via `postMessage`). No duplication issue here.
3. **`tests/push.test.mjs`** — Contains a *third* copy of the workflow's prayer calculation for comparison testing. This copy should be eliminated.

---

## Changes Required

### 1. Extract Workflow Push Script → `scripts/send-push.mjs`

**What:** Move the inline JavaScript from `.github/workflows/push-notifications.yml` into a standalone Node script that can import from `src/prayer.mjs`.

**New file:** `scripts/send-push.mjs`

**Contents:** The script performs these steps (currently all inline in the workflow):
1. Install `web-push` and configure VAPID details.
2. Read subscriptions from GitHub Gist.
3. Calculate prayer times for each subscriber's city.
4. Determine if current Casablanca time matches any prayer ± 2 minutes.
5. Send push notifications for matching prayers.
6. Clean up expired subscriptions.

**Key change:** Replace the inline `calcPrayers()` function with an import:
```javascript
import { getPrayerTimesForDate, getCasablancaOffset } from '../src/prayer.mjs';
```

**Adaptation needed:** The inline `calcPrayers()` returns `{ fajr, dhuhr, asr, maghrib, isha }` (5 prayers, no sunrise). The canonical `getPrayerTimesForDate()` returns `{ fajr, sunrise, dhuhr, asr, maghrib, isha }` (6 prayers). The push script only sends notifications for the 5 prayer times (not sunrise), so the extra `sunrise` key is simply ignored. No logic change needed.

**Timezone handling:** The inline code uses `getCasaOffset()` which is a simplified version. The canonical `getCasablancaOffset()` from `src/prayer.mjs` is more accurate (handles fractional offsets). Since both functions use `Intl.DateTimeFormat` with `Africa/Casablanca`, the output is identical for all practical cases. But switching to the canonical version eliminates any theoretical drift.

**Current Casablanca time calculation:** The inline code has its own `nowInCasa()` implementation. The push script should use a local helper or import from `src/utils.mjs`. However, `src/utils.mjs` uses browser-specific code. Better to keep a minimal Node-compatible helper in the script itself:
```javascript
function nowCasablancaMinutes() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Casablanca', hour: 'numeric', minute: 'numeric', hour12: false
  }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour').value);
  const m = parseInt(parts.find(p => p.type === 'minute').value);
  return h * 60 + m;
}
```

**File structure of `scripts/send-push.mjs`:**
```javascript
#!/usr/bin/env node
import { getPrayerTimesForDate } from '../src/prayer.mjs';

// Environment variables (from GitHub Secrets)
const {
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL,
  GIST_ID, GIST_TOKEN
} = process.env;

// ... (web-push setup, gist read, time check, push send, cleanup)
```

**Files created:** `scripts/send-push.mjs`

---

### 2. Update Push Notification Workflow

**In `.github/workflows/push-notifications.yml`:**

**Replace the `actions/github-script` step** with a checkout + node execution:

```yaml
name: Prayer Time Push Notifications

on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:

permissions: {}

jobs:
  send-push:
    runs-on: ubuntu-latest
    timeout-minutes: 3

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          sparse-checkout: |
            src/prayer.mjs
            scripts/send-push.mjs
          sparse-checkout-cone-mode: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install web-push
        run: npm install web-push --no-save --silent

      - name: Send push notifications
        env:
          VAPID_PUBLIC_KEY: ${{ secrets.VAPID_PUBLIC_KEY }}
          VAPID_PRIVATE_KEY: ${{ secrets.VAPID_PRIVATE_KEY }}
          VAPID_EMAIL: ${{ secrets.VAPID_EMAIL }}
          GIST_ID: ${{ secrets.GIST_ID }}
          GIST_TOKEN: ${{ secrets.GIST_TOKEN }}
        run: node scripts/send-push.mjs
```

**Key changes from current workflow:**
1. **Added checkout step** with sparse checkout — only fetches `src/prayer.mjs` and `scripts/send-push.mjs` to minimize checkout time (~2-3s instead of full repo clone).
2. **Added Node.js setup** — ensures consistent Node version.
3. **Separated npm install** — `web-push` is installed as a one-off (not a project dependency).
4. **Replaced inline script** with `node scripts/send-push.mjs`.

**Performance impact:** The workflow runs every 5 minutes. Added steps (checkout + Node setup) add ~5-8 seconds. The 3-minute timeout is still adequate. Over 24 hours, that's ~288 extra checkouts. GitHub Actions caches Node.js setup, so the overhead is minimal.

**Files changed:** `.github/workflows/push-notifications.yml`

---

### 3. Update `tests/push.test.mjs`

**Current state:** This test file contains its own copy of the workflow's `calcPrayers()` function (~50 lines) and compares it against `src/prayer.mjs`'s `getPrayerTimesForDate()`.

**After change:** The workflow now uses `src/prayer.mjs` directly, so comparing two outputs of the same function is pointless. The test needs restructuring.

**New purpose of `push.test.mjs`:**  
Validate that `scripts/send-push.mjs` can be imported and that its push-sending logic is correct. Since the actual push sending requires VAPID keys and a Gist, the test should focus on:

1. **Prayer time matching logic** — given a set of prayer times and a current time, verify the correct prayers are identified for notification.
2. **Advance notification timing** — verify that advance alerts fire at the correct offset.
3. **Subscription filtering** — verify that per-prayer toggles are respected.

**Refactored test approach:**  
Extract the time-matching logic from `scripts/send-push.mjs` into a testable pure function:

```javascript
// In scripts/send-push.mjs:
export function findMatchingPrayers(prayerTimes, nowMinutes, prayers, advance) {
  const results = [];
  const NAMES = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
  for (const [k, time] of Object.entries(prayerTimes)) {
    if (!prayers[k] || !time) continue;
    const [ph, pm] = time.split(':').map(Number);
    const pMin = ph * 60 + pm;
    const isAtTime = Math.abs(pMin - nowMinutes) <= 2;
    const isAdvanceTime = advance > 0 && Math.abs((pMin - advance) - nowMinutes) <= 2;
    if (isAtTime) results.push({ prayer: k, type: 'at-time', name: NAMES[k], time });
    if (isAdvanceTime) results.push({ prayer: k, type: 'advance', name: NAMES[k], time });
  }
  return results;
}
```

**New `tests/push.test.mjs`:**
```javascript
import { describe, it, expect } from 'vitest';
import { findMatchingPrayers } from '../scripts/send-push.mjs';
import { getPrayerTimesForDate } from '../src/prayer.mjs';

describe('Push notification prayer matching', () => {
  const allPrayers = { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };

  it('matches a prayer at exact time', () => {
    const times = { fajr: '06:00', dhuhr: '13:05', asr: '16:30', maghrib: '19:00', isha: '20:30' };
    const matches = findMatchingPrayers(times, 13 * 60 + 5, allPrayers, 0);
    expect(matches).toHaveLength(1);
    expect(matches[0].prayer).toBe('dhuhr');
    expect(matches[0].type).toBe('at-time');
  });

  it('matches within ±2 minute tolerance', () => {
    const times = { fajr: '06:00', dhuhr: '13:05', asr: '16:30', maghrib: '19:00', isha: '20:30' };
    const matches = findMatchingPrayers(times, 13 * 60 + 7, allPrayers, 0);
    expect(matches).toHaveLength(1);
    expect(matches[0].prayer).toBe('dhuhr');
  });

  it('does not match outside tolerance', () => {
    const times = { fajr: '06:00', dhuhr: '13:05', asr: '16:30', maghrib: '19:00', isha: '20:30' };
    const matches = findMatchingPrayers(times, 13 * 60 + 8, allPrayers, 0);
    expect(matches).toHaveLength(0);
  });

  it('respects per-prayer toggles', () => {
    const times = { fajr: '06:00', dhuhr: '13:05', asr: '16:30', maghrib: '19:00', isha: '20:30' };
    const prayers = { fajr: true, dhuhr: false, asr: true, maghrib: true, isha: true };
    const matches = findMatchingPrayers(times, 13 * 60 + 5, prayers, 0);
    expect(matches).toHaveLength(0);
  });

  it('fires advance notification at correct offset', () => {
    const times = { fajr: '06:00', dhuhr: '13:05', asr: '16:30', maghrib: '19:00', isha: '20:30' };
    const matches = findMatchingPrayers(times, 13 * 60 + 5 - 10, allPrayers, 10);
    const advMatch = matches.find(m => m.type === 'advance');
    expect(advMatch).toBeDefined();
    expect(advMatch.prayer).toBe('dhuhr');
  });

  it('prayer times from src/prayer.mjs produce valid HH:MM format', () => {
    const date = new Date(2025, 5, 15);
    const times = getPrayerTimesForDate(date, 34.0209, -6.8416);
    for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      expect(times[k]).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});
```

**Files changed:** `tests/push.test.mjs` (rewritten)  
**Files changed:** `scripts/send-push.mjs` (export `findMatchingPrayers`)

---

### 4. Clean Up Obsolete Files

**Files to verify/remove after all phases:**

| File | Status | Action |
|------|--------|--------|
| `scripts/build.mjs` | Replaced by Vite in Phase 2 | Delete if still present |
| `scripts/check-syntax.mjs` | Replaced by Vite in Phase 2 | Delete if still present |
| `src/locales/ar.js` | Replaced by ES import in Phase 3 | Delete if still present |
| `src/locales/fr.js` | Replaced by ES import in Phase 3 | Delete if still present |
| `src/locales/en.js` | Replaced by ES import in Phase 3 | Delete if still present |
| `src/cities-data.js` | Replaced by ES import in Phase 3 | Delete if still present |

---

### 5. Document the Three-Layer Notification Architecture

**New file:** `docs/notifications.md`

**Purpose:** Document how the three notification layers work together, since the code is now spread across multiple files and a GitHub Action.

**Contents:**

```markdown
# Notification Architecture

WaqtSalat uses three layers of notification delivery to maximize
reliability across platforms and app states.

## Layer 1: Notification Triggers API (Chrome Android)
- **File:** `public/sw.js` → `scheduleTriggeredNotifications()`
- **How:** Uses the Notification Triggers API to schedule notifications
  at exact timestamps. The OS wakes the SW at the scheduled time.
- **Availability:** Chrome 80+ on Android only.
- **Fallback:** If unavailable, Layer 2 activates.

## Layer 2: SW Polling + Page setTimeout
- **Files:** `src/notifications.mjs`, `public/sw.js`
- **How:** The page polls every 15s (`checkAndFireNotifications`).
  The SW also checks on every fetch event and periodic sync.
- **Limitation:** Unreliable when app is closed or device is sleeping.

## Layer 3: VAPID Push via GitHub Actions
- **Files:** `scripts/send-push.mjs`,
  `.github/workflows/push-notifications.yml`, `src/push.mjs`
- **How:** A GitHub Action runs every 5 minutes, calculates prayer
  times for each subscriber, and sends web push notifications via
  VAPID.
- **Availability:** All platforms with push support (iOS 16.4+,
  Android, desktop).
- **Data flow:** Subscriptions stored in a private GitHub Gist.
  The page writes subscriptions via `src/push.mjs`. The Action
  reads them and sends pushes.

## Prayer Calculation Source of Truth
All three layers use `src/prayer.mjs` (directly or indirectly):
- Layer 1 & 2: Page calculates times and sends to SW via postMessage.
- Layer 3: `scripts/send-push.mjs` imports from `src/prayer.mjs`.
```

**Files created:** `docs/notifications.md`

---

### 6. Document Module Dependency Graph

**New file:** `docs/modules.md`

**Purpose:** Help contributors understand the module structure after refactoring.

**Contents:**
```markdown
# Module Dependency Graph

## Entry Point
src/app.mjs → boots the application

## Core (no DOM dependencies)
src/prayer.mjs    — prayer time calculations
src/cities.mjs    — city database
src/i18n.mjs      — translations
src/constants.mjs  — shared constants
src/state.mjs     — state management, localStorage

## Features (may access DOM)
src/compass.mjs         — heading engine
src/ar.mjs              — AR mode (lazy-loaded, depends on compass)
src/sounds.mjs          — audio playback and caching
src/notifications.mjs   — notification scheduling
src/push.mjs            — VAPID push subscription
src/install.mjs         — PWA install prompt
src/capabilities.mjs    — device capability detection

## UI Renderers (DOM-dependent)
src/ui/prayers.mjs          — prayer list view
src/ui/qibla.mjs            — qibla compass view
src/ui/settings.mjs         — settings view
src/ui/nav.mjs              — navigation bar
src/ui/onboarding.mjs       — onboarding wizard
src/ui/notifications-ui.mjs — notification UI elements
src/ui/help.mjs             — help popup
src/ui/update.mjs           — update/reload UI

## Standalone (not bundled)
public/sw.js           — service worker (independent)
scripts/send-push.mjs  — GitHub Action push sender
```

**Files created:** `docs/modules.md`

---

### 7. Update README

**Update the "Project Structure" section** to reflect the new layout:

```markdown
## Project Structure

waqtsalat/
├── index.html              # HTML shell (JS/CSS bundled by Vite at build time)
├── public/
│   ├── sw.js               # Service Worker (cache-first, versioned)
│   ├── manifest.webmanifest
│   └── icons/
├── src/
│   ├── app.mjs             # Entry point
│   ├── state.mjs           # State management
│   ├── prayer.mjs          # Prayer calculation engine
│   ├── cities.mjs          # Moroccan cities database
│   ├── i18n.mjs            # Trilingual dictionaries
│   ├── constants.mjs       # Shared constants
│   ├── utils.mjs           # DOM helpers, timezone utilities
│   ├── compass.mjs         # Compass heading engine
│   ├── ar.mjs              # AR mode (lazy-loaded)
│   ├── sounds.mjs          # Audio playback
│   ├── notifications.mjs   # Notification system
│   ├── push.mjs            # VAPID push subscription
│   ├── install.mjs         # PWA install prompt
│   ├── capabilities.mjs    # Device capability detection
│   ├── styles.css          # All CSS
│   └── ui/                 # UI renderers
├── scripts/
│   ├── send-push.mjs       # Push notification sender (GitHub Action)
│   └── fetch-dataset.mjs   # Reference data fetcher
├── tests/
├── e2e/
├── docs/
│   ├── notifications.md    # Notification architecture
│   └── modules.md          # Module dependency graph
├── vite.config.mjs         # Build configuration
└── ...
```

**Also update the FAQ:**

> **Q: How do notifications work without a server?**
> A: WaqtSalat uses three layers: (1) Notification Triggers API for Chrome Android, (2) Service Worker polling as a fallback, and (3) VAPID web push via a GitHub Action running every 5 minutes for maximum reliability across platforms. See `docs/notifications.md` for details.

**Files changed:** `README.md`

---

### 8. Final Validation: SW Notification Data Sync

**Verify that `syncNotifDataToSW()` in `src/notifications.mjs` sends prayer time data in the format `public/sw.js` expects.**

The SW's `loadNotifData()` expects:
```json
{
  "prayerTimes": { "fajr": "HH:MM", "dhuhr": "HH:MM", ... },
  "settings": { "enabled": true, "prayers": {...}, "advance": 0, ... },
  "i18n": { "fajr": "الفجر", ... },
  "date": "2025-6-15",
  "firedKeys": []
}
```

Since `src/prayer.mjs`'s `getPrayerTimesForDate()` returns the same `{ fajr: "HH:MM", ... }` format, no adaptation is needed. But this should be explicitly verified with a test:

**Add to `tests/push.test.mjs` or a new `tests/sw-compat.test.mjs`:**
```javascript
it('prayer time format is SW-compatible (HH:MM strings)', () => {
  const date = new Date(2025, 5, 15);
  const times = getPrayerTimesForDate(date, 34.0209, -6.8416);
  for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    expect(times[k]).toMatch(/^\d{2}:\d{2}$/);
    const [h, m] = times[k].split(':').map(Number);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(24);
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThan(60);
  }
});
```

---

## Files Summary

| File | Action | Notes |
|------|--------|-------|
| `scripts/send-push.mjs` | Create | Extracted from workflow inline code |
| `.github/workflows/push-notifications.yml` | Edit | Checkout + run script instead of inline |
| `tests/push.test.mjs` | Rewrite | Test matching logic, not duplicate calc |
| `docs/notifications.md` | Create | Architecture documentation |
| `docs/modules.md` | Create | Module dependency documentation |
| `README.md` | Edit | Update structure and FAQ |
| Various obsolete files | Delete | Phase 1-3 transitional files |

---

## Testing Checklist

- [ ] `npm run lint` passes
- [ ] `npm test` passes (unit tests including rewritten push tests)
- [ ] `npm run build` succeeds
- [ ] `npm run test:e2e` passes
- [ ] `scripts/send-push.mjs` runs without error when given valid env vars (manual test or dry-run mode)
- [ ] Push notification workflow runs successfully via `workflow_dispatch` trigger
- [ ] Manual: trigger a push notification and verify delivery
- [ ] CI: deploy workflow succeeds end-to-end
- [ ] CI: push notification workflow succeeds

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Workflow checkout adds latency | Low | Sparse checkout (~2s). 3min timeout still adequate. |
| Prayer times differ after switching to canonical module | Low | Existing `tests/prayer.test.mjs` validates against reference dataset within ±1 min. |
| `web-push` npm install fails in Action | Low | Already works today. Pin version if needed. |
| Node ES module import fails in GitHub Actions | Low | Node 22 fully supports ESM. Use `.mjs` extension. |

---

## Rollback Plan

1. Revert the workflow to inline script (restore the `actions/github-script` step).
2. Revert `tests/push.test.mjs` to the version with inline `calcPrayers()`.
3. Delete `scripts/send-push.mjs`.
4. Delete `docs/` files (documentation, no functional impact).

Phases 1–3 are unaffected by a Phase 4 rollback.

---

## Post-Phase 4: Project Health

After all four phases are complete:

- **`index.html`:** ~400 lines (HTML markup only, zero inline JS/CSS)
- **Largest JS module:** `src/prayer.mjs` at ~200 lines (well within Claude Code's context window)
- **Total JS across all modules:** ~1,500 lines (same as before, but distributed)
- **Build output:** Single `dist/index.html` < 100 KB gzipped (same as before)
- **Prayer calculation:** Single source of truth (`src/prayer.mjs`) used by app, tests, and GitHub Action
- **Test coverage:** Unit tests cover prayer math; e2e tests cover UI; push tests cover notification matching logic
- **CI/CD:** Both workflows (deploy + push) are fully functional
- **Documentation:** Architecture and module graph documented for contributors
