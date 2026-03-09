import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build timestamp in Africa/Casablanca timezone
const buildTimestamp = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Casablanca',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date()).replace(',', '');

export default defineConfig({
  define: {
    __VAPID_PUBLIC_KEY__: JSON.stringify(process.env.VAPID_PUBLIC_KEY || ''),
    __GIST_ID__: JSON.stringify(process.env.GIST_ID || ''),
    __GIST_TOKEN__: JSON.stringify(process.env.GIST_TOKEN || ''),
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
  },
  plugins: [viteSingleFile()],
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
});
