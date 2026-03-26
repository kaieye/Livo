import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import {
  createRendererSharedConfig,
  createSharedDefines,
} from './scripts/build/vite-shared'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: createSharedDefines(),
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: createSharedDefines(),
  },
  renderer: createRendererSharedConfig(resolve('.')) as any,
})
