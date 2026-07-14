import { app, session } from 'electron'
import type { AppUpdateInfo } from '../../../shared/types/index'
import { logWarn } from './logger'
import { __internal } from './update-check-internal'

const RELEASE_API_URL =
  'https://api.github.com/repos/kaieye/Livo/releases/latest'
const RELEASE_ATOM_URL = 'https://github.com/kaieye/Livo/releases.atom'
const RELEASE_ASSETS_URL =
  'https://github.com/kaieye/Livo/releases/expanded_assets'
const RELEASE_DOWNLOAD_ORIGIN = 'https://github.com'
const CHECK_CACHE_MS = 5 * 60 * 1000

let cachedResult: AppUpdateInfo | null = null
let cachedAt = 0

interface GitHubReleasePayload {
  tag_name?: string
  html_url?: string
  published_at?: string
  body?: string
  assets?: GitHubReleaseAssetPayload[]
}

interface GitHubReleaseAssetPayload {
  name?: string
  browser_download_url?: string
  size?: number
}

function buildBaseResult(currentVersion = app.getVersion()): AppUpdateInfo {
  return {
    hasUpdate: false,
    currentVersion,
  }
}

function buildRequestHeaders(
  currentVersion: string,
  accept: string,
): Record<string, string> {
  return {
    Accept: accept,
    'User-Agent': `Livo/${currentVersion}`,
  }
}

function decodeXmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
  }

  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi,
    (entity, code: string) => {
      if (code[0] !== '#') return namedEntities[code.toLowerCase()] || entity

      const isHex = code[1]?.toLowerCase() === 'x'
      const parsed = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : entity
    },
  )
}

function parseLatestReleaseAtom(xml: string): GitHubReleasePayload | null {
  const entry = xml.match(/<entry\b[^>]*>([\s\S]*?)<\/entry>/i)?.[1]
  if (!entry) return null

  const encodedReleaseUrl = entry.match(
    /<link\b[^>]*\bhref="(https:\/\/github\.com\/kaieye\/Livo\/releases\/tag\/[^"]+)"[^>]*\/?\s*>/i,
  )?.[1]
  if (!encodedReleaseUrl) return null

  const releaseUrl = decodeXmlEntities(encodedReleaseUrl)
  let tagName = ''
  try {
    const pathname = new URL(releaseUrl).pathname
    const prefix = '/kaieye/Livo/releases/tag/'
    if (!pathname.startsWith(prefix)) return null
    tagName = decodeURIComponent(pathname.slice(prefix.length))
  } catch {
    return null
  }

  const publishedAt = entry.match(/<updated\b[^>]*>([^<]+)<\/updated>/i)?.[1]
  const encodedNotes = entry.match(
    /<content\b[^>]*\btype="html"[^>]*>([\s\S]*?)<\/content>/i,
  )?.[1]

  return {
    tag_name: tagName,
    html_url: releaseUrl,
    published_at: publishedAt?.trim(),
    body: encodedNotes ? decodeXmlEntities(encodedNotes.trim()) : undefined,
  }
}

function parseReleaseAssetsHtml(html: string): GitHubReleaseAssetPayload[] {
  const assets: GitHubReleaseAssetPayload[] = []
  const seenUrls = new Set<string>()
  const hrefPattern =
    /href="([^"#]*\/kaieye\/Livo\/releases\/download\/[^"#]+)"/gi

  for (const match of html.matchAll(hrefPattern)) {
    try {
      const downloadUrl = new URL(
        decodeXmlEntities(match[1]),
        RELEASE_DOWNLOAD_ORIGIN,
      ).toString()
      if (seenUrls.has(downloadUrl)) continue

      const pathSegments = new URL(downloadUrl).pathname
        .split('/')
        .filter(Boolean)
      const name = decodeURIComponent(
        pathSegments[pathSegments.length - 1] || '',
      )
      if (!name) continue

      seenUrls.add(downloadUrl)
      assets.push({ name, browser_download_url: downloadUrl })
    } catch {
      continue
    }
  }

  return assets
}

