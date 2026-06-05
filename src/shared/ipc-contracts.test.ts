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
    expect(validateIpcArgs(IPC.TASK_RUN_GET, ['ai-summarize-1'])).toEqual([
      'ai-summarize-1',
    ])
    expect(
      validateIpcArgs(IPC.AI_SUMMARIZE_ENTRY, [
        'entry-1',
        'zh-CN',
        'request-1',
      ]),
    ).toEqual(['entry-1', 'zh-CN', 'request-1'])
    expect(validateIpcArgs(IPC.AI_SUMMARY_SESSION_GET, ['entry-1'])).toEqual([
      'entry-1',
    ])
    expect(
      validateIpcArgs(IPC.AI_TRANSLATION_SESSION_GET, ['entry-1']),
    ).toEqual(['entry-1'])
    expect(
      validateIpcArgs(IPC.AI_TRANSLATION_SESSION_UPDATE, [
        'session-1',
        { status: 'running' },
      ]),
    ).toEqual(['session-1', { status: 'running' }])
    expect(
      validateIpcArgs(IPC.AI_TRANSLATE_ENTRY_SEGMENTS, [
        {
          entryId: 'entry-1',
          paragraphs: ['hello'],
          targetLanguage: 'zh-CN',
        },
      ]),
    ).toEqual([
      {
        entryId: 'entry-1',
        paragraphs: ['hello'],
        targetLanguage: 'zh-CN',
      },
    ])
    expect(
      validateIpcArgs(IPC.TASK_RUN_LIST, [
        { taskName: 'ai.summarize', limit: 10 },
      ]),
    ).toEqual([{ taskName: 'ai.summarize', limit: 10 }])

    expect(() =>
      validateIpcArgs(IPC.ENTRY_MARK_READ, ['entry-1', 'yes']),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.READER_SNAPSHOT, [{ scope: { type: 'feed' } }]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.TASK_RUN_LIST, [{ taskName: 42 }]),
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
