import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import { IPC } from '../../shared/types'
import {
  getAccountState,
  linkAccount,
  setManualAccountDisplayName,
  unlinkAccount,
} from '../services/account/account-auth'
import { getBilibiliFollowings } from '../services/bilibili/bilibili-followings'

export function registerAccountHandlers(): void {
  // Provider validity is enforced by the IPC contract (assertAccountProvider),
  // so handlers receive an already-validated AccountProvider.
  registerChannel(IPC.ACCOUNT_STATUS, async (_event, provider) =>
    getAccountState(provider),
  )

  registerChannel(IPC.ACCOUNT_LINK, async (_event, provider) =>
    linkAccount(provider),
  )

  registerChannel(IPC.ACCOUNT_UNLINK, async (_event, provider) =>
    unlinkAccount(provider),
  )

  registerChannel(
    IPC.ACCOUNT_SET_DISPLAY_NAME,
    async (_event, provider, displayName) =>
      setManualAccountDisplayName(provider, displayName),
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
