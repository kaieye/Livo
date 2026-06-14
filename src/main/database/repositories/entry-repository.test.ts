import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import type { Entry } from '../../../shared/types'
import { FeedViewType } from '../../../shared/types'
import {
  canOpenSqliteDatabase,
  createInMemoryDatabase,
} from '../test-support/sqlite-test-db'
import { runMigrations } from '../sqlite-schema'
import { EntryRepository } from './entry-repository'
import { FeedRepository } from './feed-repository'

const openDbs: Database.Database[] = []

function createTempDb(): Database.Database {
  const db = createInMemoryDatabase()
  runMigrations(db)
  openDbs.push(db)
  return db
}

function seedFeed(db: Database.Database, id = 'feed-1'): void {
  new FeedRepository(db).insertFeed({
    id,
    title: 'Feed',
    url: `https://example.com/${id}.xml`,
    view: FeedViewType.Articles,
    provider: 'local',
    errorCount: 0,
    createdAt: 1,
  })
}

function entry(input: Partial<Entry>): Entry {
  return {
    id: input.id || 'entry',
    feedId: input.feedId || 'feed-1',
    title: input.title || '',
    url: input.url ?? `https://example.com/${input.id || 'entry'}`,
    content: input.content || '',
    summary: input.summary || '',
    author: input.author,
    imageUrl: input.imageUrl,
    publishedAt: input.publishedAt ?? 1,
    isRead: input.isRead ?? false,
    isStarred: input.isStarred ?? false,
    isListened: input.isListened ?? false,
    media: input.media || [],
    createdAt: input.createdAt ?? 1,
  }
}

afterEach(() => {
  while (openDbs.length > 0) {
    openDbs.pop()!.close()
  }
})

const describeWithDb = canOpenSqliteDatabase() ? describe : describe.skip

describeWithDb('EntryRepository search', () => {
  it('returns no rows for blank queries', () => {
    const db = createTempDb()
    seedFeed(db)
    const entries = new EntryRepository(db)
    entries.insertEntry(entry({ id: 'entry-1', title: 'React' }))

    expect(entries.searchEntries('   ')).toEqual([])
  })

  it('ranks title matches before summary and content matches', () => {
    const db = createTempDb()
    seedFeed(db)
    const entries = new EntryRepository(db)
    entries.insertEntries([
      entry({
        id: 'content',
        title: 'Older content match',
        content: 'React',
        publishedAt: 3000,
      }),
      entry({
        id: 'summary',
        title: 'Summary only',
        summary: 'React',
        publishedAt: 2000,
      }),
      entry({ id: 'title', title: 'React title', publishedAt: 1000 }),
    ])

    expect(
      entries.searchEntries('react', 3).map((result) => result.id),
    ).toEqual(['title', 'summary', 'content'])
  })
})

