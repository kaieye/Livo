import { app, BrowserWindow, ipcMain, shell, nativeTheme, session, protocol } from "electron"
import { join, basename } from "path"
import { existsSync, readFileSync } from "fs"
import { initDatabase, getDatabase } from "./database"
import { registerFeedHandlers } from "./handlers/feed-handlers"
import { registerEntryHandlers } from "./handlers/entry-handlers"
import { registerAIHandlers } from "./handlers/ai-handlers"
import { registerSettingsHandlers, getSettings } from "./handlers/settings-handlers"
import { registerReadabilityHandlers } from "./handlers/readability-handlers"
import { registerDiscoverHandlers } from "./handlers/discover-handlers"
import { registerVideoHandlers } from "./handlers/video-handlers"
import { registerAccountHandlers } from "./handlers/account-handlers"
import { startAutoRefresh } from "./services/feed-refresh"
import { startAggregatorJobs } from "./services/aggregator-jobs"
import { IPC } from "../shared/types"

let mainWindow: BrowserWindow | null = null
const isDev = !app.isPackaged

if (isDev) {
  process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true"
}

function safeOpenExternal(url: string): void {
  try {
    if (!/^https?:\/\//i.test(url)) return
    void shell.openExternal(url).catch(() => {})
  } catch {
    // Ignore invalid external URLs from third-party pages.
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1C1C1E" : "#FFFFFF",
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const referrerUrl = details.referrer?.url || ""
    const fromBilibiliPlayer = /player\.bilibili\.com/i.test(referrerUrl)
    if (fromBilibiliPlayer && /bilibili\.com/i.test(details.url)) {
      return { action: "deny" }
    }
    safeOpenExternal(details.url)
    return { action: "deny" }
  })

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" })
  }

  // Load renderer
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    const filePath = join(__dirname, "../renderer/index.html")
    mainWindow.loadFile(filePath)
  }

  mainWindow.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("Failed to load:", code, desc)
  })
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (sourceId.startsWith("devtools://")) return
    const tag = level >= 2 ? "error" : "log"
    console[tag](`[renderer:${level}] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[window] renderer process gone:", details.reason, details.exitCode)
  })

  mainWindow.webContents.on("unresponsive", () => {
    console.error("[window] renderer became unresponsive")
  })

  mainWindow.webContents.on("did-finish-load", () => {
    const win = mainWindow
    if (!win || win.isDestroyed()) return

    // Startup watchdog:
    // If renderer JS fails early, index.html fallback text stays as "Loading Livo...".
    // Detect this state and force a reload once to recover from transient startup failures.
    setTimeout(() => {
      const current = mainWindow
      if (!current || current.isDestroyed()) return
      void current.webContents
        .executeJavaScript(
          `(() => {
            const root = document.getElementById('root');
            const text = (root?.textContent || '').trim();
            return text.includes('Loading Livo');
          })()`,
          true,
        )
        .then((stillLoading) => {
          if (stillLoading) {
            console.error("[window] startup watchdog: renderer stuck on loading screen, reloading...")
            void current.webContents.reloadIgnoringCache()
          }
        })
        .catch(() => {
          // Ignore watchdog check errors
        })
    }, 8000)
  })
}

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.livo.app")
  }

  // Register custom protocol for local cached images (must be before any window is created)
  protocol.registerFileProtocol("livo-cache", (request, callback) => {
    const fileName = request.url.replace("livo-cache://", "")
    // Security: prevent directory traversal attacks
    if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
      callback({ error: -6 })
      return
    }
    const cacheDir = join(app.getPath("userData"), "cache", "images")
    const filePath = join(cacheDir, fileName)
    if (existsSync(filePath)) {
      callback({ path: filePath })
    } else {
      callback({ error: -6 }) // net::ERR_FILE_NOT_FOUND
    }
  })

  // Initialize database
  await initDatabase()

  // Register IPC handlers
  registerFeedHandlers()
  registerEntryHandlers()
  registerAIHandlers()
  registerSettingsHandlers()
  registerReadabilityHandlers()
  registerDiscoverHandlers()
  registerVideoHandlers()
  registerAccountHandlers()

  // Start auto-refresh AFTER window is created, so mainWindow is available for IPC
  const settings = getSettings()

  // Create window first
  createWindow()

  // Warm and maintain a local aggregator cache for high-risk feeds so the UI
  // can consume recent snapshots instead of relying on live fetches every time.
  startAggregatorJobs()

  // Now start auto-refresh with data maintenance options
  startAutoRefresh(settings.general.refreshInterval, mainWindow, {
    freshnessTTL: settings.data?.freshnessTTL ?? 10,
    concurrency: settings.data?.refreshConcurrency ?? 5,
  })

  // Intercept outgoing headers for media CDNs:
  // 1. Twitter/X: strip Referer so pbs.twimg.com / video.twimg.com don't reject us
  // 2. YouTube: spoof User-Agent to look like regular Chrome (strip "Electron" / app name)
  //    so that youtube-nocookie.com iframe embeds don't trigger bot / login detection
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        "*://*.twimg.com/*",
        "*://pbs.twimg.com/*",
        "*://video.twimg.com/*",
        "*://*.x.com/*",
        "*://*.cdninstagram.com/*",
        "*://*.fbcdn.net/*",
        "*://*.instagram.com/*",
        "*://*.picnob.info/*",
        "*://*.picnob.com/*",
        "*://*.pixnoy.com/*",
        "*://*.piokok.com/*",
        "*://*.pixwox.com/*",
        "*://*.dumpor.com/*",
        "*://media.picnob.info/*",
        "*://media.picnob.com/*",
        "*://media.pixnoy.com/*",
        "*://media.piokok.com/*",
        "*://*.hdslb.com/*",
        "*://*.youtube.com/*",
        "*://*.youtube-nocookie.com/*",
        "*://*.googlevideo.com/*",
        "*://*.ytimg.com/*",
        "*://accounts.google.com/*",
      ],
    },
    (details, callback) => {
      const url = details.url

      // Twitter/X: add proper Referer so pbs.twimg.com / video.twimg.com return images correctly.
      // Without this, Twitter's CDN may reject requests with 403 or return empty responses.
      if (url.includes("twimg.com") || url.includes("x.com")) {
        details.requestHeaders["Referer"] = "https://twitter.com/"
        details.requestHeaders["referer"] = "https://twitter.com/"
      }

      // Instagram/Picnob mirrors: set Instagram Referer to reduce hotlink blocking on avatar/media URLs.
      if (
        /cdninstagram\.com|fbcdn\.net|instagram\.com|picnob\.info|picnob\.com|pixnoy\.com|piokok\.com|pixwox\.com|dumpor\.com/i.test(url) ||
        /https?:\/\/[^/]*scontent[^/]*\./i.test(url)
      ) {
        details.requestHeaders["Referer"] = "https://www.instagram.com/"
        details.requestHeaders["referer"] = "https://www.instagram.com/"
      }

      // Bilibili CDN images (hdslb) may require site Referer to avoid hotlink rejection.
      if (url.includes("hdslb.com")) {
        details.requestHeaders["Referer"] = "https://www.bilibili.com/"
        details.requestHeaders["referer"] = "https://www.bilibili.com/"
      }

      // YouTube / Google: spoof User-Agent to look like vanilla Chrome
      if (
        url.includes("youtube.com") ||
        url.includes("youtube-nocookie.com") ||
        url.includes("googlevideo.com") ||
        url.includes("ytimg.com") ||
        url.includes("accounts.google.com")
      ) {
        const ua = details.requestHeaders["User-Agent"] || ""
        // Remove Electron/X.Y.Z and AppName/X.Y.Z tokens
        details.requestHeaders["User-Agent"] = ua
          .replace(/\s*Electron\/[\d.]+/gi, "")
          .replace(/\s*Livo\/[\d.]+/gi, "")
          .replace(/\s*electron-vite[\w-]*\/[\d.]+/gi, "")
      }

      callback({ requestHeaders: details.requestHeaders })
    },
  )

  // Force cache for remote images/videos so thumbnails and previews don't re-load every time.
  // Many feed/media origins return no-cache headers; rewrite them to allow disk cache reuse.
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["*://*/*"] },
    (details, callback) => {
      const isMediaResource = details.resourceType === "image" || details.resourceType === "media"
      if (!isMediaResource) {
        callback({ responseHeaders: details.responseHeaders })
        return
      }

      const headers = { ...(details.responseHeaders || {}) }
      const statusCode = details.statusCode || 0
      const findHeaderKey = (name: string) =>
        Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
      const setHeader = (name: string, value: string) => {
        const key = findHeaderKey(name) || name
        headers[key] = [value]
      }
      const deleteHeader = (name: string) => {
        const key = findHeaderKey(name)
        if (key) delete headers[key]
      }

      // Do not cache failed media responses; avoid sticky broken thumbnails.
      if (statusCode < 200 || statusCode >= 300) {
        setHeader("Cache-Control", "no-store, max-age=0")
        setHeader("Pragma", "no-cache")
        setHeader("Expires", "0")
        callback({ responseHeaders: headers })
        return
      }

      // Keep image caches longer than video byte ranges (success responses only).
      if (details.resourceType === "image") {
        setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400")
      } else {
        setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600")
      }

      deleteHeader("Pragma")
      // Let Cache-Control govern caching behavior.
      deleteHeader("Expires")

      callback({ responseHeaders: headers })
    },
  )

  // Return app version
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())
  ipcMain.handle(IPC.APP_OPEN_EXTERNAL, (_event, url: string) => {
    safeOpenExternal(url)
    return { success: true }
  })

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  const db = getDatabase()
  if (db) db.close()
  if (process.platform !== "darwin") app.quit()
})
