# Copilot Instructions — WaqtSalat

## What This Project Is

WaqtSalat is a Moroccan prayer times PWA. Modular ES module source under `src/`, built into a single-file `dist/index.html` via Vite + `vite-plugin-singlefile`. Morocco only, Habous method (Fajr 19°, Isha 17°).

## Architecture Rules

### Modular source, single-file output

- All JavaScript lives in ES modules under `src/`. Entry point: `src/app.mjs`.
- All CSS lives in `src/styles.css`.
- `index.html` contains **only HTML markup and SVG**. Zero inline `<script>` or `<style>` blocks.
- Vite bundles everything into a single `dist/index.html` at build time. Developers never inline manually.
- **NEVER** add inline JS or CSS to `index.html`.

### Canonical modules — single source of truth

- `src/prayer.mjs` — prayer time calculations. Tested against golden master dataset.
- `src/cities.mjs` — Moroccan cities database.
- `src/i18n.mjs` — trilingual dictionaries and `t(key, locale)` function.
- **NEVER** duplicate logic from these modules. Always import from them.

### Module responsibilities

| Module | Responsibility |
|--------|---------------|
| `src/app.mjs` | Boot sequence, event wiring, `applyLocale()`, `renderAll()` |
| `src/state.mjs` | Shared state singleton, `loadState()`, `saveState()` |
| `src/constants.mjs` | `PRAYER_KEYS`, `TZ`, `KAABA_LAT`, `KAABA_LNG` |
| `src/utils.mjs` | `$()` DOM accessor, `nowInCasa()`, `showShareToast()` |
| `src/compass.mjs` | Heading engine, tilt compensation, orientation sensors |
| `src/ar.mjs` | AR Qibla finder (Three.js, lazy-loaded via dynamic `import()`) |
| `src/sounds.mjs` | Audio playback, sound caching |
| `src/notifications.mjs` | Local notification scheduling and firing |
| `src/push.mjs` | VAPID push subscription, Gist storage |
| `src/install.mjs` | PWA install prompt handling |
| `src/capabilities.mjs` | Device capability detection |
| `src/ui/prayers.mjs` | Prayer list rendering, countdown, dates |
| `src/ui/qibla.mjs` | Qibla compass view |
| `src/ui/settings.mjs` | Settings view rendering |
| `src/ui/nav.mjs` | Navigation, view switching |
| `src/ui/onboarding.mjs` | Onboarding wizard |
| `src/ui/update.mjs` | Update banner, SW registration |

### Service Worker is standalone

- `public/sw.js` is NOT an ES module. It cannot import from `src/`.
- Small duplication between `sw.js` and `src/` is intentional and accepted.
- Do NOT attempt to modularize `sw.js`.

### No global patterns

- Do NOT create files that assign to `window.*` globals. Use ES module `import`/`export`.
- The old `window.__WAQT_*` pattern was eliminated in CR-003.

### Build-time secrets

- `VAPID_PUBLIC_KEY`, `GIST_ID`, `GIST_TOKEN` are injected via Vite `define` config.
- Referenced as bare identifiers (e.g., `__VAPID_PUBLIC_KEY__`) in source. Vite replaces them at build time.
- Never hardcode secrets in source files.

## Key Technical Constraints

- **Timezone**: Always `Africa/Casablanca`. Use `Intl.DateTimeFormat` — never hardcode UTC offsets.
- **i18n**: `t(key, locale)` always takes locale as second parameter. Pass `state.locale` explicitly.
- **Morocco only**: Do not add support for other countries, methods, or timezones.
- **Test tolerance**: Prayer times must match reference data within ±1 minute.
- **Accessibility**: WCAG 2.1 AA. CSS logical properties for RTL support.

## Commands

```bash
npm run dev          # Vite dev server with HMR
npm run build        # Build single-file dist/index.html
npm run preview      # Preview production build
npm test             # Unit tests (Vitest)
npm run test:e2e     # Playwright e2e tests
npm run lint         # ESLint
```

## When Adding New Features

1. Create a new module under `src/` (or `src/ui/` for DOM-rendering code).
2. Export functions with clear, specific names.
3. Import shared utilities from `src/utils.mjs`, state from `src/state.mjs`, i18n from `src/i18n.mjs`.
4. Wire into the app via `src/app.mjs` (event handlers, boot sequence).
5. Keep `index.html` as pure HTML markup — no JS, no CSS.
6. Run `npm test`, `npm run lint`, and `npm run build` to verify.
