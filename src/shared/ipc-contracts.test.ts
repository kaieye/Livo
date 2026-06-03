import { describe, expect, it } from 'vitest'
import {
  IPC,
  IpcContractError,
  IpcValidationError,
  ipcFail,
  ipcOk,
  unwrapIpcEnvelope,
  validateIpcArgs,
} from './ipc-contracts'

describe('ipc-contracts', () => {
  it('validates channel arguments before they reach handlers', () => {
    expect(validateIpcArgs(IPC.ENTRY_MARK_READ, ['entry-1', true])).toEqual([
      'entry-1',
      true,
    ])
    expect(
      validateIpcArgs(IPC.READER_SNAPSHOT, [
        {
          scope: { type: 'feed', feedId: 'feed-1' },
          limit: 20,
          cursor: null,
          unreadOnly: true,
        },
      ]),
    ).toEqual([
      {
        scope: { type: 'feed', feedId: 'feed-1' },
        limit: 20,
        cursor: null,
        unreadOnly: true,
      },
    ])

    expect(() =>
      validateIpcArgs(IPC.ENTRY_MARK_READ, ['entry-1', 'yes']),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.READER_SNAPSHOT, [{ scope: { type: 'feed' } }]),
    ).toThrow(IpcValidationError)
  })

  it('unwraps successful IPC envelopes for existing API callers', () => {
    const data = { success: true, value: 1 }

    expect(unwrapIpcEnvelope(ipcOk(data))).toEqual(data)
    expect(unwrapIpcEnvelope(data)).toEqual(data)
  })

  it('maps failed IPC envelopes to contract errors', () => {
    expect(() =>
      unwrapIpcEnvelope(
        ipcFail({
          code: 'validation_error',
          message: 'Invalid IPC argument',
          fields: { feedId: 'expected_string' },
        }),
      ),
    ).toThrow(IpcContractError)
  })
})
