import { RecommendedFeed, ResolvedDiscoverCandidate } from './DiscoverTypes'

export function scoreRecommendedFeed(feed: RecommendedFeed, query: string): number {
  const keyword = query.trim().toLowerCase()
  let score = 0
  const title = feed.title.toLowerCase()
  const category = feed.category.toLowerCase()
  const description = feed.description.toLowerCase()
  const site = feed.siteUrl.toLowerCase()

  if (title === keyword) score += 100
  if (title.startsWith(keyword)) score += 60
  if (title.includes(keyword)) score += 40
  if (category.includes(keyword)) score += 20
  if (description.includes(keyword)) score += 10
  if (site.includes(keyword)) score += 8
  return score
}

function scoreResolvedCandidate(candidate: ResolvedDiscoverCandidate, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase()
  const title = candidate.targetTitle.toLowerCase()
  let score = 0

  if (candidate.sourceKind === '官方 RSS') score += 100
  if (candidate.sourceKind === 'RSSHub') score += 70
  if (candidate.sourceKind === 'Nitter') score += 50
  if (candidate.sourceKind === '关键词') score += 35
  if (title === query || title === `@${query}`) score += 50
  if (title.includes(query)) score += 20
  return score
}

export function sortResolvedCandidates(
  candidates: ResolvedDiscoverCandidate[],
  rawQuery: string,
): ResolvedDiscoverCandidate[] {
  return [...candidates].sort((left: ResolvedDiscoverCandidate, right: ResolvedDiscoverCandidate) => {
    return scoreResolvedCandidate(right, rawQuery) - scoreResolvedCandidate(left, rawQuery)
  })
}
