import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry } from '../../shared/types'
import { getDb } from '../database'
import { feverWriteBack } from '../services/fever/fever-sync'
import {
  batchUpdateEntryStateWithWriteBack,
  updateEntryWithWriteBack,
} from './entry-operations'

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

function mockBatchEntries(entries: Entry[]): {
  getEntriesByIds: ReturnType<typeof vi.fn>
  updateEntriesState: ReturnType<typeof vi.fn>
} {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const getEntriesByIds = vi.fn((ids: string[]) => {
    return new Map(
      ids.flatMap((id) => {
        const entry = byId.get(id)
        return entry ? ([[id, entry]] as Array<[string, Entry]>) : []
      }),
    )
  })
  const updateEntriesState = vi.fn()
  getDbMock.mockReturnValue({
    entries: {
      getEntryById: vi.fn((id: string) => byId.get(id)),
      updateEntry: vi.fn(),
      getEntriesByIds,
      updateEntriesState,
    },
  } as unknown as ReturnType<typeof getDb>)
  return { getEntriesByIds, updateEntriesState }
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

describe('batchUpdateEntryStateWithWriteBack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads entries once, writes changed states in one batch, and reports summary', () => {
    const { getEntriesByIds, updateEntriesState } = mockBatchEntries([
      makeEntry({ id: 'entry-1', title: 'One', isRead: false }),
      makeEntry({ id: 'entry-2', title: 'Two', isRead: true }),
      makeEntry({ id: 'entry-3', title: 'Three', isStarred: false }),
    ])

    const result = batchUpdateEntryStateWithWriteBack([
      { entryId: 'entry-1', isRead: true },
      { entryId: 'entry-2', isRead: true },
      { entryId: 'entry-3', isStarred: true },
      { entryId: 'missing', isRead: true },
    ])

    expect(getEntriesByIds).toHaveBeenCalledWith([
      'entry-1',
      'entry-2',
      'entry-3',
      'missing',
    ])
    expect(updateEntriesState).toHaveBeenCalledOnce()
    expect(updateEntriesState).toHaveBeenCalledWith([
      { id: 'entry-1', isRead: true },
      { id: 'entry-3', isStarred: true },
    ])
    expect(result).toMatchObject({
      matchedCount: 3,
      changedCount: 2,
      missingCount: 1,
    })
    expect(feverWriteBackMock).toHaveBeenCalledWith('entry-1', 'read')
    expect(feverWriteBackMock).toHaveBeenCalledWith('entry-3', 'saved')
    expect(feverWriteBackMock).toHaveBeenCalledTimes(2)
  })
})
