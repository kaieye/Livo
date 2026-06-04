import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import { IPC, type AccountProvider } from '../../shared/types'
import {
  getAccountState,
  linkAccount,
  setManualAccountDisplayName,
  unlinkAccount,
} from '../services/account/account-auth'
import { getBilibiliFollowings } from '../services/bilibili/bilibili-followings'

const SUPPORTED_PROVIDERS: AccountProvider[] = [
  'youtube',
  'x',
  'instagram',
  'bilibili',
]

function isSupportedProvider(value: string): value is AccountProvider {
  return SUPPORTED_PROVIDERS.includes(value as AccountProvider)
}

export function registerAccountHandlers(): void {
  registerChannel(IPC.ACCOUNT_STATUS, async (_event, provider: string) => {
    if (!isSupportedProvider(provider)) {
      return {
        provider,
        linked: false,
        displayName: null,
        error: 'Unsupported provider',
      }
    }
    return getAccountState(provider)
  })

  registerChannel(IPC.ACCOUNT_LINK, async (_event, provider: string) => {
    if (!isSupportedProvider(provider)) {
      return { success: false, error: 'Unsupported provider' }
    }
    return linkAccount(provider)
  })

  registerChannel(IPC.ACCOUNT_UNLINK, async (_event, provider: string) => {
    if (!isSupportedProvider(provider)) {
      return { success: false, error: 'Unsupported provider' }
    }
    return unlinkAccount(provider)
  })

  registerChannel(
    IPC.ACCOUNT_SET_DISPLAY_NAME,
    async (_event, provider: string, displayName: string) => {
      if (!isSupportedProvider(provider)) {
        return { success: false, error: 'Unsupported provider' }
      }
      return setManualAccountDisplayName(provider, displayName)
    },
  )

  registerChannel(IPC.ACCOUNT_BILIBILI_FOLLOWINGS, async () => {
    const state = await getAccountState('bilibili')
    if (!state.linked) {
      return { success: false, error: 'Bilibili account is not linked' }
    }
    try {
      const creators = await getBilibiliFollowings()
      return { success: true, creators }
    } catch (err) {
      return toHandlerError(err)
    }
  })
}
