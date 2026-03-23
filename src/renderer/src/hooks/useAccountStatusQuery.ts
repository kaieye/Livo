import { useQuery } from "@tanstack/react-query"
import type { AccountProvider } from "../../../shared/types"
import { fetchAccountStatus } from "../lib/account-status"
import { queryKeys } from "../lib/query-keys"

export function useAccountStatusQuery(provider: AccountProvider) {
  return useQuery({
    queryKey: queryKeys.accounts.status(provider),
    queryFn: () => fetchAccountStatus(provider),
    staleTime: 15_000,
  })
}
