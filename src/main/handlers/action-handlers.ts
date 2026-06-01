import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import type { ActionRule } from '../../shared/actions'
import { setActionRules } from '../services/action-rules-store'

export function registerActionHandlers(): void {
  ipcMain.handle(IPC.ACTIONS_SYNC, (_event, rules: ActionRule[]) => {
    setActionRules(Array.isArray(rules) ? rules : [])
    return { success: true }
  })
}
