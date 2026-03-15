import { resolve } from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

/**
 * Vite configuration for the Web platform build.
 * Builds the same renderer app but with a browser-compatible API layer.
 */
export default defineConfig({
  root: resolve(__dirname, "src/web"),
  resolve: {
    alias: {
      "@renderer": resolve(__dirname, "src/renderer/src"),
    },
  },
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist-web"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: true,
  },
})
