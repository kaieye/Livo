const RSSHUB_ROUTE_PREFIX =
  /^(?:twitter|x|instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox|youtube|bilibili|github|weibo|zhihu|xiaoyuzhou)\//i

function extractRsshubRoute(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  const rsshubMatch = trimmed.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    const route = rsshubMatch[1].replace(/^\/+/, '')
    return route || null
  }

  try {
    const parsed = new URL(trimmed)
    if (!/^https?:$/i.test(parsed.protocol)) return null
    const route = parsed.pathname.replace(/^\/+/, '')
    if (!route || !RSSHUB_ROUTE_PREFIX.test(route)) return null
    const search = parsed.search || ''
    return `${route}${search}`
  } catch {
    return null
  }
}

export function normalizeRsshubProtocolUrl(
  rawUrl: string,
  rsshubInstance: string,
): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return trimmed
  const route = extractRsshubRoute(trimmed)
  if (!route) return trimmed
  const base = rsshubInstance.replace(/\/+$/, '')
  return `${base}/${route}`
}

export function toRsshubProtocolUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return trimmed
  const route = extractRsshubRoute(trimmed)
  if (!route) return trimmed
  return `rsshub://${route}`
}

export function ensureInstagramUserFeedLimit(
  rawUrl: string,
  limit = 100,
): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return trimmed

  const normalizedLimit = Math.max(
    1,
    Number.isFinite(limit) ? Math.floor(limit) : 100,
  )

  const appendLimitToRoute = (routeWithMaybeQuery: string): string => {
    const [path = '', query = ''] = routeWithMaybeQuery.split('?', 2)
    if (!/^instagram\/user\//i.test(path)) {
      return `${path}${query ? `?${query}` : ''}`
    }

    const search = new URLSearchParams(query)
    const current = Number.parseInt(search.get('limit') || '', 10)
    if (!Number.isFinite(current) || current < normalizedLimit) {
      search.set('limit', String(normalizedLimit))
    }
    const nextQuery = search.toString()
    return `${path}${nextQuery ? `?${nextQuery}` : ''}`
  }

  const rsshubMatch = trimmed.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    const route = rsshubMatch[1].replace(/^\/+/, '')
    return `rsshub://${appendLimitToRoute(route)}`
  }

  try {
    const parsed = new URL(trimmed)
    if (!/^https?:$/i.test(parsed.protocol)) return trimmed
    const route = parsed.pathname.replace(/^\/+/, '')
    if (!route || !RSSHUB_ROUTE_PREFIX.test(route)) return trimmed

    const routeWithQuery = `${route}${parsed.search || ''}`
    const nextRoute = appendLimitToRoute(routeWithQuery)
    const [nextPath = route, nextQuery = ''] = nextRoute.split('?', 2)
    parsed.pathname = `/${nextPath}`
    parsed.search = nextQuery ? `?${nextQuery}` : ''
    return parsed.toString()
  } catch {
    return trimmed
  }
}

/**
 * Full feed URL normalization pipeline:
 * toRsshubProtocol → ensureInstagramLimit → ensureTwitterLimit → resolve rsshub://
 */
export function normalizeFeedUrl(
  rawUrl: string,
  rsshubInstance: string,
): string {
  const rsshub = toRsshubProtocolUrl(rawUrl)
  const limited = ensureTwitterUserFeedLimit(
    ensureInstagramUserFeedLimit(rsshub, 100),
    120,
  )
  return normalizeRsshubProtocolUrl(limited, rsshubInstance)
}

/**
 * Like normalizeFeedUrl but without limit injection — used for legacy URL matching.
 */
export function normalizeFeedUrlNoLimits(
  rawUrl: string,
  rsshubInstance: string,
): string {
  const rsshub = toRsshubProtocolUrl(rawUrl)
  return normalizeRsshubProtocolUrl(rsshub, rsshubInstance)
}

export function ensureTwitterUserFeedLimit(
  rawUrl: string,
  limit = 120,
): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return trimmed

  const normalizedLimit = Math.max(
    1,
    Number.isFinite(limit) ? Math.floor(limit) : 120,
  )

  const appendLimitToRoute = (routeWithMaybeQuery: string): string => {
    const [path = '', query = ''] = routeWithMaybeQuery.split('?', 2)
    if (!/^(?:twitter|x)\/user\//i.test(path)) {
      return `${path}${query ? `?${query}` : ''}`
    }

    const normalizedPath = path.replace(
      /^(?:twitter|x)\/user\/([^/?#]+)/i,
      (_m, user: string) => {
        const clean = decodeURIComponent(String(user || ''))
          .replace(/^@/, '')
          .toLowerCase()
        return `twitter/user/${encodeURIComponent(clean)}`
      },
    )

    const search = new URLSearchParams(query)
    const current = Number.parseInt(search.get('limit') || '', 10)
    if (!Number.isFinite(current) || current < normalizedLimit) {
      search.set('limit', String(normalizedLimit))
    }
    const nextQuery = search.toString()
    return `${normalizedPath}${nextQuery ? `?${nextQuery}` : ''}`
  }

  const rsshubMatch = trimmed.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    const route = rsshubMatch[1].replace(/^\/+/, '')
    return `rsshub://${appendLimitToRoute(route)}`
  }

  try {
    const parsed = new URL(trimmed)
    if (!/^https?:$/i.test(parsed.protocol)) return trimmed
    const route = parsed.pathname.replace(/^\/+/, '')
    if (!route || !RSSHUB_ROUTE_PREFIX.test(route)) return trimmed

    const routeWithQuery = `${route}${parsed.search || ''}`
    const nextRoute = appendLimitToRoute(routeWithQuery)
    const [nextPath = route, nextQuery = ''] = nextRoute.split('?', 2)
    parsed.pathname = `/${nextPath}`
    parsed.search = nextQuery ? `?${nextQuery}` : ''
    return parsed.toString()
  } catch {
    return trimmed
  }
}
