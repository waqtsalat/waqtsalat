# CR-002: Phase 2 — Build Tooling (Vite Integration)

**Project:** WaqtSalat Modularization  
**Phase:** 2 of 4  
**Risk Level:** Medium-High  
**Prerequisite:** CR-001 (Phase 1) merged and verified  
**Estimated Effort:** 2–3 days  

---

## Objective

Establish Vite as the development and build tool. Configure it to produce the required single-file `index.html` for production. Update the deploy workflow to build before deploying. Eliminate the fragile `sed`-based VAPID injection in favor of build-time environment variable substitution.

---

## Motivation

Phase 3 (JS modularization) requires a bundler that can resolve ES module imports and produce a single output file. Vite is already a transitive dependency (via Vitest) and is the natural choice. Setting up the build pipeline first means Phase 3 can extract JS modules incrementally without breaking deployment.

---

## Changes Required

### 1. Create Vite Configuration

**New file:** `vite.config.mjs`

**Requirements:**
- Input: `index.html` (with `<link>` to CSS and `<script>` tags from Phase 1)
- Output: `dist/index.html` with all CSS and JS inlined
- VAPID/Gist secrets injected via `define` or `import.meta.env`
- No code splitting (single chunk)
- No asset hashing for `sw.js` (it must keep its exact filename)
- Minification enabled for production builds

**Approximate config:**
```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
      output: {
        // Prevent code splitting — everything in one chunk
        manualChunks: undefined,
      },
    },
    // Inline all CSS into HTML
    cssCodeSplit: false,
    // Inline small assets as base64
    assetsInlineLimit: 100000,
  },
  // VAPID keys injected at build time (replaces sed)
  define: {
    '__VAPID_PUBLIC_KEY__': JSON.stringify(process.env.VAPID_PUBLIC_KEY || ''),
    '__GIST_ID__': JSON.stringify(process.env.GIST_ID || ''),
    '__GIST_TOKEN__': JSON.stringify(process.env.GIST_TOKEN || ''),
  },
});
```

**In `index.html`:** Update the VAPID placeholder constants:
```javascript
// Before (sed-replaced):
const VAPID_PUBLIC_KEY = '';
const GIST_ID = '';
const GIST_TOKEN = '';

// After (build-time replaced):
const VAPID_PUBLIC_KEY = __VAPID_PUBLIC_KEY__;
const GIST_ID = __GIST_ID__;
const GIST_TOKEN = __GIST_TOKEN__;
```

Vite's `define` replaces these identifiers at build time with the JSON-stringified values. In dev mode, they resolve to `''` (empty strings). This eliminates the sed approach entirely.

**Files created:**
- `vite.config.mjs` (new)

**Files changed:**
- `index.html` (update 3 constant declarations)

---

### 2. Handle `sw.js` in the Build

**Problem:** `sw.js` must be deployed as-is at the root (service workers must be at the scope root). Vite would normally ignore it or try to process it.

**Solution:** Configure Vite to copy `sw.js` to `dist/` without processing:

**Option A — Use `public/` directory:**  
Move `sw.js` to `public/sw.js`. Vite copies `public/` contents to `dist/` verbatim. However, this changes the dev-time path for the SW registration in `index.html` (it remains `/sw.js` in both cases, so no actual change needed — Vite serves `public/` at root).

**Option B — Use a Vite plugin to copy:**
```javascript
// In vite.config.mjs
import { copyFileSync } from 'fs';
export default defineConfig({
  plugins: [{
    name: 'copy-sw',
    closeBundle() {
      copyFileSync('sw.js', 'dist/sw.js');
    }
  }],
  // ...
});
```

**Recommended:** Option A (move to `public/`). It's the idiomatic Vite approach and requires no custom plugin.

**Also copy to `dist/`:** `manifest.webmanifest`, `icons/` directory. These go in `public/` as well:
```
public/
├── sw.js
├── manifest.webmanifest
└── icons/
    ├── icon.svg
    ├── icon-maskable.svg
    ├── icon-180.png
    ├── icon-192.png
    └── icon-512.png
```

**Files moved:**
- `sw.js` → `public/sw.js`
- `manifest.webmanifest` → `public/manifest.webmanifest`
- `icons/` → `public/icons/`

**Registration in `index.html` unchanged:**
```javascript
navigator.serviceWorker.register('sw.js')
```
This resolves to `/sw.js` in both dev and production.

---

### 3. Configure Dev Server

**Purpose:** Playwright e2e tests and local development need a dev server.

**Vite provides this automatically:** `npx vite` starts a dev server with hot module replacement. For e2e tests, `npx vite preview` serves the built output.

**For development:** `npx vite` (or `npm run dev`)

**For e2e tests:** Build first, then serve:
```bash
npx vite build && npx vite preview --port 3000
```

---

