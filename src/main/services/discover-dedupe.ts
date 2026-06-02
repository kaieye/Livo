export type DiscoverSearchResult = {
  title: string
  url: string
  siteUrl: string
  description: string
  source: 'curated' | 'url' | 'rsshub'
  image?: string
  followers?: string
}

function stripPlatformSuffix(input: string): string {
  return input
    .replace(/\s*-\s*(youtube|bilibili|x|twitter|instagram|rss)\s*$/i, '')
    .trim()
}

function normalizeDiscoverMatchValue(input: string): string {
  return input
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[\s_.\-\/|]+/g, '')
    .trim()
}

export function computeMatchTier(query: string, candidate: string): number {
  const q = normalizeDiscoverMatchValue(query)
  const c = normalizeDiscoverMatchValue(candidate)
  if (!q || !c) return 0
  if (c === q) return 3
  if (c.startsWith(q)) return 2
  if (c.includes(q)) return 1
  return 0
}

function detectResultPlatform(
  url: string,
): 'youtube' | 'bilibili' | 'twitter' | 'instagram' | 'other' {
  try {
    const u = new URL(url)
    const p = u.pathname.toLowerCase()
    if (p.includes('/youtube/')) return 'youtube'
    if (p.includes('/bilibili/')) return 'bilibili'
    if (p.includes('/x/')) return 'twitter'
    if (
      p.includes('/twitter/') ||
      /(x\.com|twitter\.com|nitter)/i.test(u.hostname)
    )
      return 'twitter'
    if (
      p.includes('/instagram/') ||
      p.includes('/picnob') ||
      p.includes('/pixnoy') ||
      p.includes('/piokok') ||
      p.includes('/pixwox')
    )
      return 'instagram'
  } catch {
    // Ignore malformed URL and fallback to "other".
  }
  return 'other'
}

function computeDiscoverResultScore(
  query: string,
  result: DiscoverSearchResult,
): number {
  const title = (result.title || '').trim()
  const titleBase = stripPlatformSuffix(title)
  const description = (result.description || '').trim()
  const sourceBoost =
    result.source === 'curated' ? 30 : result.source === 'rsshub' ? 20 : 10
  const exactTitleBoost = computeMatchTier(query, titleBase)
  const fullTitleBoost = computeMatchTier(query, title)
  const descriptionBoost = computeMatchTier(query, description)
  const urlBoost = computeMatchTier(query, result.url)
  const siteBoost = computeMatchTier(query, result.siteUrl)
  return (
    exactTitleBoost * 1000 +
    fullTitleBoost * 400 +
    descriptionBoost * 180 +
    urlBoost * 140 +
    siteBoost * 100 +
    sourceBoost
  )
}

function computeDiscoverPrimaryTier(
  query: string,
  result: DiscoverSearchResult,
): number {
  const title = (result.title || '').trim()
  const titleBase = stripPlatformSuffix(title)
  return Math.max(
    computeMatchTier(query, titleBase),
    computeMatchTier(query, title),
    computeMatchTier(query, result.description),
    computeMatchTier(query, result.url),
    computeMatchTier(query, result.siteUrl),
  )
}

function extractDiscoverAliasIdentity(
  result: DiscoverSearchResult,
): string | null {
  const platform = detectResultPlatform(result.url)
  if (platform === 'twitter') {
    const matched = result.url.match(/\/(?:x|twitter)\/user\/([^/?#]+)/i)
    const username = matched?.[1]
      ? normalizeDiscoverMatchValue(
          decodeURIComponent(matched[1]).replace(/^@+/, ''),
        )
      : ''
    if (username) return `${platform}:${username}`
  }
  if (platform === 'instagram') {
    const matched = result.url.match(
      /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox)\/user\/([^/?#]+)/i,
    )
    const username = matched?.[1]
      ? normalizeDiscoverMatchValue(
          decodeURIComponent(matched[1]).replace(/^@+/, ''),
        )
      : ''
    if (username) return `${platform}:${username}`
  }
  return null
}

export function buildAliasDedupKey(
  result: DiscoverSearchResult,
): string | null {
  const aliasIdentity = extractDiscoverAliasIdentity(result)
  if (aliasIdentity) return aliasIdentity
  const platform = detectResultPlatform(result.url)
  if (platform === 'other') return null
  const normalizedTitle = normalizeDiscoverMatchValue(
    stripPlatformSuffix(result.title || ''),
  )
  if (!normalizedTitle) return null
  return `${platform}:${normalizedTitle}`
}

export function dedupeAndSortDiscoverResults(
  query: string,
  results: DiscoverSearchResult[],
): DiscoverSearchResult[] {
  const ranked = results
    .map((result) => ({
      result,
      primaryTier: computeDiscoverPrimaryTier(query, result),
      score: computeDiscoverResultScore(query, result),
      aliasTier: computeMatchTier(
        query,
        stripPlatformSuffix(result.title || ''),
      ),
    }))
    .sort((a, b) => {
      if (b.primaryTier !== a.primaryTier) return b.primaryTier - a.primaryTier
      if (b.score !== a.score) return b.score - a.score
      return a.result.title.length - b.result.title.length
    })

  const seenUrl = new Set<string>()
  const dedupedByUrlIndex = new Map<string, number>()
  const seenAlias = new Set<string>()
  const deduped: DiscoverSearchResult[] = []
  for (const item of ranked) {
    const urlKey = item.result.url.trim().toLowerCase()
    if (seenUrl.has(urlKey)) {
      const existingIndex = dedupedByUrlIndex.get(urlKey)
      if (existingIndex !== undefined) {
        const existing = deduped[existingIndex]
        const incoming = item.result
        if (incoming.followers && !existing.followers)
          existing.followers = incoming.followers
        if ((!existing.image || !existing.image.trim()) && incoming.image)
          existing.image = incoming.image
        if (
          (!existing.description ||
            /rsshub x\/twitter user route/i.test(existing.description)) &&
          incoming.description
        ) {
          existing.description = incoming.description
        }
      }
      continue
    }

    const aliasKey = buildAliasDedupKey(item.result)
    const platform = aliasKey?.split(':')[0] || ''
    const shouldForceAliasDedup =
      platform === 'twitter' || platform === 'instagram'
    if (
      aliasKey &&
      ((shouldForceAliasDedup && seenAlias.has(aliasKey)) ||
        (!shouldForceAliasDedup &&
          item.aliasTier >= 3 &&
          seenAlias.has(aliasKey)))
    ) {
      continue
    }

    seenUrl.add(urlKey)
    dedupedByUrlIndex.set(urlKey, deduped.length)
    if (aliasKey && (shouldForceAliasDedup || item.aliasTier >= 3)) {
      seenAlias.add(aliasKey)
    }
    deduped.push(item.result)
  }
  return deduped.slice(0, 500)
}
