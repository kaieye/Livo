import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AccountProvider } from '../../../../shared/types'
import { refreshAccountStatus } from '../../lib/account-status'

export type ProviderLinkStatus = 'idle' | 'loading' | 'success' | 'error'

export interface ProviderLinkState {
  status: ProviderLinkStatus
  errorDetail: string | null
}

export interface ProviderLinkResult extends ProviderLinkState {
  link: () => Promise<{ success: boolean }>
  reset: () => void
}

// Wraps `window.api.accounts.link(provider)` with a discriminated status enum
// so callers can render success/error UI without parsing locale-specific
// strings. The IPC + the post-link status refresh are the only side effects;
// feedback wording stays in the consumer via i18n.
export function useProviderLink(provider: AccountProvider): ProviderLinkResult {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<ProviderLinkStatus>('idle')
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  const link = useCallback(async () => {
    setStatus('loading')
    setErrorDetail(null)
    try {
      const result = window.api.accounts
        ? await window.api.accounts.link(provider)
        : provider === 'youtube'
          ? await window.api.video.ytLogin()
          : {
              success: false,
              error: '当前版本未注入 accounts API，请重启应用后重试',
            }
      if (result.success) {
        setStatus('success')
        await refreshAccountStatus(provider, queryClient)
        return { success: true }
      }
      setStatus('error')
      setErrorDetail(result.error ?? null)
      return { success: false }
    } catch (err) {
      setStatus('error')
      setErrorDetail(err instanceof Error ? err.message : String(err))
      return { success: false }
    }
  }, [provider, queryClient])

  const reset = useCallback(() => {
    setStatus('idle')
    setErrorDetail(null)
  }, [])

  return { status, errorDetail, link, reset }
}
