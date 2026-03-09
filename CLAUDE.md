# CLAUDE.md — WaqtSalat

## Project Overview

WaqtSalat is a Moroccan prayer times PWA. Modular ES module architecture, offline-first, zero runtime dependencies, zero tracking. Morocco only, Habous method.

## Architecture

The app uses a **modular ES module** source structure under `src/`, built into a **single-file `index.html`** for production via Vite + `vite-plugin-singlefile`.

### Source Files (`src/`)

| File | Purpose |
|------|---------|
| `app.mjs` | Entry point — boot sequence, event wiring, `applyLocale()`, `renderAll()` |
| `state.mjs` | Shared state singleton, `loadState()`, `saveState()` (localStorage, prefix `waqt-`) |
| `constants.mjs` | `PRAYER_KEYS`, `TZ`, `KAABA_LAT`, `KAABA_LNG` |
| `utils.mjs` | `$()` DOM accessor, `nowInCasa()`, `showShareToast()` |
| `prayer.mjs` | Prayer time calculation engine (Habous: Fajr 19°, Isha 17°). **Canonical** — tested against golden master |
| `cities.mjs` | Moroccan cities database (lat/lng/names). **Canonical** |
| `i18n.mjs` | Trilingual dictionaries (AR/FR/EN), `t(key, locale)`, `detectLocale()`. **Canonical** |
| `compass.mjs` | Heading engine — circular averaging, tilt compensation, AbsoluteOrientationSensor |
| `ar.mjs` | AR Qibla finder (Three.js, lazy-loaded via dynamic `import()`) |
| `sounds.mjs` | Audio playback, sound caching |
| `notifications.mjs` | Local notification scheduling, firing, badge, wake screen |
| `push.mjs` | VAPID push subscription, Gist-based subscription storage |
| `install.mjs` | PWA install prompt (Chrome, iOS, fallback) |
| `capabilities.mjs` | Device capability detection grid |
| `styles.css` | All CSS (logical properties, custom properties for theming) |

### UI Modules (`src/ui/`)

| File | Purpose |
|------|---------|
| `prayers.mjs` | Prayer list rendering, countdown, Gregorian/Hijri dates |
| `qibla.mjs` | Qibla compass view, accuracy UI |
| `settings.mjs` | Settings view, city select, i18n text binding |
| `nav.mjs` | Navigation bar, view switching |
| `onboarding.mjs` | Onboarding wizard |
| `update.mjs` | Update banner, reload assets, hard refresh, SW registration |

### Other Files

| File | Purpose |
|------|---------|
| `index.html` | HTML markup + SVG only. Zero inline JS — loads `src/app.mjs` as `<script type="module">` |
| `public/sw.js` | Service Worker — **standalone, not modularized** (browser constraint). Cache-first, versioned |
| `public/manifest.webmanifest` | PWA manifest |
| `public/icons/` | SVG/PNG icons for PWA installation |
| `vite.config.mjs` | Vite build config with `vite-plugin-singlefile` and build-time secret injection |
| `scripts/fetch-dataset.mjs` | Fetches reference prayer times from Al Adhan API (method MOROCCO id=21) |
| `tests/prayer.test.mjs` | Prayer calculation tests against golden master dataset |
| `tests/data/rabat-reference.json` | Reference data from official sources |

## Modular Architecture Rules

These rules protect the modularization work done in CR-001, CR-002, and CR-003. **All contributors (human and AI) must follow them.**

### Do NOT inline code back into `index.html`
- `index.html` contains **only HTML markup and SVG**. Zero inline `<script>` or `<style>` blocks.
- All JS lives in `src/` as ES modules. All CSS lives in `src/styles.css`.
- Vite inlines everything at build time — developers never inline manually.

### Respect canonical modules
- `src/prayer.mjs`, `src/cities.mjs`, `src/i18n.mjs` are the **single source of truth** for prayer calculations, city data, and translations.
- Never duplicate their logic elsewhere. Import from them.
- If you need to change prayer calculation behavior, change `src/prayer.mjs` and update tests.

### Module boundaries
- Each `src/*.mjs` file has a clear responsibility (see table above). Don't merge unrelated concerns.
- UI modules (`src/ui/`) handle DOM rendering. Non-UI modules export pure logic or thin APIs.
- Shared state goes through `src/state.mjs`. Don't create ad-hoc global state.
- The `$()` DOM accessor and utilities come from `src/utils.mjs`. Don't redefine them.
- The `t(key, locale)` i18n function comes from `src/i18n.mjs`. Always pass `state.locale` explicitly.

### Service Worker stays standalone
- `public/sw.js` is NOT an ES module. It cannot import from `src/`.
- Accept small duplication between `sw.js` and `src/` modules. This is intentional.

### Build pipeline
- `npm run build` runs Vite, which bundles all `src/` modules into a single `dist/index.html`.
- Build-time secrets (`VAPID_PUBLIC_KEY`, `GIST_ID`, `GIST_TOKEN`) are injected via Vite `define` config — never committed to source.
- The `dist/` directory is `.gitignore`d and never committed.

### No global-pattern files
- The old `window.__WAQT_*` global pattern (from Phase 1 interim) has been eliminated.
- Do NOT create files that assign to `window` globals. Use ES module `import`/`export` exclusively.

## Key Technical Decisions

- **Timezone**: Always `Africa/Casablanca`. Use `Intl.DateTimeFormat` — never hardcode offsets. Morocco has special DST (GMT+1 summer, GMT winter, GMT during Ramadan by decree)
- **Prayer calculation**: Based on Jean Meeus "Astronomical Algorithms". Fajr 19°, Isha 17°, Asr = shadow 1x length + zenith shadow
- **i18n**: AR (RTL) / FR (LTR) / EN (LTR). CSS logical properties throughout. `dir` and `lang` on `<html>` updated dynamically
- **Storage**: localStorage only, prefix `waqt-`. Zero cookies, zero analytics
- **Notifications**: Local only via Service Worker `setTimeout`. Push via VAPID (optional, requires secrets)
- **AR mode**: Lazy-loaded via dynamic `import()` — Three.js loaded from CDN on demand
- **Circular dependencies**: Avoided via dynamic `import()` for cross-cutting concerns (e.g., settings → notifications)

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Build single-file production HTML (`dist/index.html`)
- `npm run preview` — Preview production build locally
- `npm test` — Run tests (Vitest)
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Run tests with V8 coverage
- `npm run test:e2e` — Run Playwright e2e tests
- `npm run fetch-dataset` — Fetch reference prayer times from Al Adhan API
- `npm run lint` — Run ESLint

## Code Style

- Vanilla JS, ES modules (`import`/`export`) throughout `src/`
- No external runtime dependencies — Three.js is loaded on demand for AR only
- CSS: logical properties, CSS custom properties for theming
- HTML: semantic, WCAG 2.1 AA accessible
- Test tolerance: prayer times must match reference data within ±1 minute

## Deployment

GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`). Deploys on push to `main`:
1. Lint + unit tests + e2e tests
2. `npm run build` (Vite, with VAPID secrets as env vars)
3. Verify build (no unreplaced placeholders, size < 100 KB gzipped)
4. Deploy `dist/` to GitHub Pages

## License

GPL-3.0
