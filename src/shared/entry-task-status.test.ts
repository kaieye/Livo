import { describe, expect, it } from 'vitest'
import type { Entry } from './types/entry'
import {
  deriveAISummaryStatus,
  deriveEntryTaskSnapshot,
  deriveFulltextStatus,
} from './entry-task-status'

function makeEntry(partial: Partial<Entry> = {}): Entry {
  return {
    id: partial.id ?? 'entry-1',
    feedId: partial.feedId ?? 'feed-1',
    title: partial.title ?? 'Entry title',
    url: partial.url ?? 'https://example.com/entry',
    content: partial.content,
    summary: partial.summary,
    readabilityContent: partial.readabilityContent,
    readabilityFetchedAt: partial.readabilityFetchedAt,
    readabilityError: partial.readabilityError,
    aiSummary: partial.aiSummary,
    aiSummaryGeneratedAt: partial.aiSummaryGeneratedAt,
    aiSummaryError: partial.aiSummaryError,
    publishedAt: partial.publishedAt ?? 1000,
    isRead: partial.isRead ?? false,
    isStarred: partial.isStarred ?? false,
    createdAt: partial.createdAt ?? 1000,
  }
}

describe('entry task status', () => {
  it('derives fulltext states from readability fields', () => {
    expect(deriveFulltextStatus(makeEntry()).status).toBe('idle')
    expect(
      deriveFulltextStatus(
        makeEntry({
          readabilityContent: '<p>Readable body</p>',
          readabilityFetchedAt: 2000,
        }),
      ),
    ).toEqual({ status: 'succeeded', updatedAt: 2000 })
    expect(
      deriveFulltextStatus(makeEntry({ readabilityError: 'HTTP 403' })),
    ).toEqual({ status: 'failed', error: 'HTTP 403' })
  })

  it('derives AI summary states from summary fields', () => {
    expect(
      deriveAISummaryStatus(
        makeEntry({
          aiSummary: 'Summary',
          aiSummaryGeneratedAt: 3000,
          aiSummaryError: 'old error',
        }),
      ),
    ).toEqual({ status: 'succeeded', updatedAt: 3000 })
    expect(
      deriveAISummaryStatus(makeEntry({ aiSummaryError: 'No API key' })),
    ).toEqual({ status: 'failed', error: 'No API key' })
  })

  it('uses active queued or running tasks when persisted fields are empty', () => {
    expect(
      deriveEntryTaskSnapshot(makeEntry(), {
        activeTasks: {
          fulltext: { status: 'running', updatedAt: 4000 },
          aiSummary: { status: 'queued', updatedAt: 5000 },
          aiTranslate: { status: 'running', updatedAt: 6000 },
        },
      }),
    ).toEqual({
      fulltext: { status: 'running', updatedAt: 4000 },
      aiSummary: { status: 'queued', updatedAt: 5000 },
      aiTranslate: { status: 'running', updatedAt: 6000 },
    })
  })
})
