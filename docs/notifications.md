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
