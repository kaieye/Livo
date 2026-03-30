import test from 'node:test'
import assert from 'node:assert/strict'

import {
  extractYouTubeProfileName,
  normalizeYouTubeProfileSources,
  resolveYouTubeProfileName,
} from '../entry/src/main/ets/common/utils/YouTubeProfileResolver.ts'

test('extractYouTubeProfileName prefers @handle over account name', () => {
  const result = extractYouTubeProfileName(
    JSON.stringify({
      accountName: 'Livo Creator',
      channelHandle: '@livo-dev',
      channelName: 'Livo Channel',
    }),
  )

  assert.equal(result, '@livo-dev')
})

test('extractYouTubeProfileName falls back to Google displayName markers', () => {
  const result = extractYouTubeProfileName(
    '<script>window.__DATA__={"displayName":"Livo Tester"}</script>',
  )

  assert.equal(result, 'Livo Tester')
})

test('resolveYouTubeProfileName scans multiple pages and returns the first usable profile name', () => {
  const result = resolveYouTubeProfileName([
    '<html><body>no profile here</body></html>',
    '<script>window.__DATA__={"channelName":"Livo Secondary"}</script>',
    '<script>window.__DATA__={"displayName":"Livo Tertiary"}</script>',
  ])

  assert.equal(result, 'Livo Secondary')
})

test('extractYouTubeProfileName reads meta itemprop name markers from page html', () => {
  const result = extractYouTubeProfileName(
    '<meta itemprop="name" content="Livo Meta" />',
  )

  assert.equal(result, 'Livo Meta')
})

test('extractYouTubeProfileName strips Google Account prefix from aria labels', () => {
  const result = extractYouTubeProfileName('Google Account: Livo Label')

  assert.equal(result, 'Livo Label')
})

test('normalizeYouTubeProfileSources converts nullish or non-array values into an empty list', () => {
  assert.deepEqual(normalizeYouTubeProfileSources(null), [])
  assert.deepEqual(normalizeYouTubeProfileSources(undefined), [])
  assert.deepEqual(normalizeYouTubeProfileSources('oops'), [])
})