// Characterization tests: lock in the CURRENT behavior of the write-path
// dedup/merge decision in upsertEntry before refactoring it.
describeWithDb('EntryRepository upsert characterization', () => {
  it('(a) inserts a fresh entry that has no match', () => {
    const db = createTempDb()
    seedFeed(db)
    const entries = new EntryRepository(db)

    const added = entries.insertEntry(
      entry({
        id: 'fresh',
        title: 'Hello world',
        url: 'https://example.com/fresh',
        content: 'body',
      }),
    )

    expect(added).toBe(true)
    const stored = entries.getEntryById('fresh')
    expect(stored?.title).toBe('Hello world')
    expect(stored?.content).toBe('body')
  })

  it('(b) merges into an existing entry that shares the same URL', () => {
    const db = createTempDb()
    seedFeed(db)
    const entries = new EntryRepository(db)
    entries.insertEntry(
      entry({
        id: 'orig',
        title: 'Short',
        url: 'https://example.com/same',
        content: 'short',
        publishedAt: 1000,
      }),
    )

    const added = entries.insertEntry(
      entry({
        id: 'dupe',
        title: 'A much longer title',
        url: 'https://example.com/same',
        content: 'a much longer body of content',
        publishedAt: 2000,
      }),
    )

    // URL match -> merge into existing row, no new row added.
    expect(added).toBe(false)
    expect(entries.getEntryById('dupe')).toBeUndefined()
    const merged = entries.getEntryById('orig')
    expect(merged?.title).toBe('A much longer title')
    expect(merged?.content).toBe('a much longer body of content')
    expect(merged?.publishedAt).toBe(2000)
  })

  it('(c) merges by identity key when the raw URLs differ', () => {
    const db = createTempDb()
    seedFeed(db)
    const entries = new EntryRepository(db)
    // The two URLs are not byte-equal (different tracking params), so the
    // fast url-equality lookup misses, but they canonicalize to the same
    // identity key, so the identity-match branch should merge them.
    entries.insertEntry(
      entry({
        id: 'orig',
        title: 'Same story',
        url: 'https://example.com/story?utm_source=newsletter',
        content: 'first',
        publishedAt: 1000,
      }),
    )

    const added = entries.insertEntry(
      entry({
        id: 'other',
        title: 'Same story',
        url: 'https://example.com/story?utm_source=twitter',
        content: 'a longer richer body',
        publishedAt: 1000,
      }),
    )

    expect(added).toBe(false)
    expect(entries.getEntryById('other')).toBeUndefined()
    const merged = entries.getEntryById('orig')
    expect(merged?.content).toBe('a longer richer body')
  })

  it('(d) merges a broken-scraper entry into a windowed title match', () => {
    const db = createTempDb()
    seedFeed(db)
    const entries = new EntryRepository(db)
    const base = 10 * 24 * 60 * 60 * 1000
    entries.insertEntry(
      entry({
        id: 'good',
        title: 'Sunset photos',
        url: 'https://picnob.com/post/ABCDEF',
        content: 'rich gallery body',
        summary: 'short',
        publishedAt: base,
      }),
    )

    const added = entries.insertEntry(
      entry({
        id: 'broken',
        title: 'Sunset photos',
        url: 'https://instagram.com/p/1234567890123/',
        summary: 'a longer summary text that should win',
        publishedAt: base + 60 * 60 * 1000,
      }),
    )

    // Broken scraper entries never insert a row; they only merge text into the
    // best windowed title match.
    expect(added).toBe(false)
    expect(entries.getEntryById('broken')).toBeUndefined()
    const merged = entries.getEntryById('good')
    expect(merged?.summary).toBe('a longer summary text that should win')
  })

  it('(d2) drops a broken-scraper entry with no window match', () => {
    const db = createTempDb()
    seedFeed(db)
    const entries = new EntryRepository(db)

    const added = entries.insertEntry(
      entry({
        id: 'broken-only',
        title: 'No match here',
        url: 'https://instagram.com/p/9876543210987/',
        publishedAt: 5000,
      }),
    )

    expect(added).toBe(false)
    expect(entries.getEntryById('broken-only')).toBeUndefined()
  })

  it('(e) is a no-op when a URL-matched entry has nothing richer to merge', () => {
    const db = createTempDb()
    seedFeed(db)
    const entries = new EntryRepository(db)
    entries.insertEntry(
      entry({
        id: 'orig',
        title: 'Stable title',
        url: 'https://example.com/stable',
        content: 'full content already',
        summary: 'full summary already',
        publishedAt: 2000,
      }),
    )
    const before = entries.getEntryById('orig')

    const added = entries.insertEntry(
      entry({
        id: 'weaker',
        title: 'Short',
        url: 'https://example.com/stable',
        content: 'tiny',
        summary: 'tiny',
        publishedAt: 1000,
      }),
    )

    expect(added).toBe(false)
    expect(entries.getEntryById('weaker')).toBeUndefined()
    const after = entries.getEntryById('orig')
    expect(after).toEqual(before)
  })
})
