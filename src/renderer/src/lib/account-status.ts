import type { QueryClient } from '@tanstack/react-query'
import type { AccountProvider } from '../../../shared/types'
import { accountStatusQueryOptions } from './query-definitions'

export interface AccountStatusResult {
  provider: AccountProvider
  linked: boolean
  displayName: string | null
  error?: string
}

export async function fetchAccountStatus(
  provider: AccountProvider,
): Promise<AccountStatusResult> {
  if (window.api.accounts) {
    const next = await window.api.accounts.status(provider)
    return {
      provider,
      linked: next.linked,
      displayName: next.displayName ?? null,
      error: next.error,
    }
  }

  if (provider === 'youtube') {
    const yt = await window.api.video.ytStatus()
    return {
      provider,
      linked: yt.loggedIn,
      displayName: yt.name ?? null,
    }
  }

  return {
    provider,
    linked: false,
    displayName: null,
    error: '当前版本未注入 accounts API，请重启应用后重试',
  }
}

// Re-fetches and writes account status into the React Query cache. Used by
// AccountsSettings + useProviderLink so both surfaces converge on a single
// "refresh after action" policy (fail-soft: cache an unlinked fallback so the
// UI doesn't get stuck on stale optimistic state).
export async function refreshAccountStatus(
  provider: AccountProvider,
  queryClient: QueryClient,
): Promise<AccountStatusResult> {
  const queryOptions = accountStatusQueryOptions(provider)
  try {
    const next = await queryClient.fetchQuery(queryOptions)
    queryClient.setQueryData(queryOptions.queryKey, next)
    return next
  } catch {
    const fallback: AccountStatusResult = {
      provider,
      linked: false,
      displayName: null,
      error: undefined,
    }
    queryClient.setQueryData(queryOptions.queryKey, fallback)
    return fallback
  }
}
