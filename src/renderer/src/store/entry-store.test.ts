import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry, EntryListResult } from '../../../shared/types'

function makeEntry(partial: Partial<Entry> = {}): Entry {
  return {
    id: partial.id ?? 'entry-1',
    feedId: partial.feedId ?? 'feed-1',
    title: partial.title ?? 'Entry title',
    url: partial.url ?? 'https://example.com/entry-1',
    content: partial.content,
    summary: partial.summary,
    author: partial.author,
    imageUrl: partial.imageUrl,
    media: partial.media,
    publishedAt: partial.publishedAt ?? 1000,
    isRead: partial.isRead ?? true,
    isStarred: partial.isStarred ?? false,
    readProgress: partial.readProgress,
    createdAt: partial.createdAt ?? 1000,
  }
}

async function loadEntryStore(options: {
  listResults: EntryListResult[]
  detailResult: Entry
}) {
  vi.resetModules()

  const listResults = [...options.listResults]
  const api = {
    entries: {
      list: vi.fn(
        async () => listResults.shift() ?? options.listResults.at(-1)!,
      ),
      get: vi.fn(async () => options.detailResult),
      markRead: vi.fn(async () => undefined),
      markAllRead: vi.fn(async () => undefined),
      toggleStar: vi.fn(async () => ({ isStarred: true })),
      saveProgress: vi.fn(async () => undefined),
      search: vi.fn(async () => []),
    },
    feeds: {
      refresh: vi.fn(async () => undefined),
    },
  }

  vi.stubGlobal('window', { api })
  const mod = await import('./entry-store')
  return { useEntryStore: mod.useEntryStore, api }
}

describe('useEntryStore', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps cached detail content while applying newer list snapshot state', async () => {
    const compact = makeEntry({
      content: 'compact body',
      isStarred: false,
    })
    const full = makeEntry({
      content: 'full article body',
      isStarred: false,
    })
    const refreshedCompact = makeEntry({
      content: 'new compact body',
      isStarred: true,
      readProgress: 45,
    })

    const { useEntryStore, api } = await loadEntryStore({
      listResults: [
        { entries: [compact], hasMore: false },
        { entries: [refreshedCompact], hasMore: false },
      ],
      detailResult: full,
    })
    const store = useEntryStore.getState()

    await store.loadEntries({ limit: 10 })
    await useEntryStore.getState().selectEntry(compact)
    expect(useEntryStore.getState().selectedEntry).toMatchObject({
      content: 'full article body',
      isStarred: false,
    })
    expect(api.entries.get).toHaveBeenCalledTimes(1)

    await useEntryStore.getState().selectEntry(null)
    useEntryStore.getState().clearListCache()
    await useEntryStore.getState().loadEntries({ limit: 10 })

    const refreshedListEntry = useEntryStore.getState().entries[0]
    await useEntryStore.getState().selectEntry(refreshedListEntry)

    expect(api.entries.get).toHaveBeenCalledTimes(1)
    expect(useEntryStore.getState().selectedEntry).toMatchObject({
      content: 'full article body',
      isStarred: true,
      readProgress: 45,
    })
  })
})
