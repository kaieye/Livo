import { beforeEach, describe, expect, it, vi } from 'vitest'
import { USER_OPERATION_KEYS } from '../../../shared/user-operations'

const logInfo = vi.hoisted(() => vi.fn())
const logError = vi.hoisted(() => vi.fn())

vi.mock('./logger', () => ({ logError, logInfo }))

import { logUserOperation } from './user-operation-log'

describe('logUserOperation', () => {
  beforeEach(() => {
    logInfo.mockReset()
    logError.mockReset()
  })

  it('uses the stable operation key for console-safe lifecycle messages', () => {
    logUserOperation({
      operationKey: USER_OPERATION_KEYS.FEED_REFRESH_SINGLE,
      status: 'queued',
      targetId: 'nitter-feed',
    })

    expect(logInfo).toHaveBeenCalledWith(
      '[user-operation] feed.refresh_single',
      {
        key: 'feed.refresh_single',
        category: 'feed',
        mode: 'async',
        status: 'queued',
        runId: undefined,
        targetId: 'nitter-feed',
        targetLabel: undefined,
        details: undefined,
      },
    )
  })
})
