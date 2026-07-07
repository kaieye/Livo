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
import { FeedViewType } from './types'

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

  it('validates reading activity sync payloads deeply', () => {
    const validDays = [
      { day: '2026-07-07', count: 1 },
      { day: '2026-07-06', count: 42 },
    ]

    expect(
      validateIpcArgs(IPC.READING_ACTIVITY_SYNC, [
        'device_1783420000000_abcd1234',
        validDays,
      ]),
    ).toEqual(['device_1783420000000_abcd1234', validDays])
    expect(
      validateIpcArgs(IPC.READING_ACTIVITY_SYNC, ['device-1', []]),
    ).toEqual(['device-1', []])

    expect(() =>
      validateIpcArgs(IPC.READING_ACTIVITY_SYNC, ['', validDays]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.READING_ACTIVITY_SYNC, ['bad device', validDays]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.READING_ACTIVITY_SYNC, ['d'.repeat(129), validDays]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.READING_ACTIVITY_SYNC, ['device-1', 'not-days']),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.READING_ACTIVITY_SYNC, [
        'device-1',
        Array.from({ length: 401 }, () => ({
          day: '2026-07-07',
          count: 1,
        })),
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.READING_ACTIVITY_SYNC, [
        'device-1',
        [{ day: '2026-7-7', count: 1 }],
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.READING_ACTIVITY_SYNC, [
        'device-1',
        [{ day: '2026-02-31', count: 1 }],
      ]),
    ).toThrow(IpcValidationError)
    for (const count of [0, -1, 1.5, Number.POSITIVE_INFINITY, 1_000_001]) {
      expect(() =>
        validateIpcArgs(IPC.READING_ACTIVITY_SYNC, [
          'device-1',
          [{ day: '2026-07-07', count }],
        ]),
      ).toThrow(IpcValidationError)
    }
  })

  it('validates settings:set payloads deeply at the IPC boundary', () => {
    expect(
      validateIpcArgs(IPC.SETTINGS_SET, [
        {
          ai: {
            provider: 'custom',
            apiKeys: { custom: 'sk-live' },
          },
          general: { theme: 'dark' },
        },
      ]),
    ).toEqual([
      {
        ai: {
          provider: 'custom',
          apiKeys: { custom: 'sk-live' },
        },
        general: { theme: 'dark' },
      },
    ])

    expect(() =>
      validateIpcArgs(IPC.SETTINGS_SET, [
        { general: { theme: 'dark', unknown: true } },
      ]),
    ).toThrow(IpcValidationError)

    expect(() =>
      validateIpcArgs(IPC.SETTINGS_SET, [
        { agent: { runTimeoutSeconds: '45' } },
      ]),
    ).toThrow(IpcValidationError)

    expect(() =>
      validateIpcArgs(IPC.SETTINGS_SET, [
        JSON.parse('{"ai":{"apiKeys":{"__proto__":"polluted"}}}'),
      ]),
    ).toThrow(IpcValidationError)
  })

  it('allows only bounded editable feed update fields', () => {
    const editablePatch = {
      title: 'New title',
      folder: 'Design',
      category: 'Design',
      view: FeedViewType.Pictures,
      imageUrl: 'https://example.com/avatar.png',
      showInAll: false,
      maxEntries: 100,
    }

    expect(validateIpcArgs(IPC.FEED_UPDATE, ['feed-1', editablePatch])).toEqual(
      ['feed-1', editablePatch],
    )

    for (const blocked of [
      { url: 'https://evil.example/feed.xml' },
      { upstreamUrl: 'https://evil.example/feed.xml' },
      { provider: 'fever' },
      { remoteFeedId: 'remote-1' },
      { fetchSource: 'private-aggregator' },
      { lastFetched: Date.now() },
      { etag: 'etag' },
      { lastModified: 'now' },
      { errorCount: 99 },
      { lastRefreshStatus: 'succeeded' },
      { lastRefreshRawError: 'raw' },
      { createdAt: 1 },
    ]) {
      expect(() =>
        validateIpcArgs(IPC.FEED_UPDATE, ['feed-1', blocked]),
      ).toThrow(IpcValidationError)
    }

    expect(() =>
      validateIpcArgs(IPC.FEED_UPDATE, ['feed-1', { title: 'x'.repeat(513) }]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.FEED_UPDATE, [
        'feed-1',
        { imageUrl: `https://example.com/${'x'.repeat(2048)}` },
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.FEED_UPDATE, ['feed-1', { view: 99 }]),
    ).toThrow(IpcValidationError)
    for (const maxEntries of [0, -1, 1.5, 10_001]) {
      expect(() =>
        validateIpcArgs(IPC.FEED_UPDATE, ['feed-1', { maxEntries }]),
      ).toThrow(IpcValidationError)
    }
  })

  it('bounds entry list pagination options at the IPC boundary', () => {
    const validOptions = {
      feedId: 'feed-1',
      feedIds: ['feed-1', 'feed-2'],
      starred: false,
      unreadOnly: true,
      limit: 1000,
      offset: 100_000,
      compact: true,
      maxContentLength: 10_000,
      skipDedupe: true,
    }

    expect(validateIpcArgs(IPC.ENTRY_LIST, [validOptions])).toEqual([
      validOptions,
    ])

    for (const invalidOptions of [
      { feedId: '' },
      { feedId: 'f'.repeat(129) },
      { feedIds: Array.from({ length: 901 }, (_, index) => `feed-${index}`) },
      { feedIds: ['feed-1', ''] },
      { feedIds: ['f'.repeat(129)] },
      { limit: 0 },
      { limit: 1001 },
      { limit: 1.5 },
      { offset: -1 },
      { offset: 100_001 },
      { offset: 1.5 },
      { maxContentLength: 0 },
      { maxContentLength: 10_001 },
      { maxContentLength: 1.5 },
    ]) {
      expect(() => validateIpcArgs(IPC.ENTRY_LIST, [invalidOptions])).toThrow(
        IpcValidationError,
      )
    }
  })

  it('validates action sync rules deeply and returns sanitized rules', () => {
    const rule = {
      id: 'rule-1',
      name: 'Star AI posts',
      enabled: true,
      conditions: [
        { field: 'entry.title', operator: 'matches_regex', value: '^AI' },
      ],
      actions: [{ type: 'star' }],
      createdAt: 1,
      extra: 'ignored',
    }

    expect(validateIpcArgs(IPC.ACTIONS_SYNC, [[rule]])).toEqual([
      [
        {
          id: 'rule-1',
          name: 'Star AI posts',
          enabled: true,
          conditions: [
            { field: 'entry.title', operator: 'matches_regex', value: '^AI' },
          ],
          actions: [{ type: 'star' }],
          createdAt: 1,
        },
      ],
    ])

    for (const invalidRules of [
      'not-rules',
      Array.from({ length: 101 }, (_, index) => ({
        ...rule,
        id: `rule-${index}`,
      })),
      [{ ...rule, id: '' }],
      [{ ...rule, name: 'x'.repeat(161) }],
      [{ ...rule, enabled: 'yes' }],
      [{ ...rule, conditions: [{ field: 'entry.secret', value: 'token' }] }],
      [
        {
          ...rule,
          conditions: [
            { field: 'entry.title', operator: 'matches_regex', value: '(a+)+' },
          ],
        },
      ],
      [{ ...rule, actions: [{ type: 'exec_shell' }] }],
      [{ ...rule, createdAt: Number.POSITIVE_INFINITY }],
    ]) {
      expect(() => validateIpcArgs(IPC.ACTIONS_SYNC, [invalidRules])).toThrow(
        IpcValidationError,
      )
    }
  })

  it('rejects oversized AI IPC payloads', () => {
    expect(
      validateIpcArgs(IPC.AI_SUMMARIZE, [
        'x'.repeat(200_000),
        'zh-CN',
        'request-1',
      ]),
    ).toEqual(['x'.repeat(200_000), 'zh-CN', 'request-1'])
    expect(
      validateIpcArgs(IPC.AI_TRANSLATE, ['article', 'en-US', 'request-1']),
    ).toEqual(['article', 'en-US', 'request-1'])
    expect(
      validateIpcArgs(IPC.AI_CHAT, [
        [
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'Summarize this.' },
        ],
      ]),
    ).toEqual([
      [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Summarize this.' },
      ],
    ])

    expect(() =>
      validateIpcArgs(IPC.AI_SUMMARIZE, ['x'.repeat(200_001)]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AI_SUMMARIZE, [
        'article',
        'x'.repeat(121),
        'request-1',
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AI_SUMMARIZE, ['article', 'zh-CN', 'x'.repeat(121)]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AI_TRANSLATE, ['x'.repeat(200_001), 'en-US']),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AI_TRANSLATE, ['article', 'x'.repeat(121)]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AI_TRANSLATE, ['article', 'en-US', 'x'.repeat(121)]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AI_CHAT, [
        Array.from({ length: 65 }, () => ({ role: 'user', content: 'x' })),
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AI_CHAT, [
        [{ role: 'x'.repeat(41), content: 'hello' }],
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AI_CHAT, [
        [{ role: 'user', content: 'x'.repeat(20_001) }],
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AI_CHAT, [
        Array.from({ length: 7 }, () => ({
          role: 'user',
          content: 'x'.repeat(20_000),
        })),
      ]),
    ).toThrow(IpcValidationError)
    expect(() =>
      validateIpcArgs(IPC.AI_CHAT_STREAM, [
        [{ role: 'user', content: 'hello' }],
        'x'.repeat(121),
      ]),
    ).toThrow(IpcValidationError)
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
