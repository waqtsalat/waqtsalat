# CLAUDE.md — WaqtSalat

## Project Overview

WaqtSalat is a Moroccan prayer times PWA. Single-file HTML architecture, offline-first, zero dependencies, zero tracking. Morocco only, Malikite rite, Habous method.

## Architecture

- **`index.html`** — The entire app: HTML + inlined CSS + inlined JS + inlined SVG + city data + i18n dictionaries
- **`sw.js`** — Service Worker (separate file, browser constraint). Cache-first, versioned cache
- **`manifest.webmanifest`** — PWA manifest (separate file, spec constraint)
- **`icons/`** — SVG icons for PWA installation
- **`src/`** — Source modules (used during development/testing, inlined into index.html at build)
  - `prayer.mjs` — Prayer time calculation (Habous method: Fajr 19°, Isha 17°, Asr Malikite)
  - `cities.mjs` — Moroccan cities database (lat/lng/names)
  - `i18n.mjs` — Trilingual dictionaries (AR/FR/EN)
- **`scripts/`** — Build and data tooling
  - `fetch-dataset.mjs` — Fetches reference prayer times from Al Adhan API (method MOROCCO id=21)
- **`tests/`** — Vitest test suite
  - `prayer.test.mjs` — Prayer calculation tests against golden master dataset
  - `data/rabat-reference.json` — Reference data from official sources

## Key Technical Decisions

- **Timezone**: Always `Africa/Casablanca`. Use `Intl.DateTimeFormat` — never hardcode offsets. Morocco has special DST (GMT+1 summer, GMT winter, GMT during Ramadan by decree)
- **Prayer calculation**: Based on Jean Meeus "Astronomical Algorithms". Fajr 19°, Isha 17°, Asr = shadow 1x length + zenith shadow (Malikite)
- **i18n**: AR (RTL) / FR (LTR) / EN (LTR). CSS logical properties throughout. `dir` and `lang` on `<html>` updated dynamically
- **Storage**: localStorage only, prefix `waqt-`. Zero cookies, zero analytics
- **Notifications**: Local only via Service Worker `setTimeout`. No push server, no VAPID keys

## Commands

- `npm test` — Run tests (Vitest)
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Run tests with V8 coverage
- `npm run fetch-dataset` — Fetch reference prayer times from Al Adhan API
- `npm run build` — Build the single-file HTML

## Code Style

- Vanilla JS (ES modules in src/, inlined in production)
- No external dependencies in production — everything inlined
- CSS: logical properties, CSS custom properties for theming
- HTML: semantic, WCAG 2.1 AA accessible
- Test tolerance: prayer times must match reference data within ±1 minute

## Deployment

GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`). Deploys on push to `main`. Copies `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`, `src/` to `_site/`.

## License

GPL-3.0
