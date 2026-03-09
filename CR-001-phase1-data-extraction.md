# CR-001: Phase 1 — Safe Data Extraction (CSS, i18n, Cities)

**Project:** WaqtSalat Modularization  
**Phase:** 1 of 4  
**Risk Level:** Very Low  
**Prerequisite:** None  
**Estimated Effort:** 1–2 days  

---

## Objective

Extract static data (CSS, i18n dictionaries, city database) from the monolithic `index.html` into separate files. No build tooling changes. No logic changes. All existing tests must pass without modification.

---

## Motivation

`index.html` currently contains ~2,500+ lines combining HTML markup (~400 lines), CSS (~600 lines), and JavaScript (~1,500+ lines). This exceeds Claude Code's context window and makes targeted edits error-prone. Phase 1 removes ~1,200 lines of pure data with zero logic risk.

---

## Changes Required

### 1. Extract CSS to `src/styles.css`

**What:** Move the entire `<style>...</style>` block (~600 lines) from `index.html` to a new file `src/styles.css`.

**In `index.html`:** Replace the `<style>` block with:
```html
<link rel="stylesheet" href="src/styles.css">
```

**Validation:**
- Open `index.html` in a browser via `npx serve .` — visual appearance must be identical.
- Run Playwright e2e tests — all must pass (they test DOM structure/visibility, not CSS specifics, but visual regressions would break visibility checks).

**Files changed:**
- `index.html` (remove ~600 lines, add 1 line)
- `src/styles.css` (new file, ~600 lines)

---

### 2. Extract i18n Dictionaries to JSON Files

**What:** Move the three language dictionaries (`TR.ar`, `TR.fr`, `TR.en`) from the inline `<script>` in `index.html` into separate JSON files.

**New files:**
- `src/locales/ar.json`
- `src/locales/fr.json`
- `src/locales/en.json`

**In `index.html` inline script:** Replace the `const TR = { ar: {...}, fr: {...}, en: {...} }` block with a synchronous loader that fetches the JSON files at boot. Since the app is offline-first and the service worker caches assets, use inline `<script>` data blocks or embed them as JS objects loaded from separate `<script>` tags:

**Option A — Separate `<script>` tags (simplest, no async):**
```html
<script src="src/locales/ar.js"></script>
<script src="src/locales/fr.js"></script>
<script src="src/locales/en.js"></script>
```
Where each file exports to a global: `window.__TR_AR = { ... }` etc. The main script reads from these globals.

**Option B — Keep as JSON, load synchronously via XHR at boot:**
Not recommended — adds complexity and fails offline on first visit before SW caches.

**Recommended approach:** Option A. Each locale file is a simple JS file that assigns to a namespaced global. The main IIFE reads from these globals to build the `TR` object. This avoids any async loading issues and works identically offline.

**Example `src/locales/ar.js`:**
```javascript
window.__WAQT_LOCALES = window.__WAQT_LOCALES || {};
window.__WAQT_LOCALES.ar = {
  appName: 'وقت الصلاة',
  fajr: 'الفجر',
  // ... all ar keys ...
};
```

**In the main `<script>` block:** Replace:
```javascript
const TR = { ar: { ... }, fr: { ... }, en: { ... } };
```
With:
```javascript
const TR = window.__WAQT_LOCALES || {};
```

