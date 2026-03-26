import type { AccountProvider } from "../../../shared/types"

export interface AccountStatusResult {
  provider: AccountProvider
  linked: boolean
  displayName: string | null
  error?: string
}

export async function fetchAccountStatus(provider: AccountProvider): Promise<AccountStatusResult> {
  if (window.api.accounts) {
    const next = await window.api.accounts.status(provider)
    return {
      provider,
      linked: next.linked,
      displayName: next.displayName ?? null,
      error: next.error,
    }
  }

  if (provider === "youtube") {
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
    error: "当前版本未注入 accounts API，请重启应用后重试",
  }
}
