import { resolve } from 'path'
import { defineConfig } from 'vite'
import {
  createRendererSharedConfig,
  createWebIndexHtmlPlugin,
} from '../scripts/build/vite-shared'

/**
 * Vite configuration for the Web platform build.
 * Builds the same renderer app but with a browser-compatible API layer.
 */
const sharedRendererConfig = createRendererSharedConfig(
  resolve(__dirname, '..'),
)

export default defineConfig({
  root: resolve(__dirname, '../src/web'),
  ...sharedRendererConfig,
  plugins: [
    ...(sharedRendererConfig.plugins ?? []),
    createWebIndexHtmlPlugin({
      title: 'Livo - Web',
      description:
        'Livo web app for reading RSS feeds with AI features and local-first data.',
    }),
  ],
  build: {
    ...sharedRendererConfig.build,
    outDir: resolve(__dirname, '../dist-web'),
    emptyOutDir: true,
  },
  server: {
    ...sharedRendererConfig.server,
    port: 5433,
    open: true,
  },
})
