import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Plugin to inline non-module <script src="..."> tags into the HTML.
 * Vite only bundles type="module" scripts; this handles legacy global scripts.
 */
function inlineNonModuleScripts() {
  return {
    name: 'inline-non-module-scripts',
    transformIndexHtml(html) {
      return html.replace(
        /<script src="([^"]+)">\s*<\/script>/g,
        (match, src) => {
          try {
            const content = readFileSync(resolve(src), 'utf8');
            return `<script>${content}</script>`;
          } catch {
            // If file not found, leave the tag as-is (Vite will warn)
            return match;
          }
        }
      );
    },
  };
}

/**
 * Plugin to inject VAPID/Gist secrets at build time.
 * Replaces __VAPID_PUBLIC_KEY__, __GIST_ID__, __GIST_TOKEN__ identifiers
 * in inline scripts (which Vite's `define` does not reach).
 */
function injectSecrets() {
  const replacements = {
    '__VAPID_PUBLIC_KEY__': JSON.stringify(process.env.VAPID_PUBLIC_KEY || ''),
    '__GIST_ID__': JSON.stringify(process.env.GIST_ID || ''),
    '__GIST_TOKEN__': JSON.stringify(process.env.GIST_TOKEN || ''),
  };
  return {
    name: 'inject-secrets',
    enforce: 'post',
    transformIndexHtml(html) {
      let result = html;
      for (const [key, value] of Object.entries(replacements)) {
        result = result.replaceAll(key, value);
      }
      return result;
    },
  };
}

export default defineConfig({
  plugins: [inlineNonModuleScripts(), viteSingleFile(), injectSecrets()],
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
