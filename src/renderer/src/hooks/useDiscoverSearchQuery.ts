import { useQuery } from '@tanstack/react-query'
import type { DiscoverSearchPlatform } from '../lib/discover-search'
import { discoverSearchQueryOptions } from '../lib/query-definitions'

export function useDiscoverSearchQuery(
  query: string,
  platform: DiscoverSearchPlatform,
) {
  return useQuery(discoverSearchQueryOptions(query, platform))
}
