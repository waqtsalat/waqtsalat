<p align="center">
  <img src="icons/icon.svg" alt="WaqtSalat Logo" width="120" height="120">
</p>

<h1 align="center">وقت الصلاة — WaqtSalat</h1>

<p align="center">
  <strong>Prayer times PWA for Morocco</strong><br>
  Habous method &bull; Offline-first &bull; Zero tracking
</p>

<p align="center">
  <a href="https://github.com/waqtsalat/waqtsalat/actions/workflows/deploy.yml"><img src="https://github.com/waqtsalat/waqtsalat/actions/workflows/deploy.yml/badge.svg" alt="Deploy to GitHub Pages"></a>
  <a href="https://github.com/waqtsalat/waqtsalat/blob/main/LICENSE"><img src="https://img.shields.io/github/license/waqtsalat/waqtsalat?color=blue" alt="License: GPL-3.0"></a>
  <a href="https://github.com/waqtsalat/waqtsalat/releases"><img src="https://img.shields.io/github/v/release/waqtsalat/waqtsalat?include_prereleases&sort=semver" alt="Release"></a>
  <a href="https://github.com/waqtsalat/waqtsalat/issues"><img src="https://img.shields.io/github/issues/waqtsalat/waqtsalat" alt="Issues"></a>
  <a href="https://github.com/waqtsalat/waqtsalat/pulls"><img src="https://img.shields.io/github/issues-pr/waqtsalat/waqtsalat" alt="Pull Requests"></a>
  <a href="https://github.com/waqtsalat/waqtsalat/stargazers"><img src="https://img.shields.io/github/stars/waqtsalat/waqtsalat?style=social" alt="Stars"></a>
  <a href="https://github.com/waqtsalat/waqtsalat/network/members"><img src="https://img.shields.io/github/forks/waqtsalat/waqtsalat?style=social" alt="Forks"></a>
  <a href="https://github.com/waqtsalat/waqtsalat/commits/main"><img src="https://img.shields.io/github/last-commit/waqtsalat/waqtsalat" alt="Last Commit"></a>
  <a href="https://github.com/waqtsalat/waqtsalat"><img src="https://img.shields.io/github/repo-size/waqtsalat/waqtsalat" alt="Repo Size"></a>
  <a href="https://github.com/waqtsalat/waqtsalat"><img src="https://img.shields.io/github/languages/top/waqtsalat/waqtsalat" alt="Top Language"></a>
  <a href="https://github.com/waqtsalat/waqtsalat"><img src="https://img.shields.io/github/languages/code-size/waqtsalat/waqtsalat" alt="Code Size"></a>
  <a href="https://waqtsalat.github.io/waqtsalat/"><img src="https://img.shields.io/website?url=https%3A%2F%2Fwaqtsalat.github.io%2Fwaqtsalat%2F&label=demo" alt="Website"></a>
  <a href="https://github.com/waqtsalat/waqtsalat/graphs/contributors"><img src="https://img.shields.io/github/contributors/waqtsalat/waqtsalat" alt="Contributors"></a>
  <img src="https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa" alt="PWA Ready">
  <img src="https://img.shields.io/badge/offline-first-4CAF50" alt="Offline First">
  <img src="https://img.shields.io/badge/tracking-zero-green" alt="Zero Tracking">
  <img src="https://img.shields.io/badge/country-Morocco%20%F0%9F%87%B2%F0%9F%87%A6-red" alt="Morocco Only">
  <img src="https://img.shields.io/badge/method-Habous-blue" alt="Habous Method">
</p>

---

## Morocco Only

> **This application is designed exclusively for Morocco.**
>
> All prayer times are calculated using the method of the **Ministere des Habous et des Affaires Islamiques** (Fajr 19°, Isha 17°). The timezone is hardcoded to `Africa/Casablanca` with Morocco-specific DST handling (including Ramadan decrees). Only Moroccan cities are included. This app will **not** produce correct prayer times for any other country.

---

## Features

- **Prayer times** — Habous method calculations validated against official data within ±1 minute tolerance
- **6 daily prayers** — Fajr, Chourouk (sunrise), Dhuhr, Asr, Maghrib, Isha
- **Trilingual** — Arabic (العربية), French (Francais), English — switchable instantly without reload
- **Full RTL support** — Native right-to-left layout for Arabic using CSS logical properties
- **Qibla compass** — 2D SVG compass with real-time device orientation (when available), AR mode as progressive enhancement
- **Offline-first PWA** — Works 100% offline after first visit. Zero network requests at runtime
- **Installable** — Add to home screen on Android and iOS with guided installation flow
- **Local notifications** — Prayer time alerts scheduled locally via Service Worker. No push server needed
- **Do Not Disturb** — Configurable quiet hours with per-prayer exemptions (e.g., Fajr alarm even during DND)
- **Pre-notifications** — Optional alerts 5/10/15/30 minutes before each prayer
- **Manual adjustments** — ±15 minutes per prayer to align with your local mosque
- **35+ Moroccan cities** — From Tangier to Dakhla, with GPS auto-detection
- **Hijri date** — Gregorian and Islamic calendar displayed side by side
- **Dark/Light/Auto theme** — Respects system preference, manually overridable
- **Zero tracking** — No cookies, no analytics, no external requests. Data stays in localStorage
- **Accessible** — WCAG 2.1 AA compliant: keyboard navigation, screen reader support, high contrast
- **Tiny footprint** — Single HTML file < 100 KB gzipped

