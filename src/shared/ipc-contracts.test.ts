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
    expect(validateIpcArgs(IPC.ACCOUNT_STATUS, ['google'])).toEqual(['google'])
    expect(validateIpcArgs(IPC.AUTH_CHECK_SESSION, [])).toEqual([])
    expect(validateIpcArgs(IPC.AUTH_BIND_GOOGLE, [])).toEqual([])
    expect(validateIpcArgs(IPC.AUTH_BIND_WECHAT, [])).toEqual([])
    expect(validateIpcArgs(IPC.WS_CONNECT, [])).toEqual([])
    expect(validateIpcArgs(IPC.APP_READY_TO_SHOW_MAIN_WINDOW, [])).toEqual([])

    expect(() =>
      validateIpcArgs(IPC.ENTRY_MARK_READ, ['entry-1', 'yes']),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.READER_SNAPSHOT, [{ scope: { type: 'feed' } }]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.TASK_RUN_LIST, [{ taskName: 42 }]),
    ).toThrow(IpcValidationError)
    expect(() => validateIpcArgs(IPC.ACCOUNT_STATUS, ['unknown'])).toThrow(
      IpcValidationError,
    )
    expect(() => validateIpcArgs(IPC.WS_CONNECT, ['user-2'])).toThrow(
      IpcValidationError,
    )
  })

  it('validates agent run and resume payloads deeply', () => {
    const runPayload = {
      requestId: 'agent-run-1',
      prompt: '帮我看一下今天更新',
      history: [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好，有什么需要？' },
      ],
      pageContext: 'home',
    }
    expect(validateIpcArgs(IPC.AGENT_RUN, [runPayload])).toEqual([runPayload])

    const resumePayload = {
      requestId: 'agent-run-2',
      pendingId: 'pending-agent-run-1',
    }
    expect(validateIpcArgs(IPC.AGENT_RESUME, [resumePayload])).toEqual([
      resumePayload,
    ])
    expect(validateIpcArgs(IPC.AGENT_CANCEL_PENDING, ['pending-1'])).toEqual([
      'pending-1',
    ])
    expect(validateIpcArgs(IPC.AGENT_TRACES_LIST, [])).toEqual([])
    expect(
      validateIpcArgs(IPC.AGENT_TRACES_LIST, [
        { sessionId: 'agent-session-1' },
      ]),
    ).toEqual([{ sessionId: 'agent-session-1' }])
    expect(validateIpcArgs(IPC.AGENT_TRACES_DELETE, ['trace-1'])).toEqual([
      'trace-1',
    ])
    expect(validateIpcArgs(IPC.AGENT_MEMORY_LIST, [])).toEqual([])
    expect(validateIpcArgs(IPC.AGENT_MEMORY_CLEAR, [])).toEqual([])

    expect(() =>
      validateIpcArgs(IPC.AGENT_RUN, [{ requestId: 'run-1' }]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AGENT_RUN, [{ requestId: 1, prompt: 'hi' }]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AGENT_RUN, [
        { requestId: 'run-1', prompt: 'hi', history: 123 },
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AGENT_RUN, [
        {
          requestId: 'run-1',
          prompt: 'hi',
          history: [{ role: 'system', content: 'nope' }],
        },
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AGENT_RESUME, [
        { requestId: 'run-1', pendingId: 123 },
      ]),
    ).toThrow(IpcValidationError)
    expect(() => validateIpcArgs(IPC.AGENT_CANCEL_PENDING, [123])).toThrow(
      IpcValidationError,
    )
    expect(() => validateIpcArgs(IPC.AGENT_CANCEL_PENDING, ['  '])).toThrow(
      IpcValidationError,
    )
    expect(() =>
      validateIpcArgs(IPC.AGENT_CANCEL_PENDING, ['x'.repeat(241)]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AGENT_TRACES_LIST, [{ sessionId: 123 }]),
    ).toThrow(IpcValidationError)
    expect(() => validateIpcArgs(IPC.AGENT_TRACES_DELETE, ['  '])).toThrow(
      IpcValidationError,
    )
  })

  it('validates high-privilege app IPC payloads deeply', () => {
    expect(
      validateIpcArgs(IPC.APP_REPORT_ERROR, [
        {
          source: 'renderer',
          message: 'boom',
          stack: 'stack',
          componentStack: 'component',
        },
      ]),
    ).toEqual([
      {
        source: 'renderer',
        message: 'boom',
        stack: 'stack',
        componentStack: 'component',
      },
    ])
    expect(validateIpcArgs(IPC.APP_READ_RECENT_LOGS, [2000])).toEqual([2000])
    expect(
      validateIpcArgs(IPC.APP_SAVE_TEXT_FILE, [
        {
          content: 'hello',
          defaultFileName: 'note.txt',
          title: 'Save note',
          filters: [{ name: 'Text', extensions: ['txt', 'md'] }],
        },
      ]),
    ).toEqual([
      {
        content: 'hello',
        defaultFileName: 'note.txt',
        title: 'Save note',
        filters: [{ name: 'Text', extensions: ['txt', 'md'] }],
      },
    ])
    expect(
      validateIpcArgs(IPC.APP_DOWNLOAD_URL, [
        {
          url: 'https://example.com/file.zip',
          suggestedFileName: 'file.zip',
          filters: [{ name: 'Archives', extensions: ['zip'] }],
        },
      ]),
    ).toEqual([
      {
        url: 'https://example.com/file.zip',
        suggestedFileName: 'file.zip',
        filters: [{ name: 'Archives', extensions: ['zip'] }],
      },
    ])
    expect(
      validateIpcArgs(IPC.MENU_SHOW_CONTEXT, [
        [{ id: 'copy', label: 'Copy', disabled: false }],
      ]),
    ).toEqual([[{ id: 'copy', label: 'Copy', disabled: false }]])
    expect(
      validateIpcArgs(IPC.FEED_REFRESH_IMPORTED, [
        ['feed-1', 'feed-2', 'feed-3'],
      ]),
    ).toEqual([['feed-1', 'feed-2', 'feed-3']])

    expect(() =>
      validateIpcArgs(IPC.APP_REPORT_ERROR, [{ source: '', message: 'boom' }]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.APP_REPORT_ERROR, [
        { source: 'renderer', message: 'x'.repeat(16 * 1024 + 1) },
      ]),
    ).toThrow(IpcValidationError)
    expect(() => validateIpcArgs(IPC.APP_READ_RECENT_LOGS, [0])).toThrow(
      IpcValidationError,
    )
    expect(() => validateIpcArgs(IPC.APP_READ_RECENT_LOGS, [2001])).toThrow(
      IpcValidationError,
    )
    expect(() =>
      validateIpcArgs(IPC.APP_SAVE_TEXT_FILE, [
        { content: 'x', defaultFileName: '   ' },
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.APP_SAVE_TEXT_FILE, [
        {
          content: 'x',
          defaultFileName: 'note.txt',
          filters: [{ name: 'Bad', extensions: ['../sh'] }],
        },
      ]),
    ).toThrow(IpcValidationError)
    expect(() => validateIpcArgs(IPC.APP_DOWNLOAD_URL, [{ url: '' }])).toThrow(
      IpcValidationError,
    )
    expect(() =>
      validateIpcArgs(IPC.MENU_SHOW_CONTEXT, [
        [{ id: 'copy', label: 'x'.repeat(513) }],
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.FEED_REFRESH_IMPORTED, [
        Array.from({ length: 101 }, (_, index) => `feed-${index}`),
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.FEED_REFRESH_IMPORTED, [['feed-1', '']]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.FEED_REFRESH_IMPORTED, [['x'.repeat(129)]]),
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
