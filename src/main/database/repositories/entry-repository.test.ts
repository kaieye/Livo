import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Entry } from '../../../shared/types'
import { FeedViewType } from '../../../shared/types'
import { runMigrations } from '../sqlite-schema'
import { EntryRepository } from './entry-repository'
import { FeedRepository } from './feed-repository'

const tempDirs: string[] = []

function createTempDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'livo-entry-repository-'))
  tempDirs.push(dir)
  const db = new BetterSqlite3(join(dir, 'test.sqlite'))
  runMigrations(db)
  return db
}

function canCreateSqliteDb(): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'livo-entry-repository-preflight-'))
  try {
    const db = new BetterSqlite3(join(dir, 'test.sqlite'))
    db.close()
    return true
  } catch {
    return false
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function entry(input: Partial<Entry>): Entry {
  return {
    id: input.id || 'entry',
    feedId: input.feedId || 'feed-1',
    title: input.title || '',
    url: input.url || `https://example.com/${input.id || 'entry'}`,
    content: input.content || '',
    summary: input.summary || '',
    publishedAt: input.publishedAt ?? 1,
    isRead: input.isRead ?? false,
    isStarred: input.isStarred ?? false,
    isListened: input.isListened ?? false,
    media: input.media || [],
    createdAt: input.createdAt ?? 1,
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

const describeEntryRepository = canCreateSqliteDb() ? describe : describe.skip

describeEntryRepository('EntryRepository search', () => {
  it('returns no rows for blank queries', () => {
    const db = createTempDb()
    try {
      const feeds = new FeedRepository(db)
      const entries = new EntryRepository(db)
      feeds.insertFeed({
        id: 'feed-1',
        title: 'Feed',
        url: 'https://example.com/rss.xml',
        view: FeedViewType.Articles,
        provider: 'local',
        errorCount: 0,
        createdAt: 1,
      })
      entries.insertEntry(entry({ id: 'entry-1', title: 'React' }))

      expect(entries.searchEntries('   ')).toEqual([])
    } finally {
      db.close()
    }
  })

  it('ranks title matches before summary and content matches', () => {
    const db = createTempDb()
    try {
      const feeds = new FeedRepository(db)
      const entries = new EntryRepository(db)
      feeds.insertFeed({
        id: 'feed-1',
        title: 'Feed',
        url: 'https://example.com/rss.xml',
        view: FeedViewType.Articles,
        provider: 'local',
        errorCount: 0,
        createdAt: 1,
      })
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
        entry({
          id: 'title',
          title: 'React title',
          publishedAt: 1000,
        }),
      ])

      expect(
        entries.searchEntries('react', 3).map((result) => result.id),
      ).toEqual(['title', 'summary', 'content'])
    } finally {
      db.close()
    }
  })
})
