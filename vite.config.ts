/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Manifest colors mirror the light theme background token (--color-bg) in
// src/styles/tokens.css, as the theme-color metas in index.html do. A manifest cannot read CSS variables.
const LIGHT_BG = "#f4f0e8";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // main.tsx registers the service worker itself, in production builds only.
      injectRegister: false,
      registerType: "autoUpdate",
      strategies: "generateSW",
      // Never run a service worker under Vitest or the dev server.
      disable: process.env.VITEST === "true",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Out of My Head",
        short_name: "OOMH",
        description: "Three-week experiments on a creative practice.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: LIGHT_BG,
        background_color: LIGHT_BG,
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        // Take over at once: the first visit is controlled (offline-ready and
        // able to show the nudge through the worker) without a second load, and
        // an update activates straight away so registerSW can reload onto it.
        skipWaiting: true,
        clientsClaim: true,
        // Fonts come from Google; keep them after the first online visit so offline looks the same.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
