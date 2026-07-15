import {
  getUserOperationDefinition,
  type UserOperationKey,
} from '../../../shared/user-operations'
import { logError, logInfo } from './logger'

export type UserOperationLogStatus =
  | 'queued'
  | 'started'
  | 'succeeded'
  | 'failed'

export interface UserOperationLogPayload {
  operationKey: UserOperationKey
  status: UserOperationLogStatus
  runId?: string
  targetId?: string
  targetLabel?: string
  details?: Record<string, unknown>
  error?: unknown
}

export function logUserOperation(payload: UserOperationLogPayload): void {
  const operation = getUserOperationDefinition(payload.operationKey)
  const detail = {
    key: operation.key,
    category: operation.category,
    mode: operation.mode,
    status: payload.status,
    runId: payload.runId,
    targetId: payload.targetId,
    targetLabel: payload.targetLabel,
    details: payload.details,
  }
  // Keep console output ASCII-only: Windows dev-console bridges may decode
  // UTF-8 bytes with the active ANSI code page and garble localized labels.
  const message = `[user-operation] ${operation.key}`

  if (payload.status === 'failed') {
    logError(message, { ...detail, error: formatOperationError(payload.error) })
    return
  }
  if (
    payload.status === 'queued' ||
    payload.status === 'started' ||
    payload.status === 'succeeded'
  ) {
    logInfo(message, detail)
    return
  }
}

function formatOperationError(error: unknown): string | undefined {
  if (error === undefined) return undefined
  if (error instanceof Error) return error.message
  return String(error)
}
