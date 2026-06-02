import { IPC } from '../../shared/types'
import type { ActionRule } from '../../shared/actions'
import { registerChannel } from '../ipc/register-channel'
import { setActionRules } from '../services/action-rules-store'

export function registerActionHandlers(): void {
  registerChannel(IPC.ACTIONS_SYNC, (_event, rules: ActionRule[]) => {
    setActionRules(Array.isArray(rules) ? rules : [])
    return { success: true }
  })
}
