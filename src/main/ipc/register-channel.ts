import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  IpcContractError,
  IpcValidationError,
  type IpcArgs,
  type IpcChannel,
  ipcFail,
  ipcOk,
  validateIpcArgs,
} from '../../shared/ipc-contracts'
import { logError, logWarn } from '../services/logger'

type IpcHandler<C extends IpcChannel, R> = (
  event: IpcMainInvokeEvent,
  ...args: IpcArgs<C>
) => R | Promise<R>

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'IPC handler failed'
}

function toIpcError(error: unknown) {
  if (error instanceof IpcContractError) {
    return {
      code: error.code,
      message: error.message,
      fields: error.fields,
    }
  }

  return {
    code: 'internal_error' as const,
    message: errorMessage(error),
  }
}

export function registerChannel<C extends IpcChannel, R>(
  channel: C,
  handler: IpcHandler<C, R>,
): void {
  ipcMain.handle(channel, async (event, ...rawArgs: unknown[]) => {
    try {
      const args = validateIpcArgs(channel, rawArgs)
      const result = await handler(event, ...args)
      return ipcOk(result)
    } catch (error) {
      const payload = toIpcError(error)
      if (error instanceof IpcValidationError) {
        logWarn('[ipc-validation-error]', channel, payload)
      } else {
        logError('[ipc-handler-error]', channel, error)
      }
      return ipcFail(payload)
    }
  })
}
