import { execSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { loadEnv } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vitest/config"
import { assertProductionAuthMode } from "./src/lib/production-auth.ts"

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Cloudflare Pages exposes the commit; locally fall back to git, then "dev".
function buildCommit(): string {
  const fromPages = process.env.CF_PAGES_COMMIT_SHA
  if (fromPages) return fromPages.slice(0, 7)
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: dirname,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
  } catch {
    return "dev"
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, dirname, "")
  assertProductionAuthMode(mode, env.VITE_AUTH_MODE)
  return {
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __BUILD_COMMIT__: JSON.stringify(buildCommit()),
    },
    // F-301 sets CAPACITOR=1 so the native WebView can load relative assets.
    base: env.CAPACITOR === "1" ? "./" : "/",
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["favicon.svg"],
        manifest: {
          name: "iCoParent",
          short_name: "iCoParent",
          description: "A calm, private space for two parents and their children.",
          theme_color: "#fafaf9",
          background_color: "#fafaf9",
          display: "standalone",
          start_url: "/",
          icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
        },
        workbox: {
          navigateFallback: "/index.html",
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(dirname, "./src"),
      },
    },
    server: {
      host: true,
      port: 5173,
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  }
})
