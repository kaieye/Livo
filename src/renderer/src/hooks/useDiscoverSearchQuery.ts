import { useQuery } from "@tanstack/react-query"
import {
  enrichDiscoverSearchResults,
  hasDiscoverSearchQuery,
  type DiscoverSearchPlatform,
} from "../lib/discover-search"
import { queryKeys } from "../lib/query-keys"

export function useDiscoverSearchQuery(query: string, platform: DiscoverSearchPlatform) {
  const normalizedQuery = query.trim()

  return useQuery({
    queryKey: queryKeys.discover.search(normalizedQuery, platform),
    enabled: hasDiscoverSearchQuery(normalizedQuery),
    queryFn: async () => {
      const results = await window.api.discover.search(normalizedQuery, platform)
      return enrichDiscoverSearchResults(results, platform)
    },
    placeholderData: (previousData) => previousData,
  })
}
