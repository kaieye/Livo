import { ipcMain, session } from 'electron'

const LOGIN_PARTITIONS_WITH_PERMISSION_POLICY = ['persist:wechat-mp']

/**
 * 当前正在阅读的文章 URL，由渲染层在切换文章时设置。
 * 用于构建跨域图片请求的 Referer，绕过防盗链。
 */
let currentArticleUrl: string | null = null

export function setCurrentArticleUrl(url: string | null): void {
  currentArticleUrl = url
}

function registerPermissionDenyPolicy(targetSession: Electron.Session): void {
  targetSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false)
    },
  )
  targetSession.setPermissionCheckHandler(() => false)
}

function getImageReferer(imageUrl: string): string | null {
  // 平台特定 Referer（优先级最高）
  if (imageUrl.includes('twimg.com') || imageUrl.includes('x.com')) {
    return 'https://twitter.com/'
  }
  if (
    /cdninstagram\.com|fbcdn\.net|instagram\.com|picnob\.info|picnob\.com|pixnoy\.com|piokok\.com|pixwox\.com|dumpor\.com/i.test(
      imageUrl,
    ) ||
    /https?:\/\/[^/]*scontent[^/]*\./i.test(imageUrl)
  ) {
    return 'https://www.instagram.com/'
  }
  if (imageUrl.includes('hdslb.com')) {
    return 'https://www.bilibili.com/'
  }

  // 使用当前文章 URL 作为 Referer
  if (currentArticleUrl) {
    try {
      return new URL(currentArticleUrl).origin + '/'
    } catch {
      // invalid URL, fall through
    }
  }

  // 没有可用的 Referer
  return null
}

/**
 * Register Chromium session-level network policies:
 * - Set Referer to current article URL for images (bypasses most hotlink protection)
 * - Targeted Referer spoofing for specific platforms (Twitter/X, Instagram, Bilibili)
 * - User-Agent stripping for YouTube (removes Electron/Livo signatures)
 * - Cache-Control hardening for media resources (images → 7d, other media → 1d)
 * - Permission denial for default and login sessions
 */
export function registerSessionPolicies(): void {
  registerPermissionDenyPolicy(session.defaultSession)
  for (const partition of LOGIN_PARTITIONS_WITH_PERMISSION_POLICY) {
    registerPermissionDenyPolicy(session.fromPartition(partition))
  }

  // Listen for article URL updates from renderer
  ipcMain.on('set-current-article-url', (_event, url: string | null) => {
    setCurrentArticleUrl(url)
  })

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*/*'] },
    (details, callback) => {
      if (details.resourceType === 'image') {
        const referer = getImageReferer(details.url)
        if (referer) {
          details.requestHeaders['Referer'] = referer
          details.requestHeaders['referer'] = referer
        } else {
          delete details.requestHeaders['Referer']
          delete details.requestHeaders['referer']
        }
      }

      // YouTube User-Agent stripping (removes Electron/Livo signatures)
      const url = details.url
      if (
        url.includes('youtube.com') ||
        url.includes('youtube-nocookie.com') ||
        url.includes('googlevideo.com') ||
        url.includes('ytimg.com') ||
        url.includes('accounts.google.com')
      ) {
        const ua = details.requestHeaders['User-Agent'] || ''
        details.requestHeaders['User-Agent'] = ua
          .replace(/\s*Electron\/[\d.]+/gi, '')
          .replace(/\s*Livo\/[\d.]+/gi, '')
          .replace(/\s*electron-vite[\w-]*\/[\d.]+/gi, '')
      }

      callback({ requestHeaders: details.requestHeaders })
    },
  )

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['*://*/*'] },
    (details, callback) => {
      const isMediaResource =
        details.resourceType === 'image' || details.resourceType === 'media'
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

      if (statusCode < 200 || statusCode >= 300) {
        setHeader('Cache-Control', 'no-store, max-age=0')
        setHeader('Pragma', 'no-cache')
        setHeader('Expires', '0')
        callback({ responseHeaders: headers })
        return
      }

      if (details.resourceType === 'image') {
        setHeader(
          'Cache-Control',
          'public, max-age=604800, stale-while-revalidate=86400',
        )
      } else {
        setHeader(
          'Cache-Control',
          'public, max-age=86400, stale-while-revalidate=3600',
        )
      }

      deleteHeader('Pragma')
      deleteHeader('Expires')
      callback({ responseHeaders: headers })
    },
  )
}
