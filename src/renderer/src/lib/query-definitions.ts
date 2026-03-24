import { queryOptions } from '@tanstack/react-query'
import type { AccountProvider } from '../../../shared/types'
import {
  enrichDiscoverSearchResults,
  hasDiscoverSearchQuery,
  type DiscoverSearchPlatform,
} from './discover-search'
import { fetchAccountStatus } from './account-status'
import { queryKeys } from './query-keys'

export function accountStatusQueryOptions(provider: AccountProvider) {
  return queryOptions({
    queryKey: queryKeys.accounts.status(provider),
    queryFn: () => fetchAccountStatus(provider),
    staleTime: 15_000,
  })
}

export function discoverSearchQueryOptions(
  query: string,
  platform: DiscoverSearchPlatform,
) {
  const normalizedQuery = query.trim()

  return queryOptions({
    queryKey: queryKeys.discover.search(normalizedQuery, platform),
    enabled: hasDiscoverSearchQuery(normalizedQuery),
    queryFn: async () => {
      const results = await window.api.discover.search(
        normalizedQuery,
        platform,
      )
      return enrichDiscoverSearchResults(results, platform)
    },
    placeholderData: (previousData) => previousData,
    meta: {
      persist: true,
    },
  })
}