function getResponseContentLength(response: Response): number | undefined {
  const raw = response.headers.get('content-length')
  if (!raw) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

async function fetchLatestReleaseFallback(
  currentVersion: string,
): Promise<GitHubReleasePayload | null> {
  const feedResponse = await session.defaultSession.fetch(RELEASE_ATOM_URL, {
    credentials: 'omit',
    headers: buildRequestHeaders(currentVersion, 'application/atom+xml'),
  })
  if (!feedResponse.ok) return null

  const payload = parseLatestReleaseAtom(await feedResponse.text())
  if (!payload?.tag_name) return null

  try {
    const assetsResponse = await session.defaultSession.fetch(
      `${RELEASE_ASSETS_URL}/${encodeURIComponent(payload.tag_name)}`,
      {
        credentials: 'omit',
        headers: buildRequestHeaders(currentVersion, 'text/html'),
      },
    )
    if (!assetsResponse.ok) return payload

    payload.assets = parseReleaseAssetsHtml(await assetsResponse.text())
    const installerAsset = __internal.pickWindowsInstallerAsset(
      payload.assets,
      payload.tag_name,
    )
    if (!installerAsset) return payload

    const installerResponse = await session.defaultSession.fetch(
      installerAsset.downloadUrl,
      {
        method: 'HEAD',
        credentials: 'omit',
        headers: buildRequestHeaders(currentVersion, '*/*'),
      },
    )
    if (installerResponse.ok) {
      const matchedAsset = payload.assets.find(
        (asset) => asset.browser_download_url === installerAsset.downloadUrl,
      )
      if (matchedAsset) {
        matchedAsset.size = getResponseContentLength(installerResponse)
      }
    }
  } catch (error) {
    logWarn('[update-check] failed to read fallback asset metadata', error)
  }

  return payload
}

export async function checkForAppUpdates(
  force = false,
): Promise<AppUpdateInfo> {
  const now = Date.now()
  if (!force && cachedResult && now - cachedAt < CHECK_CACHE_MS) {
    return cachedResult
  }

  const currentVersion = app.getVersion()
  const base = buildBaseResult(currentVersion)

  try {
    const response = await session.defaultSession.fetch(RELEASE_API_URL, {
      // 公共 releases API 无需登录态，避免把默认会话 Cookie 带给 API 域名。
      credentials: 'omit',
      headers: {
        ...buildRequestHeaders(currentVersion, 'application/vnd.github+json'),
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    let payload: GitHubReleasePayload | null = null
    if (response.ok) {
      payload = (await response.json()) as GitHubReleasePayload
    } else {
      // 匿名 GitHub REST API 按出口 IP 限流；共享代理或 VPN 很容易耗尽额度。
      // 403/429 时回退到不消耗 REST API 配额的公开 Atom/发布资源页面。
      const bodyText = await response.text().catch(() => '')
      logWarn('[update-check] non-ok response', {
        status: response.status,
        rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
        rateLimitReset: response.headers.get('x-ratelimit-reset'),
        retryAfter: response.headers.get('retry-after'),
        server: response.headers.get('server'),
        body: bodyText.slice(0, 500),
      })

      if (response.status === 403 || response.status === 429) {
        try {
          payload = await fetchLatestReleaseFallback(currentVersion)
        } catch (error) {
          logWarn('[update-check] release fallback failed', error)
        }
      }
      if (!payload) {
        return {
          ...base,
          error: `HTTP ${response.status}`,
        }
      }
    }

    const latestVersion = __internal.normalizeVersion(payload.tag_name)
    if (!latestVersion) {
      return {
        ...base,
        error: 'missing_release_tag',
      }
    }

    const installerAsset = __internal.pickWindowsInstallerAsset(
      payload.assets,
      latestVersion,
    )
    const result: AppUpdateInfo = {
      hasUpdate: __internal.compareVersions(latestVersion, currentVersion) > 0,
      currentVersion,
      latestVersion,
      releaseUrl: payload.html_url,
      installerAssetName: installerAsset?.name,
      installerDownloadUrl: installerAsset?.downloadUrl,
      installerSize: installerAsset?.size,
      publishedAt: payload.published_at,
      notes: payload.body,
    }

    cachedResult = result
    cachedAt = now
    return result
  } catch (error) {
    logWarn('[update-check] failed to check updates', error)
    const result = {
      ...base,
      error: error instanceof Error ? error.message : String(error),
    }
    cachedResult = result
    cachedAt = now
    return result
  }
}

export function resetUpdateCheckCache(): void {
  cachedAt = 0
  cachedResult = null
}
