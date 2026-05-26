import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deduplicateEntryCards,
  allowedFeedsForMode,
  groupModeCardsByFeed,
  roundRobinFeedCards,
  FeedLike,
} from '../entry/src/main/ets/common/data/HomeEntryBalancer.ts'

interface TestCard {
  id: string
  feedId: string
  publishedAt: number
}

const keyOf = (card: TestCard) => card.id

// ---- deduplicateEntryCards ----

test('deduplicateEntryCards: removes duplicates by key', () => {
  const cards: TestCard[] = [
    { id: 'a', feedId: 'f1', publishedAt: 1 },
    { id: 'b', feedId: 'f1', publishedAt: 2 },
    { id: 'a', feedId: 'f1', publishedAt: 1 },
  ]
  const result = deduplicateEntryCards(cards, keyOf)
  assert.equal(result.length, 2)
  assert.deepEqual(
    result.map((c) => c.id),
    ['a', 'b'],
  )
})

test('deduplicateEntryCards: handles empty input', () => {
  const result = deduplicateEntryCards([], keyOf)
  assert.equal(result.length, 0)
})

test('deduplicateEntryCards: preserves order of first occurrence', () => {
  const cards: TestCard[] = [
    { id: 'b', feedId: 'f1', publishedAt: 1 },
    { id: 'a', feedId: 'f1', publishedAt: 2 },
    { id: 'b', feedId: 'f1', publishedAt: 3 },
  ]
  const result = deduplicateEntryCards(cards, keyOf)
  assert.deepEqual(
    result.map((c) => c.id),
    ['b', 'a'],
  )
})

// ---- allowedFeedsForMode ----

test('allowedFeedsForMode: filters feeds by view mode', () => {
  const feeds: FeedLike[] = [
    { id: 'a', view: 0 }, // articles
    { id: 'b', view: 1 }, // social
    { id: 'c', view: 0 }, // articles
  ]
  const result = allowedFeedsForMode(feeds, 'articles')
  assert.equal(result.length, 2)
  assert.deepEqual(
    result.map((f) => f.id),
    ['a', 'c'],
  )
})

test('allowedFeedsForMode: returns empty for no matching feeds', () => {
  const feeds: FeedLike[] = [{ id: 'a', view: 1 }]
  assert.equal(allowedFeedsForMode(feeds, 'articles').length, 0)
})

test('allowedFeedsForMode: handles empty feed list', () => {
  assert.equal(allowedFeedsForMode([], 'articles').length, 0)
})

// ---- groupModeCardsByFeed ----

test('groupModeCardsByFeed: groups cards by feedId', () => {
  const feeds: FeedLike[] = [
    { id: 'f1', view: 0 },
    { id: 'f2', view: 0 },
  ]
  const cards: TestCard[] = [
    { id: 'a', feedId: 'f1', publishedAt: 1 },
    { id: 'b', feedId: 'f2', publishedAt: 2 },
    { id: 'c', feedId: 'f1', publishedAt: 3 },
  ]
  const buckets = groupModeCardsByFeed(cards, feeds)
  assert.equal(buckets.size, 2)
  assert.equal(buckets.get('f1')!.length, 2)
  assert.equal(buckets.get('f2')!.length, 1)
})

test('groupModeCardsByFeed: ignores cards from non-allowed feeds', () => {
  const feeds: FeedLike[] = [{ id: 'f1', view: 0 }]
  const cards: TestCard[] = [
    { id: 'a', feedId: 'f1', publishedAt: 1 },
    { id: 'b', feedId: 'f2', publishedAt: 2 },
  ]
  const buckets = groupModeCardsByFeed(cards, feeds)
  assert.equal(buckets.get('f1')!.length, 1)
  assert.equal(buckets.get('f2'), undefined)
})

test('groupModeCardsByFeed: handles empty cards', () => {
  const feeds: FeedLike[] = [{ id: 'f1', view: 0 }]
  const buckets = groupModeCardsByFeed([], feeds)
  assert.equal(buckets.get('f1')!.length, 0)
})

// ---- roundRobinFeedCards ----

