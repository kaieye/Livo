import { app, session } from 'electron'
import type { AppUpdateInfo } from '../../../shared/types/index'
import { logWarn } from './logger'
import { __internal } from './update-check-internal'

const RELEASE_API_URL =
  'https://api.github.com/repos/kaieye/Livo/releases/latest'
const CHECK_CACHE_MS = 5 * 60 * 1000

let cachedResult: AppUpdateInfo | null = null
let cachedAt = 0

interface GitHubReleasePayload {
  tag_name?: string
  html_url?: string
  published_at?: string
  body?: string
}

function buildBaseResult(currentVersion = app.getVersion()): AppUpdateInfo {
  return {
    hasUpdate: false,
    currentVersion,
  }
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
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `Livo/${currentVersion}`,
      },
    })

    if (!response.ok) {
      return {
        ...base,
        error: `HTTP ${response.status}`,
      }
    }

    const payload = (await response.json()) as GitHubReleasePayload
    const latestVersion = __internal.normalizeVersion(payload.tag_name)
    if (!latestVersion) {
      return {
        ...base,
        error: 'missing_release_tag',
      }
    }

    const result: AppUpdateInfo = {
      hasUpdate: __internal.compareVersions(latestVersion, currentVersion) > 0,
      currentVersion,
      latestVersion,
      releaseUrl: payload.html_url,
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
