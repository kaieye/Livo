import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import {
  createRendererSharedConfig,
  createSharedDefines,
} from '../scripts/build/vite-shared'

const sharedAlias = {
  '@shared': resolve(__dirname, '../src/shared'),
  '@shared/video-url': resolve(__dirname, '../src/shared/video-url.ts'),
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: createSharedDefines(),
    resolve: {
      alias: sharedAlias,
    },
    build: {
      chunkSizeWarningLimit: 800,
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: createSharedDefines(),
    resolve: {
      alias: sharedAlias,
    },
    build: {
      chunkSizeWarningLimit: 300,
    },
  },
  renderer: createRendererSharedConfig(resolve(__dirname, '..')) as any,
})
