import { useQuery } from '@tanstack/react-query'
import type { AccountProvider } from '../../../shared/types'
import { accountStatusQueryOptions } from '../lib/query-definitions'

export function useAccountStatusQuery(provider: AccountProvider) {
  return useQuery(accountStatusQueryOptions(provider))
}
