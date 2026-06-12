interface GitHubReleaseAssetLike {
  name?: string
  browser_download_url?: string
  size?: number
}

interface InstallerAssetInfo {
  name: string
  downloadUrl: string
  size?: number
}

function normalizeVersion(value: string | undefined): string {
  return (value || '').trim().replace(/^v/i, '')
}

function compareVersions(a: string, b: string): number {
  const left = normalizeVersion(a)
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10) || 0)
  const right = normalizeVersion(b)
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function toInstallerAssetInfo(
  asset: GitHubReleaseAssetLike,
): InstallerAssetInfo | null {
  const name = asset.name?.trim()
  const downloadUrl = asset.browser_download_url?.trim()
  if (!name || !downloadUrl) return null
  if (!/^Livo-Setup-.+\.(exe|zip)$/i.test(name)) return null

  return {
    name,
    downloadUrl,
    size:
      typeof asset.size === 'number' && Number.isFinite(asset.size)
        ? asset.size
        : undefined,
  }
}

function pickWindowsInstallerAsset(
  assets: GitHubReleaseAssetLike[] | undefined,
  version: string | undefined,
): InstallerAssetInfo | null {
  const candidates = (assets || [])
    .map(toInstallerAssetInfo)
    .filter((asset): asset is InstallerAssetInfo => !!asset)

  if (candidates.length === 0) return null

  const normalizedVersion = normalizeVersion(version)
  if (!normalizedVersion) return candidates[0]

  const exactNames = new Set([
    `livo-setup-${normalizedVersion}.exe`,
    `livo-setup-${normalizedVersion}.zip`,
    `livo-setup-v${normalizedVersion}.exe`,
    `livo-setup-v${normalizedVersion}.zip`,
  ])
  const exact = candidates.find((asset) =>
    exactNames.has(asset.name.toLowerCase()),
  )
  if (exact) return exact

  return (
    candidates.find((asset) =>
      asset.name.toLowerCase().includes(normalizedVersion.toLowerCase()),
    ) || candidates[0]
  )
}

export const __internal = {
  normalizeVersion,
  compareVersions,
  pickWindowsInstallerAsset,
}
