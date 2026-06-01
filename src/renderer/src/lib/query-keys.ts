import type { AccountProvider } from '../../../shared/types'
import type { DiscoverSearchPlatform } from './discover-search'

export const queryKeys = {
  accounts: {
    all: () => ['accounts'] as const,
    status: (provider: AccountProvider) =>
      [...queryKeys.accounts.all(), 'status', provider] as const,
  },
  discover: {
    all: () => ['discover'] as const,
    search: (query: string, platform: DiscoverSearchPlatform) =>
      [...queryKeys.discover.all(), 'search', platform, query.trim()] as const,
  },
}