**Validation:**
- Switch between all three languages in the app — all strings must render correctly.
- Run unit tests — unaffected (they don't test i18n).
- Run e2e tests — onboarding language selection test must still pass.

**Files changed:**
- `index.html` (remove ~450 lines of TR data, add 3 `<script>` tags, change TR initialization)
- `src/locales/ar.js` (new, ~150 lines)
- `src/locales/fr.js` (new, ~150 lines)
- `src/locales/en.js` (new, ~150 lines)

**Note:** `src/i18n.mjs` (the existing dev/test module) is a separate file with its own copy of translations. It is NOT used at runtime by `index.html`. Do not modify it in this phase — reconciliation happens in Phase 3.

---

### 3. Extract City Database to Separate File

**What:** Move the `CITIES` array (~37 entries, ~120 lines) from the inline `<script>` in `index.html` to a separate file.

**New file:** `src/cities-data.js`

**Pattern:** Same as i18n — assign to a namespaced global:
```javascript
window.__WAQT_CITIES = [
  { id: 'tanger', ar: 'طنجة', fr: 'Tanger', lat: 35.7595, lng: -5.834 },
  // ...
];
```

**In `index.html`:** Add `<script src="src/cities-data.js"></script>` before the main script. Replace inline `const CITIES = [...]` with `const CITIES = window.__WAQT_CITIES || [];`.

**Validation:**
- City dropdown in onboarding and settings must populate correctly.
- GPS auto-detection must still find the nearest city.
- Run e2e tests — city selection tests must pass.

**Files changed:**
- `index.html` (remove ~120 lines, add 1 `<script>` tag, change CITIES initialization)
- `src/cities-data.js` (new, ~120 lines)

**Note:** `src/cities.mjs` already exists with the same data. Do not modify it — reconciliation happens in Phase 3.

---

### 4. Update Service Worker Asset List

**What:** The SW caches a static list of assets. The new files must be added.

**In `sw.js`:** Update the `ASSETS` array:
```javascript
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './src/styles.css',           // NEW
  './src/locales/ar.js',        // NEW
  './src/locales/fr.js',        // NEW
  './src/locales/en.js',        // NEW
  './src/cities-data.js',       // NEW
];
```

**Bump `SW_VERSION`** to trigger cache refresh for existing users:
```javascript
const SW_VERSION = '1.6.0';
```

**Validation:**
- Install the app, go offline, reload — all assets must load from cache.
- The "Reload assets" button must re-cache all new files.

**Files changed:**
- `sw.js` (update ASSETS array, bump version)

---

### 5. Update ESLint Configuration

**What:** The new `.js` files use `window` global assignments, which ESLint should know about.

**In `eslint.config.mjs`:** Add the new files to the `files` glob:
```javascript
files: ['src/**/*.mjs', 'src/**/*.js', 'sw.js', 'scripts/**/*.mjs'],
```

**Validation:**
- `npm run lint` must pass with zero errors.

**Files changed:**
- `eslint.config.mjs` (update files glob)

---

### 6. Update Deploy Workflow

**What:** The deploy workflow copies specific files to `_site/`. The new files must be included.

**In `.github/workflows/deploy.yml`**, update the "Prepare deployment directory" step:
```yaml
- name: Prepare deployment directory
  run: |
    mkdir _site
    cp index.html sw.js manifest.webmanifest _site/
    cp -r icons src _site/
```

This step already copies the `src/` directory, so the new files inside `src/` (`styles.css`, `locales/*.js`, `cities-data.js`) are automatically included. **No change needed** if the `cp -r src _site/` line is already present.

**Verify:** Confirm that the `src/` directory copy is recursive and includes subdirectories (it does — `cp -r` is recursive).

**Files changed:**
- `.github/workflows/deploy.yml` — likely no change needed; verify only.

---

### 7. Update `scripts/check-syntax.mjs`

**What:** This script extracts the last `<script>` block from `index.html` and runs `node --check`. After extracting data to separate files, the main inline script still exists but references globals defined in prior `<script>` tags. The syntax check will fail because `window` is not defined in Node.

**Fix:** The script only checks syntax (not execution), so `window.__WAQT_LOCALES` etc. are fine — they're valid JS syntax even if `window` is undefined at check time. `node --check` only validates parse-ability. **No change needed.**

**Validation:** Run `npm run lint` which calls this script — must pass.

**Files changed:**
- None (verify only).

---

## Files Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `index.html` | Edit (remove ~1,170 lines, add ~5 lines) | -1,165 net |
| `src/styles.css` | Create | +600 |
| `src/locales/ar.js` | Create | +150 |
| `src/locales/fr.js` | Create | +150 |
| `src/locales/en.js` | Create | +150 |
| `src/cities-data.js` | Create | +120 |
| `sw.js` | Edit (ASSETS + version) | +6 |
| `eslint.config.mjs` | Edit (files glob) | +1 |
| `.github/workflows/deploy.yml` | Verify only | 0 |
| `scripts/check-syntax.mjs` | Verify only | 0 |

---

## Testing Checklist

- [ ] `npm run lint` passes
- [ ] `npm test` passes (unit tests)
- [ ] `npx playwright test` passes (e2e tests)
- [ ] Manual: app loads correctly via `npx serve .`
- [ ] Manual: all three languages display correct strings
- [ ] Manual: city dropdown populates in onboarding and settings
- [ ] Manual: app works offline after first load (SW caches new files)
- [ ] Manual: "Reload assets" button works
- [ ] Manual: visual appearance is identical (CSS extracted correctly)
- [ ] Deploy workflow runs successfully on push (CI/CD)

---

## Rollback Plan

Revert the PR. Since this phase only moves data without changing logic, the `index.html` with inline data is the fallback. No data migration or state changes are involved.

---

## What This Phase Does NOT Touch

- Build tooling (`scripts/build.mjs`) — no changes
- JavaScript logic — no refactoring, only data extraction
- `src/prayer.mjs`, `src/cities.mjs`, `src/i18n.mjs` — untouched (reconciled in Phase 3)
- Push notification workflow — untouched
- Unit tests — untouched
- VAPID injection in deploy workflow — untouched
