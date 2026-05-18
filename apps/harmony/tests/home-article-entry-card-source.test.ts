import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeInlineSearchQuery,
  buildInlineHighlightSegments,
  InlineHighlightSegment,
} from '../entry/src/main/ets/common/utils/home/HomeInlineSearch.ts'

test('normalizeInlineSearchQuery trims and lowercases', () => {
  assert.equal(normalizeInlineSearchQuery('  Hello World  '), 'hello world')
  assert.equal(normalizeInlineSearchQuery('RSS'), 'rss')
  assert.equal(normalizeInlineSearchQuery(''), '')
})

test('normalizeInlineSearchQuery handles non-string input gracefully', () => {
  // The function coerces falsy input to empty string
  assert.equal(normalizeInlineSearchQuery(undefined as unknown as string), '')
})

test('buildInlineHighlightSegments returns single non-matched segment for empty query', () => {
  const result = buildInlineHighlightSegments('Hello World', '')
  assert.equal(result.length, 1)
  assert.equal(result[0].text, 'Hello World')
  assert.equal(result[0].matched, false)
})

test('buildInlineHighlightSegments returns single non-matched segment for empty text', () => {
  const result = buildInlineHighlightSegments('', 'query')
  assert.equal(result.length, 1)
  assert.equal(result[0].text, '')
  assert.equal(result[0].matched, false)
})

test('buildInlineHighlightSegments highlights a single match', () => {
  const result = buildInlineHighlightSegments('Hello World', 'world')
  assert.equal(result.length, 2)
  assert.equal(result[0].text, 'Hello ')
  assert.equal(result[0].matched, false)
  assert.equal(result[1].text, 'World')
  assert.equal(result[1].matched, true)
})

test('buildInlineHighlightSegments highlights multiple matches', () => {
  const result = buildInlineHighlightSegments('the cat and the hat', 'the')
  assert.equal(result.length, 4)
  // 'the' at start
  assert.equal(result[0].text, 'the')
  assert.equal(result[0].matched, true)
  // ' cat and '
  assert.equal(result[1].text, ' cat and ')
  assert.equal(result[1].matched, false)
  // 'the' again
  assert.equal(result[2].text, 'the')
  assert.equal(result[2].matched, true)
  // trailing ' hat'
  assert.equal(result[3].text, ' hat')
  assert.equal(result[3].matched, false)
})

test('buildInlineHighlightSegments is case-insensitive', () => {
  const result = buildInlineHighlightSegments('Hello WORLD', 'world')
  assert.equal(result.length, 2)
  assert.equal(result[1].text, 'WORLD')
  assert.equal(result[1].matched, true)
})

test('buildInlineHighlightSegments handles query not found', () => {
  const result = buildInlineHighlightSegments('Hello World', 'xyz')
  assert.equal(result.length, 1)
  assert.equal(result[0].text, 'Hello World')
  assert.equal(result[0].matched, false)
})

test('buildInlineHighlightSegments handles overlapping match patterns correctly', () => {
  // 'aa' in 'aaa' — should find first match at index 0
  const result = buildInlineHighlightSegments('aaa', 'aa')
  assert.equal(result.length, 2)
  assert.equal(result[0].text, 'aa')
  assert.equal(result[0].matched, true)
  assert.equal(result[1].text, 'a')
  assert.equal(result[1].matched, false)
})

test('buildInlineHighlightSegments each segment has correct total length', () => {
  const text = 'The Quick Brown Fox'
  const result = buildInlineHighlightSegments(text, 'quick')
  // Should be: ['The ', 'Quick', ' Brown Fox']
  const totalLength = result.reduce(
    (sum: number, seg: InlineHighlightSegment) => sum + seg.text.length,
    0,
  )
  assert.equal(totalLength, text.length)
})

test('buildInlineHighlightSegments preserves original casing in segments', () => {
  const result = buildInlineHighlightSegments('Title WITH Mixed Case', 'with')
  assert.equal(result.length, 3)
  assert.equal(result[0].text, 'Title ')
  assert.equal(result[0].matched, false)
  assert.equal(result[1].text, 'WITH')
  assert.equal(result[1].matched, true)
  // The remainder should be ' Mixed Case'
  assert.equal(result[2].text, ' Mixed Case')
  assert.equal(result[2].matched, false)
})
