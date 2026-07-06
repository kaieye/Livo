import { session } from 'electron'

const LOGIN_PARTITIONS_WITH_PERMISSION_POLICY = ['persist:wechat-mp']

function registerPermissionDenyPolicy(targetSession: Electron.Session): void {
  targetSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false)
    },
  )
  targetSession.setPermissionCheckHandler(() => false)
}

/**
 * Register Chromium session-level network policies:
 * - Referer spoofing for platforms that hotlink-protect media (Twitter/X, Instagram, Bilibili)
 * - User-Agent stripping for YouTube (removes Electron/Livo signatures)
 * - Cache-Control hardening for media resources (images → 7d, other media → 1d)
 * - Permission denial for default and login sessions
 */
export function registerSessionPolicies(): void {
  registerPermissionDenyPolicy(session.defaultSession)
  for (const partition of LOGIN_PARTITIONS_WITH_PERMISSION_POLICY) {
    registerPermissionDenyPolicy(session.fromPartition(partition))
  }

  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        '*://*.twimg.com/*',
        '*://pbs.twimg.com/*',
        '*://video.twimg.com/*',
        '*://*.x.com/*',
        '*://*.cdninstagram.com/*',
        '*://*.fbcdn.net/*',
        '*://*.instagram.com/*',
        '*://*.picnob.info/*',
        '*://*.picnob.com/*',
        '*://*.pixnoy.com/*',
        '*://*.piokok.com/*',
        '*://*.pixwox.com/*',
        '*://*.dumpor.com/*',
        '*://media.picnob.info/*',
        '*://media.picnob.com/*',
        '*://media.pixnoy.com/*',
        '*://media.piokok.com/*',
        '*://*.hdslb.com/*',
        '*://*.youtube.com/*',
        '*://*.youtube-nocookie.com/*',
        '*://*.googlevideo.com/*',
        '*://*.ytimg.com/*',
        '*://accounts.google.com/*',
      ],
    },
    (details, callback) => {
      const url = details.url
      if (url.includes('twimg.com') || url.includes('x.com')) {
        details.requestHeaders['Referer'] = 'https://twitter.com/'
        details.requestHeaders['referer'] = 'https://twitter.com/'
      }

      if (
        /cdninstagram\.com|fbcdn\.net|instagram\.com|picnob\.info|picnob\.com|pixnoy\.com|piokok\.com|pixwox\.com|dumpor\.com/i.test(
          url,
        ) ||
        /https?:\/\/[^/]*scontent[^/]*\./i.test(url)
      ) {
        details.requestHeaders['Referer'] = 'https://www.instagram.com/'
        details.requestHeaders['referer'] = 'https://www.instagram.com/'
      }

      if (url.includes('hdslb.com')) {
        details.requestHeaders['Referer'] = 'https://www.bilibili.com/'
        details.requestHeaders['referer'] = 'https://www.bilibili.com/'
      }

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
