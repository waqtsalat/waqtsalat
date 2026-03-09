export default [
  {
    files: ['src/**/*.mjs', 'src/**/*.js', 'public/sw.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        navigator: 'readonly',
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        location: 'readonly',
        history: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Intl: 'readonly',
        Notification: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        Audio: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        AbsoluteOrientationSensor: 'readonly',
        DeviceOrientationEvent: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        matchMedia: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        indexedDB: 'readonly',
        // Service Worker / Push APIs
        TimestampTrigger: 'readonly',
        // Vite build-time defines
        __VAPID_PUBLIC_KEY__: 'readonly',
        __GIST_ID__: 'readonly',
        __GIST_TOKEN__: 'readonly',
        // External libraries (lazy-loaded)
        THREE: 'readonly',
        // Node globals (for scripts)
        process: 'readonly',
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-unexpected-multiline': 'error',
      'valid-typeof': 'error',
      'no-redeclare': 'error',
    }
  }
];
