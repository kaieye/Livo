import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry } from '../../shared/types'
import { getDb } from '../database'
import { feverWriteBack } from '../services/fever/fever-sync'
import { updateEntryWithWriteBack } from './entry-operations'

vi.mock('../database', () => ({
  getDb: vi.fn(),
}))

vi.mock('../services/fever/fever-sync', () => ({
  feverWriteBack: vi.fn(),
}))

const getDbMock = vi.mocked(getDb)
const feverWriteBackMock = vi.mocked(feverWriteBack)

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    feedId: 'feed-1',
    title: 'Entry',
    url: 'https://example.com/entry',
    content: '',
    summary: '',
    publishedAt: 1,
    isRead: false,
    isStarred: false,
    createdAt: 1,
    ...overrides,
  }
}

function mockEntries(entry: Entry | undefined): {
  updateEntry: ReturnType<typeof vi.fn>
} {
  const updateEntry = vi.fn()
  getDbMock.mockReturnValue({
    entries: {
      getEntryById: vi.fn(() => entry),
      updateEntry,
    },
  } as unknown as ReturnType<typeof getDb>)
  return { updateEntry }
}

describe('updateEntryWithWriteBack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not write or sync missing entries by default', () => {
    const { updateEntry } = mockEntries(undefined)

    const result = updateEntryWithWriteBack('missing', { isRead: true })

    expect(result).toEqual({ entry: null, changed: false })
    expect(updateEntry).not.toHaveBeenCalled()
    expect(feverWriteBackMock).not.toHaveBeenCalled()
  })

  it('does not update or sync unchanged state', () => {
    const { updateEntry } = mockEntries(makeEntry({ isRead: true }))

    const result = updateEntryWithWriteBack('entry-1', { isRead: true })

    expect(result.changed).toBe(false)
    expect(updateEntry).not.toHaveBeenCalled()
    expect(feverWriteBackMock).not.toHaveBeenCalled()
  })

  it('updates and syncs only changed state by default', () => {
    const { updateEntry } = mockEntries(
      makeEntry({ isRead: false, isStarred: false }),
    )

    const result = updateEntryWithWriteBack('entry-1', {
      isRead: true,
      isStarred: false,
    })

    expect(result.changed).toBe(true)
    expect(result.entry).toMatchObject({ isRead: true, isStarred: false })
    expect(updateEntry).toHaveBeenCalledWith('entry-1', { isRead: true })
    expect(feverWriteBackMock).toHaveBeenCalledWith('entry-1', 'read')
    expect(feverWriteBackMock).toHaveBeenCalledTimes(1)
  })
})
