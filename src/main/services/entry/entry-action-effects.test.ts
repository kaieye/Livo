import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionEffectType } from '../../../shared/actions'
import { FeedViewType, type Entry, type Feed } from '../../../shared/types'
import { ENTRY_ACTION_EFFECT_TASK } from '../system/task-contracts'
import { enqueueEntryActionEffects } from './entry-action-effects'

const enqueueMock = vi.hoisted(() => vi.fn())
const getLocalTaskRunnerMock = vi.hoisted(() => vi.fn())

vi.mock('../system/task-runner-service', () => ({
  getLocalTaskRunner: getLocalTaskRunnerMock,
}))

function makeFeed(): Feed {
  return {
    id: 'feed-1',
    title: 'Feed',
    url: 'https://example.com/feed.xml',
    view: FeedViewType.Articles,
    errorCount: 0,
    createdAt: 1,
  }
}

function makeEntry(): Entry {
  return {
    id: 'entry-1',
    feedId: 'feed-1',
    title: 'Entry',
    url: 'https://example.com/post',
    publishedAt: 1,
    isRead: false,
    isStarred: false,
    createdAt: 1,
  }
}

describe('enqueueEntryActionEffects', () => {
  beforeEach(() => {
    enqueueMock.mockReset()
    getLocalTaskRunnerMock.mockReset()
    enqueueMock.mockReturnValue({
      runId: 'entry.action_effect-1',
      promise: Promise.resolve(),
      getRecord: vi.fn(),
    })
    getLocalTaskRunnerMock.mockReturnValue({ enqueue: enqueueMock })
  })

  it('submits supported effects to Task Runner and filters storage-only effects', () => {
    const entry = makeEntry()
    const feed = makeFeed()
    const effects: ActionEffectType[] = ['star', 'notify', 'summarize']

    enqueueEntryActionEffects([{ entry, feed, effects }])

    expect(enqueueMock).toHaveBeenCalledTimes(1)
    expect(enqueueMock.mock.calls[0][0]).toBe(ENTRY_ACTION_EFFECT_TASK)
    expect(enqueueMock.mock.calls[0][1]).toEqual({
      entry,
      feed,
      effects: ['notify', 'summarize'],
    })
    expect(enqueueMock.mock.calls[0][2]).toEqual(expect.any(Function))
  })

  it('skips jobs without runnable effects', () => {
    enqueueEntryActionEffects([
      { entry: makeEntry(), feed: makeFeed(), effects: ['star', 'mark_read'] },
    ])

    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('uses an order-stable Task Runner dedupe key', () => {
    const entry = makeEntry()
    const feed = makeFeed()
    const left = ENTRY_ACTION_EFFECT_TASK.dedupeKey?.({
      entry,
      feed,
      effects: ['summarize', 'notify'],
    })
    const right = ENTRY_ACTION_EFFECT_TASK.dedupeKey?.({
      entry,
      feed,
      effects: ['notify', 'summarize'],
    })

    expect(left).toBe(right)
  })
})