test('roundRobinFeedCards: alternates between feeds', () => {
  const feeds = ['f1', 'f2']
  const buckets = new Map<string, TestCard[]>([
    [
      'f1',
      [
        { id: 'f1-a', feedId: 'f1', publishedAt: 100 },
        { id: 'f1-b', feedId: 'f1', publishedAt: 200 },
      ],
    ],
    ['f2', [{ id: 'f2-a', feedId: 'f2', publishedAt: 150 }]],
  ])
  const result = roundRobinFeedCards(buckets, feeds, 3, keyOf)
  assert.equal(result.length, 3)
  // f1-a, f2-a, f1-b (round-robin order)
  assert.equal(result[0].id, 'f1-a')
  assert.equal(result[1].id, 'f2-a')
  assert.equal(result[2].id, 'f1-b')
})

test('roundRobinFeedCards: stops at targetCount', () => {
  const feeds = ['f1', 'f2']
  const buckets = new Map<string, TestCard[]>([
    [
      'f1',
      [
        { id: 'a', feedId: 'f1', publishedAt: 1 },
        { id: 'b', feedId: 'f1', publishedAt: 1 },
      ],
    ],
    [
      'f2',
      [
        { id: 'c', feedId: 'f2', publishedAt: 1 },
        { id: 'd', feedId: 'f2', publishedAt: 1 },
      ],
    ],
  ])
  const result = roundRobinFeedCards(buckets, feeds, 2, keyOf)
  assert.equal(result.length, 2)
})

test('roundRobinFeedCards: deduplicates by key within result', () => {
  const feeds = ['f1', 'f2']
  const buckets = new Map<string, TestCard[]>([
    ['f1', [{ id: 'dup', feedId: 'f1', publishedAt: 1 }]],
    ['f2', [{ id: 'dup', feedId: 'f2', publishedAt: 1 }]],
  ])
  const result = roundRobinFeedCards(buckets, feeds, 5, keyOf)
  assert.equal(result.length, 1)
})

test('roundRobinFeedCards: sorts by publishedAt when sort function provided', () => {
  const feeds = ['f1']
  const buckets = new Map<string, TestCard[]>([
    [
      'f1',
      [
        { id: 'older', feedId: 'f1', publishedAt: 100 },
        { id: 'newer', feedId: 'f1', publishedAt: 200 },
      ],
    ],
  ])
  const result = roundRobinFeedCards(
    buckets,
    feeds,
    2,
    keyOf,
    (a: TestCard, b: TestCard) => b.publishedAt - a.publishedAt,
  )
  assert.equal(result[0].id, 'newer')
  assert.equal(result[1].id, 'older')
})

test('roundRobinFeedCards: handles empty buckets', () => {
  const feeds = ['f1']
  const buckets = new Map<string, TestCard[]>([['f1', []]])
  const result = roundRobinFeedCards(buckets, feeds, 5, keyOf)
  assert.equal(result.length, 0)
})

test('roundRobinFeedCards: handles single feed', () => {
  const feeds = ['f1']
  const buckets = new Map<string, TestCard[]>([
    [
      'f1',
      [
        { id: 'a', feedId: 'f1', publishedAt: 1 },
        { id: 'b', feedId: 'f1', publishedAt: 2 },
        { id: 'c', feedId: 'f1', publishedAt: 3 },
      ],
    ],
  ])
  const result = roundRobinFeedCards(buckets, feeds, 3, keyOf)
  assert.equal(result.length, 3)
})

test('roundRobinFeedCards: progresses over multiple rounds', () => {
  const feeds = ['f1', 'f2', 'f3']
  const buckets = new Map<string, TestCard[]>([
    [
      'f1',
      [
        { id: 'a1', feedId: 'f1', publishedAt: 1 },
        { id: 'a2', feedId: 'f1', publishedAt: 2 },
      ],
    ],
    ['f2', [{ id: 'b1', feedId: 'f2', publishedAt: 3 }]],
    [
      'f3',
      [
        { id: 'c1', feedId: 'f3', publishedAt: 4 },
        { id: 'c2', feedId: 'f3', publishedAt: 5 },
      ],
    ],
  ])
  const result = roundRobinFeedCards(buckets, feeds, 5, keyOf)
  // Round 1: a1, b1, c1 | Round 2: a2, c2
  assert.equal(result.length, 5)
  assert.deepEqual(
    result.map((c) => c.id),
    ['a1', 'b1', 'c1', 'a2', 'c2'],
  )
})
