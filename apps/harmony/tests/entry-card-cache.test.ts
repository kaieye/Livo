import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EntryCardCache,
  IEntryCardCache,
  FeedLike,
} from '../entry/src/main/ets/common/data/EntryCardCache.ts'

function fakeFeed(id: string, view: number, updatedAt: number): FeedLike {
  return { id, view, updatedAt }
}

function fakeCard(feedId: string, idx: number): object {
  return { id: `${feedId}-entry-${idx}`, feedId, title: `Entry ${idx}` }
}

test('get returns undefined when nothing is cached', () => {
  const cache: IEntryCardCache = new EntryCardCache()
  const feeds = [fakeFeed('a', 0, 1)]
  assert.equal(cache.get('articles', feeds, 3), undefined)
})

test('set and get works for matching signature', () => {
  const cache: IEntryCardCache = new EntryCardCache()
  const feeds = [fakeFeed('a', 0, 1)]
  const entries = [fakeCard('a', 1), fakeCard('a', 2), fakeCard('a', 3)]
  cache.set('articles', feeds, entries)
  const result = cache.get('articles', feeds, 3)
  assert.ok(result)
  assert.equal(result!.length, 3)
  assert.equal((result![0] as Record<string, unknown>).id, 'a-entry-1')
})

test('get returns subset when targetCount is smaller', () => {
  const cache: IEntryCardCache = new EntryCardCache()
  const feeds = [fakeFeed('a', 0, 1)]
  const entries = [fakeCard('a', 1), fakeCard('a', 2), fakeCard('a', 3)]
  cache.set('articles', feeds, entries)
  const result = cache.get('articles', feeds, 2)
  assert.ok(result)
  assert.equal(result!.length, 2)
})

test('get returns undefined when cache has fewer entries than targetCount', () => {
  const cache: IEntryCardCache = new EntryCardCache()
  const feeds = [fakeFeed('a', 0, 1)]
  cache.set('articles', feeds, [fakeCard('a', 1)])
  assert.equal(cache.get('articles', feeds, 5), undefined)
})

test('get returns undefined for different mode', () => {
  const cache: IEntryCardCache = new EntryCardCache()
  const feeds = [fakeFeed('a', 0, 1)]
  cache.set('articles', feeds, [fakeCard('a', 1), fakeCard('a', 2)])
  assert.equal(cache.get('social', feeds, 2), undefined)
})

test('get returns undefined when feed signature changes (different updatedAt)', () => {
  const cache: IEntryCardCache = new EntryCardCache()
  const feedsV1 = [fakeFeed('a', 0, 1)]
  cache.set('articles', feedsV1, [fakeCard('a', 1), fakeCard('a', 2)])
  const feedsV2 = [fakeFeed('a', 0, 999)]
  assert.equal(cache.get('articles', feedsV2, 2), undefined)
})

test('get returns undefined when feed list changes (feed added)', () => {
  const cache: IEntryCardCache = new EntryCardCache()
  const feedsBefore = [fakeFeed('a', 0, 1)]
  cache.set('articles', feedsBefore, [fakeCard('a', 1), fakeCard('a', 2)])
  const feedsAfter = [fakeFeed('a', 0, 1), fakeFeed('b', 0, 2)]
  assert.equal(cache.get('articles', feedsAfter, 2), undefined)
})

test('set does not overwrite with fewer entries', () => {
  const cache: IEntryCardCache = new EntryCardCache()
  const feeds = [fakeFeed('a', 0, 1)]
  const many = [fakeCard('a', 1), fakeCard('a', 2), fakeCard('a', 3)]
  cache.set('articles', feeds, many)
  cache.set('articles', feeds, [fakeCard('a', 1)])
  const result = cache.get('articles', feeds, 3)
  assert.ok(result)
  assert.equal(result!.length, 3)
})

test('clear empties the cache', () => {
  const cache: IEntryCardCache = new EntryCardCache()
  const feeds = [fakeFeed('a', 0, 1)]
  cache.set('articles', feeds, [fakeCard('a', 1), fakeCard('a', 2)])
  cache.clear()
  assert.equal(cache.get('articles', feeds, 2), undefined)
})

test('multiple modes are cached independently', () => {
  const cache: IEntryCardCache = new EntryCardCache()
  const articleFeeds = [fakeFeed('a', 0, 1)]
  const socialFeeds = [fakeFeed('b', 1, 1)]
  cache.set('articles', articleFeeds, [fakeCard('a', 1), fakeCard('a', 2)])
  cache.set('social', socialFeeds, [fakeCard('b', 1), fakeCard('b', 2)])
  assert.ok(cache.get('articles', articleFeeds, 2))
  assert.ok(cache.get('social', socialFeeds, 2))
})

test('clear+set after clear works', () => {
  const cache: IEntryCardCache = new EntryCardCache()
  const feeds = [fakeFeed('a', 0, 1)]
  cache.set('articles', feeds, [fakeCard('a', 1)])
  cache.clear()
  cache.set('articles', feeds, [fakeCard('a', 1), fakeCard('a', 2)])
  assert.ok(cache.get('articles', feeds, 2))
})
