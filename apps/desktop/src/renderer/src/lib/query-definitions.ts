import { queryOptions } from '@tanstack/react-query'
import type { AccountProvider } from '../../../shared/types'
import {
  hasDiscoverSearchQueryForPlatform,
  shouldEnrichDiscoverResultsInForeground,
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
    enabled: hasDiscoverSearchQueryForPlatform(normalizedQuery, platform),
    queryFn: async () => {
      const results = await window.api.discover.search(
        normalizedQuery,
        platform,
      )
      if (!shouldEnrichDiscoverResultsInForeground(platform)) {
        return results
      }
      return results
    },
    meta: {
      persist: true,
    },
  })
}
