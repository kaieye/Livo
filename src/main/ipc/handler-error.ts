import { IpcContractError, type IpcErrorCode } from '../../shared/ipc-contracts'

/**
 * Throw a structured IPC contract error — caught by `register-channel`'s outer
 * `try/catch` and encoded as `ipcFail` so the renderer receives a proper
 * `IpcContractError` with the given code.
 *
 * Use for:
 * - Validation errors that are truly exceptional (renderer must try/catch)
 * - Errors where the caller needs the error code for programmatic handling
 *
 * Do NOT use when the renderer checks `result.success` — those need
 * `{ success: false }` shape.
 */
export function throwIpcError(
  message: string,
  code: IpcErrorCode = 'internal_error',
  fields?: Record<string, string>,
): never {
  throw new IpcContractError(message, code, fields)
}

/**
 * Standardize the catch-all → `{ success: false }` pattern used by IPC handlers.
 *
 * Replaces repetitive:
 * ```
 * catch (error) {
 *   return { success: false, error: String(error) }
 * }
 * ```
 *
 * with:
 * ```
 * catch (error) {
 *   return toHandlerError(error)
 * }
 * ```
 */
export function toHandlerError(
  error: unknown,
  fallbackMessage = '未知错误',
): { success: false; error: string } {
  return {
    success: false,
    error:
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : String(error || fallbackMessage),
  }
}

/**
 * Like `toHandlerError` but merges extra fields the renderer destructures
 * alongside `success` (e.g. `runId`, `isStarred`).
 */
export function toHandlerErrorWith<T extends Record<string, unknown>>(
  error: unknown,
  extra: T,
  fallbackMessage = '未知错误',
): { success: false; error: string } & T {
  return {
    ...toHandlerError(error, fallbackMessage),
    ...extra,
  }
}
