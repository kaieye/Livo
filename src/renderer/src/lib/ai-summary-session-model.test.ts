import { describe, expect, it } from 'vitest'
import type { EntryAISummarySession } from '../../../shared/types'
import { buildAISummarySessionViewState } from './ai-summary-session-model'

function session(
  overrides: Partial<EntryAISummarySession>,
): EntryAISummarySession {
  return {
    id: 'session-1',
    entryId: 'entry-1',
    status: 'queued',
    draftText: '',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('buildAISummarySessionViewState', () => {
  it('restores running draft text as loading summary state', () => {
    expect(
      buildAISummarySessionViewState(
        session({ status: 'running', draftText: '草稿摘要' }),
      ),
    ).toEqual({
      summary: '草稿摘要',
      error: null,
      isLoading: true,
    })
  })

  it('restores failed draft text with error visible', () => {
    expect(
      buildAISummarySessionViewState(
        session({
          status: 'failed',
          draftText: '失败前草稿',
          errorMessage: 'No API key',
        }),
      ),
    ).toEqual({
      summary: '失败前草稿',
      error: 'No API key',
      isLoading: false,
    })
  })

  it('prefers final text for succeeded sessions', () => {
    expect(
      buildAISummarySessionViewState(
        session({
          status: 'succeeded',
          draftText: '草稿',
          finalText: '最终摘要',
        }),
        '旧摘要',
      ),
    ).toEqual({
      summary: '最终摘要',
      error: null,
      isLoading: false,
    })
  })
})