### 4. Update `package.json` Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint . && node scripts/check-syntax.mjs",
    "fetch-dataset": "node scripts/fetch-dataset.mjs",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

**Changes:**
- `dev` — new script for Vite dev server
- `build` — now runs `vite build` instead of `node scripts/build.mjs`
- `preview` — new script for previewing built output

**Files changed:**
- `package.json`

---

### 5. Update Playwright Configuration

**In `playwright.config.mjs`:** Change the web server command to build and serve:

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite build && npx vite preview --port 3000',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
```

**Why build before serving:** E2e tests must test the production output (inlined CSS/JS), not the dev source. This catches build regressions.

**Alternative for faster local dev:** Use `npx vite --port 3000` for the dev server when running tests locally. But CI should always test the built output.

**Files changed:**
- `playwright.config.mjs`

---

### 6. Update Deploy Workflow

**In `.github/workflows/deploy.yml`:**

**Remove the "Inject VAPID config" step entirely.** Vite now handles this at build time.

**Update the "Build" job:**

```yaml
build:
  needs: lint-and-test
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Setup Pages
      uses: actions/configure-pages@v5

    - name: Build
      env:
        VAPID_PUBLIC_KEY: ${{ secrets.VAPID_PUBLIC_KEY }}
        GIST_ID: ${{ secrets.GIST_ID }}
        GIST_TOKEN: ${{ secrets.GIST_TOKEN }}
      run: npm run build

    - name: Prepare deployment directory
      run: |
        mkdir _site
        cp -r dist/* _site/

    - name: Upload artifact
      uses: actions/upload-pages-artifact@v3
```

**Key changes:**
- Added Node.js setup and `npm ci` to the build job (previously not needed because files were copied raw).
- `npm run build` runs Vite with VAPID env vars — Vite's `define` injects them.
- `_site` is populated from `dist/` (Vite's output) instead of copying raw source files.
- The `sed` injection step is removed entirely.

**Risk mitigation for VAPID injection:**  
After the build, add a verification step:
```yaml
    - name: Verify VAPID injection
      run: |
        grep -q "VAPID_PUBLIC_KEY" dist/index.html || echo "WARNING: VAPID key not found in build output"
        # The key should NOT be empty in production
        if grep -q "__VAPID_PUBLIC_KEY__" dist/index.html; then
          echo "ERROR: VAPID placeholder was not replaced"
          exit 1
        fi
```

**Files changed:**
- `.github/workflows/deploy.yml`

---

### 7. Update Lint-and-Test Job in Deploy Workflow

The e2e test step now needs a build step before running Playwright (since `playwright.config.mjs` changed):

```yaml
lint-and-test:
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Lint
      run: npm run lint

    - name: Run tests
      run: npm test

    - name: Install Playwright browsers
      run: npx playwright install --with-deps chromium

    - name: Run Playwright e2e tests
      run: npx playwright test

    - name: Upload Playwright report
      uses: actions/upload-artifact@v4
      if: ${{ !cancelled() }}
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 7
```

**No structural change needed** — `npx playwright test` invokes the webServer command from `playwright.config.mjs`, which now builds first. The extra build time (~5-10s) is acceptable in CI.

---

### 8. Verify Build Output Meets Constraints

**Constraint from README:** "Single HTML file < 100 KB gzipped"

**Verification step in CI:**
```yaml
    - name: Verify build size
      run: |
        gzip -c dist/index.html | wc -c | awk '{
          if ($1 > 102400) {
            print "ERROR: index.html gzipped is " $1 " bytes (>100KB)"
            exit 1
          } else {
            print "OK: index.html gzipped is " $1 " bytes"
          }
        }'
```

Add this after the build step in the deploy workflow.

---

### 9. Update or Remove `scripts/build.mjs`

**The custom build script is replaced by Vite.** Either:
- Delete `scripts/build.mjs` entirely, or
- Keep it as a wrapper that calls `vite build` for backward compatibility.

**Recommended:** Delete it. The `npm run build` script in `package.json` now points to `vite build`.

**Files removed:**
- `scripts/build.mjs`

---

### 10. Update `scripts/check-syntax.mjs`

**After Vite build:** The built `dist/index.html` contains bundled/minified JS. The syntax check should validate the built output, not the dev source.

**Update the script** to check `dist/index.html` if it exists, otherwise fall back to `index.html`:
```javascript
import { existsSync } from 'fs';
const target = existsSync('dist/index.html') ? 'dist/index.html' : 'index.html';
const html = readFileSync(target, 'utf8');
```

**Alternative:** Remove the script entirely — Vite's build step already validates JS syntax (it won't build if there are parse errors). The script becomes redundant.

**Recommended:** Remove it and update `package.json` lint script:
```json
"lint": "eslint ."
```

**Files changed:**
- `package.json` (remove check-syntax from lint)
- `scripts/check-syntax.mjs` (delete)

---

### 11. Add `.gitignore` Entry for `dist/`

```
dist/
```

The build output should not be committed.

**Files changed:**
- `.gitignore` (create or update)

---

### 12. Update README Development Section

The "Quick Start" and "Development" sections reference `npx serve .`. Update:

```markdown
## Quick Start

```bash
git clone https://github.com/waqtsalat/waqtsalat.git
cd waqtsalat
npm install
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`).

## Development

```bash
npm install          # Install dev dependencies
npm run dev          # Start dev server with HMR
npm run build        # Build for production (dist/)
npm run preview      # Preview production build locally
npm test             # Run unit tests
npm run test:e2e     # Run Playwright e2e tests
```
```

**Files changed:**
- `README.md`

---

## Files Summary

| File | Action | Notes |
|------|--------|-------|
| `vite.config.mjs` | Create | Build configuration with VAPID define |
| `index.html` | Edit | Change VAPID placeholders to `define` identifiers |
| `sw.js` → `public/sw.js` | Move | Served verbatim by Vite |
| `manifest.webmanifest` → `public/manifest.webmanifest` | Move | Served verbatim |
| `icons/` → `public/icons/` | Move | Served verbatim |
| `package.json` | Edit | Update scripts |
| `playwright.config.mjs` | Edit | Use Vite build + preview |
| `.github/workflows/deploy.yml` | Edit | Add build step, remove sed injection |
| `scripts/build.mjs` | Delete | Replaced by Vite |
| `scripts/check-syntax.mjs` | Delete | Redundant with Vite |
| `.gitignore` | Create/Edit | Add `dist/` |
| `README.md` | Edit | Update dev instructions |

---

## High-Risk Areas and Mitigations

### VAPID Injection (HIGH RISK)

**Risk:** If `define` identifiers aren't replaced, push notifications fail silently.

**Mitigation:**
1. CI step verifies no unreplaced `__VAPID_PUBLIC_KEY__` in build output.
2. CI step verifies the actual key value is present (non-empty string).
3. Manual test: deploy to a staging environment, verify push subscription works.

### E2E Test Server Change (MEDIUM-HIGH RISK)

**Risk:** Switching from `npx serve -s .` to `npx vite preview` may change behavior (different MIME types, SPA routing, port handling).

**Mitigation:**
1. Run full Playwright suite locally before merging.
2. Verify all element IDs survive the Vite build (not renamed or removed).
3. The `--port 3000` flag ensures the port matches the test config.

### Service Worker Path Change (MEDIUM RISK)

**Risk:** Moving `sw.js` to `public/sw.js` could change the resolved path in development vs production.

**Mitigation:**
1. Vite serves `public/` contents at root — `sw.js` is accessible at `/sw.js` in both dev and build.
2. The `navigator.serviceWorker.register('sw.js')` call uses a relative path that resolves correctly.
3. Manual test: install the PWA, verify SW registers, verify offline works.

### Minification Changing HTML Structure (LOW-MEDIUM RISK)

**Risk:** Vite might transform HTML attributes, reorder elements, or modify the DOM in ways that break e2e tests checking specific IDs or classes.

**Mitigation:**
1. Vite's HTML minification is conservative — it doesn't remove IDs or classes.
2. Run e2e tests against the built output (the new Playwright config does this).
3. If issues arise, disable HTML minification in Vite config: `build: { minify: false }`.

---

## Testing Checklist

- [ ] `npm run build` succeeds and produces `dist/index.html`
- [ ] `dist/index.html` is < 100 KB gzipped
- [ ] VAPID placeholders are replaced in the build output (with env vars set)
- [ ] VAPID placeholders are empty strings in the build output (without env vars)
- [ ] `npm run lint` passes
- [ ] `npm test` passes (unit tests unaffected)
- [ ] `npm run test:e2e` passes (Playwright against built output)
- [ ] Manual: `npm run dev` serves the app correctly
- [ ] Manual: `npm run preview` serves the built app correctly
- [ ] Manual: SW registers correctly in both dev and preview
- [ ] Manual: app works offline after SW caches assets
- [ ] Manual: push notifications work with VAPID keys (staging deploy)
- [ ] CI: deploy workflow succeeds end-to-end
- [ ] CI: VAPID verification step passes

---

## Rollback Plan

1. Revert the PR.
2. Restore `scripts/build.mjs`.
3. Restore the `sed` injection step in deploy workflow.
4. Move `sw.js`, `manifest.webmanifest`, `icons/` back to root.

The Phase 1 changes (CSS/i18n/cities extraction) remain in place — they're independent of the build tooling.

---

## What This Phase Does NOT Touch

- JavaScript logic — no refactoring
- `src/prayer.mjs`, `src/cities.mjs`, `src/i18n.mjs` — untouched
- Push notification workflow (`.github/workflows/push-notifications.yml`) — untouched
- Unit tests — untouched
- `sw.js` contents — only moved, not modified
