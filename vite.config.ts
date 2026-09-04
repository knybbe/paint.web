import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: process.env.VITE_DISABLE_SW === "true",
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png", "icons/*.svg"],
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2,json}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/paint\.web\/(?!($|index\.html))/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" &&
              (url.pathname === "/paint.web/" ||
                url.pathname === "/paint.web/index.html" ||
                url.pathname === "/" ||
                url.pathname === "/index.html"),
            handler: "NetworkFirst",
            options: {
              cacheName: "paint-web-pages",
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    globals: true,
    setupFiles: ["tests/setup.ts"],
  },
});
