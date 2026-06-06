import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntryAITranslationSession } from '../../../shared/types'
import { translateEntrySegments } from './ai-translation'

const getDbMock = vi.hoisted(() => vi.fn())
const settingsProviderGetMock = vi.hoisted(() => vi.fn())
const runAITranslateTaskMock = vi.hoisted(() => vi.fn())

vi.mock('../../database', () => ({
  getDb: getDbMock,
}))

vi.mock('../system/settings-provider', () => ({
  settingsProvider: { get: settingsProviderGetMock },
}))

vi.mock('./ai-pipeline', () => ({
  runAITranslateTask: runAITranslateTaskMock,
}))

function makeSession(
  overrides: Partial<EntryAITranslationSession> = {},
): EntryAITranslationSession {
  return {
    id: 'session-1',
    entryId: 'entry-1',
    targetLanguage: 'zh-CN',
    status: 'running',
    segments: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function mockDb(initialSession: EntryAITranslationSession | null = null) {
  let session = initialSession
  const repo = {
    getLatestSessionByEntryId: vi.fn(() => session),
    createSession: vi.fn((input) => {
      session = makeSession({
        entryId: input.entryId,
        targetLanguage: input.targetLanguage,
        status: input.status,
        segments: input.segments,
        model: input.model,
        configFingerprint: input.configFingerprint,
      })
      return session
    }),
    updateSession: vi.fn((_id, updates) => {
      if (!session) return null
      session = { ...session, ...updates, updatedAt: Date.now() }
      return session
    }),
    getSessionById: vi.fn(() => session),
  }
  getDbMock.mockReturnValue({ aiTranslationSessions: repo })
  return repo
}

describe('translateEntrySegments', () => {
  beforeEach(() => {
    getDbMock.mockReset()
    settingsProviderGetMock.mockReset()
    runAITranslateTaskMock.mockReset()
    settingsProviderGetMock.mockReturnValue({
      ai: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'test-model',
      },
    })
  })

  it('translates runnable paragraphs and persists segment state', async () => {
    const repo = mockDb()
    runAITranslateTaskMock.mockResolvedValue({
      success: true,
      translation: '你好世界',
    })

    const result = await translateEntrySegments({
      entryId: 'entry-1',
      paragraphs: ['hello world', 'x'],
      targetLanguage: 'zh-CN',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.translatedParagraphs).toEqual(['你好世界', ''])
    expect(result.errorMap).toEqual({})
    expect(result.session.status).toBe('succeeded')
    expect(result.session.segments[0]).toMatchObject({
      index: 0,
      translatedText: '你好世界',
      status: 'succeeded',
    })
    expect(result.session.segments[1]).toMatchObject({
      index: 1,
      translatedText: '',
      status: 'skipped',
    })
    expect(runAITranslateTaskMock).toHaveBeenCalledTimes(1)
    expect(repo.createSession).toHaveBeenCalledTimes(1)
  })

  it('retries requested indexes while preserving existing translations', async () => {
    mockDb(
      makeSession({
        segments: [
          {
            index: 0,
            sourceText: 'hello world',
            translatedText: '旧翻译',
            status: 'succeeded',
          },
          {
            index: 1,
            sourceText: 'second paragraph',
            translatedText: '',
            status: 'failed',
            errorMessage: 'old error',
          },
        ],
      }),
    )
    runAITranslateTaskMock.mockResolvedValue({
      success: true,
      translation: '第二段',
    })

    const result = await translateEntrySegments({
      entryId: 'entry-1',
      paragraphs: ['hello world', 'second paragraph'],
      targetLanguage: 'zh-CN',
      indexes: [1],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.translatedParagraphs).toEqual(['旧翻译', '第二段'])
    expect(result.errorMap).toEqual({})
    expect(runAITranslateTaskMock).toHaveBeenCalledTimes(1)
    expect(runAITranslateTaskMock).toHaveBeenCalledWith({
      content: 'second paragraph',
      targetLanguage: 'zh-CN',
    })
  })

  it('marks the session config_changed when settings change during translation', async () => {
    mockDb()
    settingsProviderGetMock
      .mockReturnValueOnce({
        ai: {
          provider: 'openai',
          apiKey: 'key-a',
          model: 'test-model',
        },
      })
      .mockReturnValueOnce({
        ai: {
          provider: 'openai',
          apiKey: 'key-a',
          model: 'test-model',
        },
      })
      .mockReturnValue({
        ai: {
          provider: 'openai',
          apiKey: 'key-b',
          model: 'test-model',
        },
      })

    const result = await translateEntrySegments({
      entryId: 'entry-1',
      paragraphs: ['hello world'],
      targetLanguage: 'zh-CN',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.session).toMatchObject({
      status: 'config_changed',
      errorCode: 'config_changed',
      errorMessage: 'AI 配置已变更，翻译已中止',
    })
    expect(result.errorMap).toEqual({
      0: 'AI 配置已变更，翻译已中止',
    })
    expect(result.session.segments[0]).toMatchObject({
      index: 0,
      status: 'failed',
      errorMessage: 'AI 配置已变更，翻译已中止',
    })
    expect(runAITranslateTaskMock).not.toHaveBeenCalled()
  })
})