## Demo

Visit the live app: **[waqtsalat.github.io/waqtsalat](https://waqtsalat.github.io/waqtsalat/)**

## Quick Start

No build step required. Just serve the files:

```bash
# Clone the repository
git clone https://github.com/waqtsalat/waqtsalat.git
cd waqtsalat

# Serve locally (any static server works)
npx serve .
# or
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser. That's it.

## Development

```bash
# Install dev dependencies (testing only)
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Fetch reference dataset from Al Adhan API
npm run fetch-dataset

# Build single-file HTML (minified)
npm run build
```

## Project Structure

```
waqtsalat/
├── index.html              # The entire app (HTML + CSS + JS + SVG + data)
├── sw.js                   # Service Worker (cache-first, versioned)
├── manifest.webmanifest    # PWA manifest
├── icons/
│   ├── icon.svg            # App icon
│   └── icon-maskable.svg   # Maskable icon for Android
├── src/                    # Source modules (dev/test, inlined at build)
│   ├── prayer.mjs          # Prayer calculation engine
│   ├── cities.mjs          # Moroccan cities database
│   └── i18n.mjs            # Trilingual dictionaries
├── tests/
│   ├── prayer.test.mjs     # Prayer calculation tests
│   └── data/
│       └── rabat-reference.json  # Golden master dataset
├── scripts/
│   └── fetch-dataset.mjs   # Reference data fetcher (Al Adhan API)
├── .github/workflows/
│   └── deploy.yml          # GitHub Pages deployment
├── PRD.md                  # Product Requirements Document
├── CLAUDE.md               # Claude Code development guide
└── LICENSE                 # GPL-3.0
```

## How It Works

1. **First visit** — The app loads, the Service Worker caches all assets. The user picks a language and city (or uses GPS)
2. **Subsequent visits** — Everything served from cache. Zero network requests. Prayer times calculated locally using astronomical algorithms
3. **Notifications** — Scheduled locally via `setTimeout` in the Service Worker. Recalculated on each app open and at midnight
4. **Updates** — The browser checks for Service Worker changes ~every 24h. If updated, a banner prompts the user to refresh

## Prayer Calculation Method

| Parameter | Value |
|-----------|-------|
| Method | Ministere des Habous et des Affaires Islamiques |
| Fajr angle | 19° |
| Isha angle | 17° |
| Asr | Shadow = 1x object length + shadow at zenith |
| Timezone | `Africa/Casablanca` (with Morocco-specific DST) |
| Algorithm | Jean Meeus — Astronomical Algorithms |

## Contributing

Contributions are welcome. Please note:

1. **Morocco only** — Do not add support for other countries. This is by design.
2. **Zero dependencies** — The production app must have no external dependencies. Everything is inlined.
3. **Test first** — All prayer calculation changes must include tests validated against the Al Adhan API (method MOROCCO, id=21). Tolerance: ±1 minute.
4. **Accessibility** — Maintain WCAG 2.1 AA compliance. Test with screen readers.
5. **Single-file** — The final `index.html` must remain self-contained.

### Steps

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/waqtsalat.git
cd waqtsalat

# Install dev dependencies
npm install

# Make your changes
# ...

# Run tests
npm test

# Submit a pull request
```

## FAQ

**Q: Does this work outside Morocco?**
A: No. The prayer times use the Moroccan Habous method and only Moroccan cities are included. The timezone is fixed to `Africa/Casablanca`. Use a different app for other countries.

**Q: Why is there no choice of calculation method?**
A: This app targets Moroccan Muslims who follow the official Habous timings. Simplicity is a feature.

**Q: Do I need an internet connection?**
A: Only for the very first visit. After that, everything works offline, including prayer time calculations.

**Q: Does the app collect any data?**
A: No. Zero cookies, zero analytics, zero network requests after installation. Your settings are stored locally on your device in `localStorage`.

**Q: How close are the prayer times to the official schedule?**
A: Within ±1 minute of the official Habous times. The app uses the same astronomical algorithms and parameters.

**Q: Can I adjust times to match my local mosque?**
A: Yes. In Settings, you can adjust each prayer time by ±15 minutes in 1-minute increments.

**Q: How do notifications work without a server?**
A: The Service Worker schedules notifications locally using `setTimeout`. No push server, no VAPID keys, no external service.

## License

[GPL-3.0](LICENSE) — Free software. You can redistribute and modify it under the terms of the GNU General Public License v3.
