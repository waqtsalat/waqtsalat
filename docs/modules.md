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
src/ui/prayers.mjs      — prayer list view
src/ui/qibla.mjs        — qibla compass view
src/ui/settings.mjs     — settings view
src/ui/nav.mjs          — navigation bar
src/ui/onboarding.mjs   — onboarding wizard
src/ui/update.mjs       — update/reload UI

## Standalone (not bundled)
public/sw.js           — service worker (independent)
scripts/send-push.mjs  — GitHub Action push sender
