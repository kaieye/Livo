import { resolve } from "path"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import react from "@vitejs/plugin-react"
import { getBuildTimestamp, getGitCommitHash } from "./scripts/build/metadata.mjs"

const gitCommitHash = getGitCommitHash()
const buildTimestamp = getBuildTimestamp()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __LIVO_BUILD_COMMIT__: JSON.stringify(gitCommitHash),
      __LIVO_BUILD_TIME__: JSON.stringify(buildTimestamp),
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __LIVO_BUILD_COMMIT__: JSON.stringify(gitCommitHash),
      __LIVO_BUILD_TIME__: JSON.stringify(buildTimestamp),
    },
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
      },
    },
    define: {
      __LIVO_BUILD_COMMIT__: JSON.stringify(gitCommitHash),
      __LIVO_BUILD_TIME__: JSON.stringify(buildTimestamp),
    },
    plugins: [react()],
  },
})
