import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Project is served from GitHub Pages at https://<user>.github.io/OsickTool/
const base = process.env.VITE_BASE_PATH ?? '/OsickTool/';

export default defineConfig({
  base,
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      manifest: {
        name: 'OsickTool - OSINT Reconnaissance Toolkit',
        short_name: 'OsickTool',
        description:
          'Client-side OSINT toolkit that queries free public sources directly from your browser. Nothing is stored server-side.',
        theme_color: '#2563eb',
        background_color: '#f7f9fc',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only precache the built app shell. We deliberately do NOT add any
        // runtimeCaching rules for OSINT API responses - nothing queried by
        // the user should ever be persisted to a cache, per the project's
        // "no data stored" requirement.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallbackDenylist: [/^\/#/],
      },
    }),
  ],
});
