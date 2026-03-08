export default [
  {
    files: ['src/**/*.mjs', 'sw.js', 'scripts/**/*.mjs'],
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
        location: 'readonly',
        history: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Intl: 'readonly',
        Notification: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
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
