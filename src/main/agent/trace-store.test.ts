import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AgentTraceRecord } from '../../shared/types'

const mocks = vi.hoisted(() => ({
  userData: '',
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mocks.userData),
  },
}))

function trace(overrides: Partial<AgentTraceRecord> = {}): AgentTraceRecord {
  return {
    traceId: 'trace-1',
    sessionId: 'session-1',
    startedAt: 1_700_000_000_000,
    completedAt: 1_700_000_001_000,
    promptSummary: 'check token=prompt-secret at https://private.example.com/a',
    finalText: 'done email=user@example.com displayName=Alice',
    status: 'completed',
    toolCalls: [
      {
        id: 'call-1',
        toolName: 'web_search',
        argsPreview: JSON.stringify({
          url: 'https://search.example.com/private?q=secret',
          apiKey: 'tool-secret',
          accountId: 'account-secret',
          query: 'livo agent',
        }),
        status: 'success',
        resultSummary: 'opened https://result.example.com/private/path',
        elapsedMs: 12,
        at: 1_700_000_000_500,
      },
    ],
    ...overrides,
  }
}

async function loadTraceStore() {
  vi.resetModules()
  return import('./trace-store')
}

describe('AgentTraceStore', () => {
  beforeEach(() => {
    mocks.userData = mkdtempSync(join(tmpdir(), 'livo-agent-trace-'))
  })

  afterEach(() => {
    rmSync(mocks.userData, { recursive: true, force: true })
  })

  it('redacts sensitive trace fields before saving', async () => {
    const { AgentTraceStore } = await loadTraceStore()

    AgentTraceStore.save(trace())

    const [saved] = AgentTraceStore.loadAll()
    expect(saved.promptSummary).toBe(
      'check token=*** at https://private.example.com/...',
    )
    expect(saved.finalText).toBe('done email=*** displayName=***')
    expect(saved.toolCalls[0].argsPreview).toContain(
      '"url":"https://search.example.com/..."',
    )
    expect(saved.toolCalls[0].argsPreview).toContain('"apiKey":"***"')
    expect(saved.toolCalls[0].argsPreview).toContain('"accountId":"***"')
    expect(saved.toolCalls[0].argsPreview).not.toContain('tool-secret')
    expect(saved.toolCalls[0].argsPreview).not.toContain('/private')
    expect(saved.toolCalls[0].resultSummary).toBe(
      'opened https://result.example.com/...',
    )
  })

  it('redacts remembered preference content in trace args', async () => {
    const { AgentTraceStore } = await loadTraceStore()

    AgentTraceStore.save(
      trace({
        traceId: 'trace-memory',
        toolCalls: [
          {
            id: 'call-memory',
            toolName: 'remember_preference',
            argsPreview: JSON.stringify({
              topic: '阅读偏好',
              content: '我的私人偏好和账号信息',
            }),
            status: 'success',
            resultSummary: 'saved',
            elapsedMs: 10,
            at: 1_700_000_000_500,
          },
        ],
      }),
    )

    const [saved] = AgentTraceStore.loadAll()
    expect(saved.toolCalls[0].argsPreview).toContain('"topic":"阅读偏好"')
    expect(saved.toolCalls[0].argsPreview).toContain('"content":"***"')
    expect(saved.toolCalls[0].argsPreview).not.toContain('私人偏好')
  })

  it('loads by session, builds a session index, and deletes one trace', async () => {
    const { AgentTraceStore } = await loadTraceStore()

    AgentTraceStore.save(
      trace({ traceId: 'trace-a', sessionId: 'session-a', startedAt: 1 }),
    )
    AgentTraceStore.save(
      trace({ traceId: 'trace-b', sessionId: 'session-b', startedAt: 2 }),
    )
    AgentTraceStore.save(
      trace({ traceId: 'trace-c', sessionId: 'session-a', startedAt: 3 }),
    )

    expect(
      AgentTraceStore.loadBySession('session-a').map((t) => t.traceId),
    ).toEqual(['trace-c', 'trace-a'])
    expect(AgentTraceStore.loadIndex()).toEqual({
      sessions: {
        'session-a': ['trace-c', 'trace-a'],
        'session-b': ['trace-b'],
      },
    })

    expect(AgentTraceStore.delete('trace-b')).toBe(true)
    expect(AgentTraceStore.delete('missing')).toBe(false)
    expect(AgentTraceStore.loadAll().map((t) => t.traceId)).toEqual([
      'trace-c',
      'trace-a',
    ])
  })

  it('keeps only the newest bounded trace window', async () => {
    const { AgentTraceStore } = await loadTraceStore()

    for (let i = 0; i < 55; i += 1) {
      AgentTraceStore.save(
        trace({
          traceId: `trace-${i}`,
          sessionId: `session-${i}`,
          startedAt: i,
        }),
      )
    }

    const traces = AgentTraceStore.loadAll()
    expect(traces).toHaveLength(50)
    expect(traces[0].traceId).toBe('trace-54')
    expect(traces.at(-1)?.traceId).toBe('trace-5')
  })
})
